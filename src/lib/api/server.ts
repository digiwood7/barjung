import { NextResponse } from "next/server";
import { createServiceClient, isReadOnly } from "@/lib/supabase/server";
import { resolveOfficeId, type WorkspaceContext } from "@/lib/supabase/workspace";

/**
 * Route Handler 공통 진입점.
 * - 고객 Supabase 값이 없으면 503 NOT_CONFIGURED (화면은 demo 모드로 동작)
 * - Vercel 런타임은 관리자 인증 도입 전 읽기·쓰기 모두 차단
 * - BARJUNG_READ_ONLY=true 이면 로컬에서도 조회만 허용
 * - 서비스 오류는 400 + 정제된 메시지
 */
export type LiveHandler<T> = (ctx: WorkspaceContext, request: Request) => Promise<T>;

let officeCache: { key: string; id: string } | null = null;

export function isRemoteAdminRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.VERCEL === "1";
}

export function remoteAccessDisabled(): NextResponse {
  return NextResponse.json({
    code: "REMOTE_ACCESS_DISABLED",
    message: "관리자 인증이 도입되기 전에는 Vercel에서 고객 데이터에 접근할 수 없습니다. 고객 Windows PC의 로컬 관리자에서 사용하세요.",
  }, { status: 403 });
}

export async function liveContext(): Promise<WorkspaceContext | null> {
  const client = createServiceClient();
  if (!client) return null;
  const key = `${process.env.SUPABASE_URL ?? ""}|${process.env.BARJUNG_OFFICE_ID ?? ""}`;
  if (!officeCache || officeCache.key !== key) officeCache = { key, id: await resolveOfficeId(client) };
  return { client, officeId: officeCache.id, now: new Date() };
}

export function notConfigured(): NextResponse {
  return NextResponse.json({ code: "NOT_CONFIGURED", message: "고객 Supabase 값(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)이 .env.local 에 없습니다." }, { status: 503 });
}

export async function withLive<T>(request: Request, handler: LiveHandler<T>): Promise<NextResponse> {
  try {
    if (isRemoteAdminRuntime()) return remoteAccessDisabled();
    if (request.method !== "GET" && isReadOnly()) {
      return NextResponse.json({ code: "READ_ONLY", message: "현재 조회 전용 모드에서는 저장할 수 없습니다." }, { status: 403 });
    }
    const ctx = await liveContext();
    if (!ctx) return notConfigured();
    const result = await handler(ctx, request);
    return NextResponse.json(result ?? { ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";
    return NextResponse.json({ code: "REQUEST_FAILED", message }, { status: 400 });
  }
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return await request.json() as T;
  } catch {
    throw new Error("요청 본문이 JSON 형식이 아닙니다.");
  }
}

export type RouteParams<K extends string> = { params: Promise<Record<K, string>> };
