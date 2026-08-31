import { describe, expect, it } from "vitest";
import { ADMIN_SESSION_COOKIE, createAdminSessionToken, isAdminRequestAuthenticated, verifyAdminSessionToken } from "./session";

const env = { BARJUNG_SESSION_SECRET: "test-secret-that-is-longer-than-thirty-two-characters" } as unknown as NodeJS.ProcessEnv;
const identity = { adminUserId: "admin-1", officeId: "office-1", username: "barjeong" };

describe("관리자 세션", () => {
  it("서명된 토큰을 만들고 요청 쿠키에서 검증한다", () => {
    const token = createAdminSessionToken(identity, env);
    expect(verifyAdminSessionToken(token, env)).toMatchObject(identity);
    const request = new Request("https://barjeong.vercel.app/api/workspace", { headers: { cookie: `${ADMIN_SESSION_COOKIE}=${token}` } });
    expect(isAdminRequestAuthenticated(request, env)).toBe(true);
  });

  it("변조되거나 만료된 토큰을 거부한다", () => {
    const token = createAdminSessionToken(identity, env, 1_000);
    expect(verifyAdminSessionToken(`${token}x`, env, 2_000)).toBeNull();
    expect(verifyAdminSessionToken(token, env, 1_000 + 13 * 60 * 60 * 1000)).toBeNull();
  });
});
