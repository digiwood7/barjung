import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { createPlatformAdapters } from "./adapters/index.js";
import { runTargets } from "./jobs/worker.js";
import { runMediaOptimizationJob, type ClaimedMediaJob } from "./media-jobs.js";
import { SupabaseRunnerStore, type ClaimedTarget } from "./store.js";
import type { PublishInput } from "./types.js";

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} 환경변수가 필요합니다.`);
  return value;
};

const configuredInterval = Number(process.env.BARJUNG_RUNNER_POLL_MS ?? "5000");
const intervalMs = Number.isFinite(configuredInterval) ? Math.max(1000, configuredInterval) : 5000;
const supabase = createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const agentId = required("BARJUNG_AGENT_ID");
const adapters = createPlatformAdapters();
const store = new SupabaseRunnerStore(supabase);
type RunnerCommand = { id: string; office_id: string; command: "naver_login" };
let activeRunnerCommandId: string | null = null;
let lastNaverSessionCheckAt = 0;
let runnerCommandUnavailableWarned = false;

async function updateNaverConnection(officeId: string, status: "connected" | "expired" | "action_required" | "not_configured"): Promise<void> {
  const { error } = await supabase.from("platform_connections").upsert({
    office_id: officeId,
    platform: "naver",
    status,
    last_checked_at: new Date().toISOString(),
  }, { onConflict: "office_id,platform" });
  if (error) throw new Error(`naver connection update failed: ${error.code}`);
}

async function completeRunnerCommand(command: RunnerCommand, succeeded: boolean, message: string): Promise<void> {
  try {
    await updateNaverConnection(command.office_id, succeeded ? "connected" : "expired");
    const { error } = await supabase.from("runner_commands").update({
      status: succeeded ? "succeeded" : "failed",
      result_message: message,
      completed_at: new Date().toISOString(),
      lease_expires_at: null,
    }).eq("id", command.id).eq("lease_agent_id", agentId);
    if (error) throw new Error(`runner command completion failed: ${error.code}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "runner command completion error");
  } finally {
    activeRunnerCommandId = null;
  }
}

function startRunnerCommand(command: RunnerCommand): void {
  activeRunnerCommandId = command.id;
  const executable = process.platform === "win32" ? process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe" : "npm";
  const args = process.platform === "win32" ? ["/d", "/s", "/c", "npm.cmd", "run", "naver:login"] : ["run", "naver:login"];
  const child = spawn(executable, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "ignore",
    windowsHide: true,
  });
  let settled = false;
  const finish = (succeeded: boolean, message: string) => {
    if (settled) return;
    settled = true;
    void completeRunnerCommand(command, succeeded, message);
  };
  child.once("error", (error) => finish(false, error.message));
  child.once("exit", (code) => finish(code === 0, code === 0 ? "네이버 로그인 저장 및 확인 완료" : `네이버 로그인 종료 코드 ${code ?? "unknown"}`));
}

async function refreshNaverSession(officeId: string): Promise<void> {
  if (Date.now() - lastNaverSessionCheckAt < 300_000) return;
  lastNaverSessionCheckAt = Date.now();
  const result = await adapters.naver.checkSession();
  await updateNaverConnection(officeId, result.status);
}

async function heartbeat(): Promise<void> {
  const { error } = await supabase.from("local_agents").update({ status: "online", last_heartbeat_at: new Date().toISOString() }).eq("id", agentId);
  if (error) throw new Error(`heartbeat failed: ${error.code}`);
}

async function updateJobStatus(jobId: string): Promise<void> {
  const { data, error } = await supabase.from("distribution_targets").select("status").eq("distribution_job_id", jobId);
  if (error) throw new Error(`target aggregation failed: ${error.code}`);
  const statuses = (data || []).map((row) => row.status as string);
  const terminal = statuses.length > 0 && statuses.every((status) => ["succeeded", "failed", "cancelled", "not_configured"].includes(status));
  const overall = !terminal ? "running" : statuses.every((status) => status === "succeeded") ? "succeeded" : statuses.some((status) => status === "failed") ? "failed" : "not_configured";
  const timestamps = terminal ? { completed_at: new Date().toISOString() } : { started_at: new Date().toISOString() };
  const { error: updateError } = await supabase.from("distribution_jobs").update({ overall_status: overall, ...timestamps }).eq("id", jobId);
  if (updateError) throw new Error(`job status update failed: ${updateError.code}`);
}

async function tick(): Promise<void> {
  await heartbeat();
  if (activeRunnerCommandId) return;
  const { data: commandData, error: commandError } = await supabase.rpc("claim_runner_command", { p_agent_id: agentId, p_lease_seconds: 600 });
  if (commandError && !["PGRST202", "42883"].includes(commandError.code)) throw new Error(`runner command claim failed: ${commandError.code}`);
  if (commandError && !runnerCommandUnavailableWarned) {
    console.warn("runner command queue is not migrated yet; media and publishing queues will continue.");
    runnerCommandUnavailableWarned = true;
  }
  const command = Array.isArray(commandData) ? commandData[0] as RunnerCommand | undefined : undefined;
  if (command) {
    startRunnerCommand(command);
    return;
  }

  const { data: agent, error: agentError } = await supabase.from("local_agents").select("office_id").eq("id", agentId).single();
  if (agentError) throw new Error(`runner office lookup failed: ${agentError.code}`);
  await refreshNaverSession(String(agent.office_id));

  const { data: mediaData, error: mediaError } = await supabase.rpc("claim_media_optimization_job", { p_agent_id: agentId, p_lease_seconds: 1800 });
  if (mediaError) throw new Error(`media queue claim failed: ${mediaError.code}`);
  const mediaJob = Array.isArray(mediaData) ? mediaData[0] as ClaimedMediaJob | undefined : undefined;
  if (mediaJob) {
    await runMediaOptimizationJob(supabase, mediaJob);
    return;
  }

  const { data, error } = await supabase.rpc("claim_distribution_target", { p_agent_id: agentId, p_lease_seconds: 120 });
  if (error) throw new Error(`queue claim failed: ${error.code}`);
  const target = Array.isArray(data) ? data[0] : undefined;
  if (!target) return;

  await updateJobStatus(String(target.distribution_job_id));

  const input: PublishInput = await store.loadPublishInput(target as ClaimedTarget);
  const result = (await runTargets([input], adapters))[input.platform];
  if (!result) return;
  const { error: targetError } = await supabase.from("distribution_targets").update({
    status: result.status,
    published_url: result.publishedUrl ?? null,
    error_code: result.errorCode ?? null,
    error_summary: result.errorSummary ?? null,
    completed_at: new Date().toISOString(),
    lease_expires_at: null,
  }).eq("id", target.id).eq("lease_agent_id", agentId);
  if (targetError) throw new Error(`target update failed: ${targetError.code}`);
  if (input.platform === "naver") {
    await updateNaverConnection(String(agent.office_id), result.status === "succeeded" ? "connected" : result.errorCode === "auth_expired" ? "expired" : "action_required");
  }
  const { error: eventError } = await supabase.from("distribution_events").insert({
    office_id: target.office_id,
    distribution_target_id: target.id,
    from_status: "running",
    to_status: result.status,
    event_data: { error_code: result.errorCode ?? null },
  });
  if (eventError) throw new Error(`distribution event insert failed: ${eventError.code}`);
  await updateJobStatus(String(target.distribution_job_id));
}

console.log("바를정 Windows 실행기를 시작합니다. 사진 최적화와 플랫폼 발행 큐를 처리합니다.");
for (;;) {
  try { await tick(); }
  catch (error) { console.error(error instanceof Error ? error.message : "runner error"); }
  await new Promise((resolve) => setTimeout(resolve, intervalMs));
}
