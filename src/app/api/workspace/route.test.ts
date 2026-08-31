import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

afterEach(() => vi.unstubAllEnvs());

describe("GET /api/workspace", () => {
  it("세션 없는 Vercel 요청은 고객 데이터 조회 전에 거부한다", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("BARJUNG_SESSION_SECRET", "test-secret-that-is-longer-than-thirty-two-characters");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    const response = await GET(new Request("https://barjeong.vercel.app/api/workspace"));

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "AUTH_REQUIRED" });
  });
});
