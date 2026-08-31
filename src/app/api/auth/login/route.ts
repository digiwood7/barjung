import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_MAX_AGE, createAdminSessionToken } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";

interface LoginInput { username?: string; password?: string }

export async function POST(request: Request) {
  try {
    const input = await request.json() as LoginInput;
    const username = input.username?.trim() || "";
    const password = input.password || "";
    if (!username || !password || username.length > 80 || password.length > 200) {
      return NextResponse.json({ code: "INVALID_CREDENTIALS", message: "아이디 또는 비밀번호를 확인하세요." }, { status: 401 });
    }

    const client = createServiceClient();
    if (!client) return NextResponse.json({ code: "NOT_CONFIGURED", message: "Supabase 연결이 필요합니다." }, { status: 503 });
    const { data, error } = await client.rpc("verify_admin_credentials", { p_username: username, p_password: password });
    if (error) throw error;
    const account = Array.isArray(data) ? data[0] : null;
    if (!account) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      return NextResponse.json({ code: "INVALID_CREDENTIALS", message: "아이디 또는 비밀번호를 확인하세요." }, { status: 401 });
    }

    const token = createAdminSessionToken({
      adminUserId: account.admin_user_id,
      officeId: account.office_id,
      username: account.username,
    });
    const response = NextResponse.json({ ok: true, username: account.username });
    response.cookies.set(ADMIN_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: ADMIN_SESSION_MAX_AGE,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "로그인에 실패했습니다.";
    return NextResponse.json({ code: "LOGIN_FAILED", message }, { status: 500 });
  }
}
