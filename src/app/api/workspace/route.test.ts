import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

afterEach(() => vi.unstubAllEnvs());

describe("GET /api/workspace", () => {
  it("인증 도입 전 Vercel 요청은 고객 데이터 조회 전에 거부한다", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    const response = await GET();

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "REMOTE_ACCESS_DISABLED" });
  });
});
