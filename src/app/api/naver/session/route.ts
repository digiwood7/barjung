import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { isRemoteAdminRuntime } from "@/lib/api/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

type NaverSessionStatus = "connected" | "expired" | "action_required" | "local_required";

function runnerCommand(script: "naver:status" | "naver:login"): { file: string; args: string[] } {
  const npmArgs = ["--prefix", "runner", "run", script];
  if (script === "naver:status") npmArgs.push("--silent");
  if (process.platform !== "win32") return { file: "npm", args: npmArgs };
  return { file: process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe", args: ["/d", "/s", "/c", "npm.cmd", ...npmArgs] };
}

function localRequired(): NextResponse {
  return NextResponse.json({
    status: "local_required" satisfies NaverSessionStatus,
    message: "네이버 로그인은 고객 Windows PC의 로컬 관리자에서 확인합니다.",
  }, { status: 503 });
}

export async function GET() {
  if (isRemoteAdminRuntime()) return localRequired();
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

export async function POST() {
  if (isRemoteAdminRuntime()) return localRequired();
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
