import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { isRemoteAdminRuntime, withLive } from "@/lib/api/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

type NaverSessionStatus = "connected" | "expired" | "action_required" | "local_required";
type RunnerCommandRow = { status: "queued" | "running"; created_at: string };
type ConnectionRow = { status: "connected" | "expired" | "action_required" | "not_configured"; last_checked_at: string | null };

function runnerCommand(script: "naver:status" | "naver:login"): { file: string; args: string[] } {
  const npmArgs = ["--prefix", "runner", "run", script];
  if (script === "naver:status") npmArgs.push("--silent");
  if (process.platform !== "win32") return { file: "npm", args: npmArgs };
  return { file: process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe", args: ["/d", "/s", "/c", "npm.cmd", ...npmArgs] };
}

export async function GET(request: Request) {
  if (isRemoteAdminRuntime()) {
    return withLive(request, async (ctx) => {
      const [connectionResult, commandResult] = await Promise.all([
        ctx.client.from("platform_connections").select("status,last_checked_at").eq("office_id", ctx.officeId).eq("platform", "naver").maybeSingle(),
        ctx.client.from("runner_commands").select("status,created_at").eq("office_id", ctx.officeId).eq("command", "naver_login").in("status", ["queued", "running"]).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (connectionResult.error) throw new Error(`네이버 연결 상태 조회 실패: ${connectionResult.error.code}`);
      if (commandResult.error) throw new Error(`로그인 요청 조회 실패: ${commandResult.error.code}`);
      const command = commandResult.data as RunnerCommandRow | null;
      if (command) return {
        status: "action_required" satisfies NaverSessionStatus,
        message: command.status === "running" ? "고객 PC에 네이버 로그인 창이 열려 있습니다. 로그인을 완료해 주세요." : "Windows 실행기가 네이버 로그인 요청을 대기 중입니다.",
      };
      const connection = connectionResult.data as ConnectionRow | null;
      if (connection?.status === "connected") return { status: "connected" satisfies NaverSessionStatus, message: "네이버 로그인 세션이 정상적으로 유지되고 있습니다." };
      if (connection?.status === "expired") return { status: "expired" satisfies NaverSessionStatus, message: "네이버 로그인이 만료되었습니다. 로그인 버튼을 눌러 갱신해 주세요." };
      return { status: "action_required" satisfies NaverSessionStatus, message: "네이버 로그인이 필요합니다. 로그인 버튼을 누르면 고객 PC에 Chrome이 열립니다." };
    });
  }
  try {
    const command = runnerCommand("naver:status");
    const { stdout } = await execFileAsync(command.file, command.args, {
      cwd: process.cwd(),
      env: process.env,
      timeout: 35_000,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });
    const line = stdout.trim().split(/\r?\n/).findLast((value) => value.startsWith("{"));
    if (!line) throw new Error("네이버 상태 응답을 읽지 못했습니다.");
    return NextResponse.json(JSON.parse(line) as { status: NaverSessionStatus; message: string });
  } catch (error) {
    const message = error instanceof Error ? error.message : "네이버 로그인 상태를 확인하지 못했습니다.";
    return NextResponse.json({ status: "action_required" satisfies NaverSessionStatus, message });
  }
}

export async function POST(request: Request) {
  if (isRemoteAdminRuntime()) {
    return withLive(request, async (ctx) => {
      const { data: active, error: activeError } = await ctx.client.from("runner_commands").select("id,status").eq("office_id", ctx.officeId).eq("command", "naver_login").in("status", ["queued", "running"]).limit(1).maybeSingle();
      if (activeError) throw new Error(`로그인 요청 조회 실패: ${activeError.code}`);
      if (!active) {
        const { error: insertError } = await ctx.client.from("runner_commands").insert({ office_id: ctx.officeId, command: "naver_login", status: "queued" });
        if (insertError && insertError.code !== "23505") throw new Error(`로그인 요청 저장 실패: ${insertError.code}`);
      }
      const { error: connectionError } = await ctx.client.from("platform_connections").upsert({ office_id: ctx.officeId, platform: "naver", status: "action_required", last_checked_at: new Date().toISOString() }, { onConflict: "office_id,platform" });
      if (connectionError) throw new Error(`네이버 연결 상태 저장 실패: ${connectionError.code}`);
      return {
        status: "action_required" satisfies NaverSessionStatus,
        message: active?.status === "running" ? "고객 PC에 열린 네이버 로그인 창을 확인해 주세요." : "Windows 실행기에 로그인 요청을 보냈습니다. 잠시 후 고객 PC에 Chrome이 열립니다.",
      };
    });
  }
  try {
    const command = runnerCommand("naver:login");
    const child = spawn(/*turbopackIgnore: true*/ command.file, command.args, {
      cwd: process.cwd(),
      env: process.env,
      detached: true,
      stdio: "ignore",
      windowsHide: false,
    });
    child.unref();
    return NextResponse.json({ status: "action_required" satisfies NaverSessionStatus, message: "네이버 로그인 창을 열었습니다. 로그인을 완료하면 상태가 자동으로 갱신됩니다." }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "네이버 로그인 창을 열지 못했습니다.";
    return NextResponse.json({ status: "action_required" satisfies NaverSessionStatus, message }, { status: 500 });
  }
}
