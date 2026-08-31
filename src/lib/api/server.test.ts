import { afterEach, describe, expect, it, vi } from "vitest";
import { withLive } from "./server";

afterEach(() => vi.unstubAllEnvs());

describe("Vercel 관리자 인증", () => {
  it("세션이 없으면 Vercel에서 고객 데이터 handler를 실행하지 않는다", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("BARJUNG_SESSION_SECRET", "test-secret-that-is-longer-than-thirty-two-characters");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const handler = vi.fn(async () => ({ ok: true }));

    const response = await withLive(new Request("https://barjung.example/api/customers"), handler);

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "AUTH_REQUIRED" });
    expect(handler).not.toHaveBeenCalled();
  });
});
