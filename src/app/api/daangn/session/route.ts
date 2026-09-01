import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { isRemoteAdminRuntime, withLive } from "@/lib/api/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);
type SessionStatus = "connected" | "expired" | "action_required" | "local_required";

function runnerCommand(script: "daangn:status" | "daangn:login"): { file: string; args: string[] } {
  const npmArgs = ["--prefix", "runner", "run", script];
  if (script === "daangn:status") npmArgs.push("--silent");
  if (process.platform !== "win32") return { file: "npm", args: npmArgs };
  return { file: process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe", args: ["/d", "/s", "/c", "npm.cmd", ...npmArgs] };
}

export async function GET(request: Request) {
  if (isRemoteAdminRuntime()) {
    return withLive(request, async (ctx) => {
      const [{ data: connection }, { data: command }] = await Promise.all([
        ctx.client.from("platform_connections").select("status,last_checked_at").eq("office_id", ctx.officeId).eq("platform", "daangn").maybeSingle(),
        ctx.client.from("runner_commands").select("status,created_at").eq("office_id", ctx.officeId).eq("command", "daangn_login").in("status", ["queued", "running"]).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (command) return { status: "action_required" satisfies SessionStatus, message: command.status === "running" ? "고객 PC에 당근 로그인 창이 열려 있습니다." : "Windows 실행기가 당근 로그인 요청을 기다립니다." };
      if (connection?.status === "connected") return { status: "connected" satisfies SessionStatus, message: "당근 로그인 세션이 정상적으로 유지되고 있습니다." };
      return { status: connection?.status === "expired" ? "expired" : "action_required" satisfies SessionStatus, message: "당근 로그인이 필요합니다." };
    });
  }
  try {
    const command = runnerCommand("daangn:status");
    const { stdout } = await execFileAsync(command.file, command.args, { cwd: process.cwd(), env: process.env, timeout: 45_000, windowsHide: true, maxBuffer: 1024 * 1024 });
    const line = stdout.trim().split(/\r?\n/).findLast((value) => value.startsWith("{"));
    if (!line) throw new Error("당근 상태 응답을 읽지 못했습니다.");
    return NextResponse.json(JSON.parse(line));
  } catch (error) {
    return NextResponse.json({ status: "action_required", message: error instanceof Error ? error.message : "당근 로그인 상태를 확인하지 못했습니다." });
  }
}

export async function POST(request: Request) {
  if (isRemoteAdminRuntime()) {
    return withLive(request, async (ctx) => {
      const { data: active } = await ctx.client.from("runner_commands").select("id,status").eq("office_id", ctx.officeId).eq("command", "daangn_login").in("status", ["queued", "running"]).limit(1).maybeSingle();
      if (!active) {
        const { error } = await ctx.client.from("runner_commands").insert({ office_id: ctx.officeId, command: "daangn_login", status: "queued" });
        if (error && error.code !== "23505") throw new Error(`당근 로그인 요청 저장 실패: ${error.code}`);
      }
      await ctx.client.from("platform_connections").upsert({ office_id: ctx.officeId, platform: "daangn", status: "action_required", last_checked_at: new Date().toISOString() }, { onConflict: "office_id,platform" });
      return { status: "action_required" satisfies SessionStatus, message: "Windows 실행기에 당근 로그인 요청을 보냈습니다." };
    });
  }
  try {
    const command = runnerCommand("daangn:login");
    const child = spawn(/*turbopackIgnore: true*/ command.file, command.args, { cwd: process.cwd(), env: process.env, detached: true, stdio: "ignore", windowsHide: false });
    child.unref();
    return NextResponse.json({ status: "action_required" satisfies SessionStatus, message: "당근 로그인 창을 열었습니다. 로그인을 완료해 주세요." }, { status: 202 });
  } catch (error) {
    return NextResponse.json({ status: "action_required", message: error instanceof Error ? error.message : "당근 로그인 창을 열지 못했습니다." }, { status: 500 });
  }
}
