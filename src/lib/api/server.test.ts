import { afterEach, describe, expect, it, vi } from "vitest";
import { withLive } from "./server";

afterEach(() => vi.unstubAllEnvs());

describe("Vercel 원격 접근 차단", () => {
  it("인증 도입 전에는 Vercel에서 고객 데이터 handler를 실행하지 않는다", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const handler = vi.fn(async () => ({ ok: true }));

    const response = await withLive(new Request("https://barjung.example/api/customers"), handler);

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "REMOTE_ACCESS_DISABLED" });
    expect(handler).not.toHaveBeenCalled();
  });
});
