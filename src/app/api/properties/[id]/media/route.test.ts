import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

afterEach(() => vi.unstubAllEnvs());

describe("POST /api/properties/[id]/media", () => {
  it("세션 없는 Vercel 요청은 Python 실행 전에 거부한다", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("BARJUNG_SESSION_SECRET", "test-secret-that-is-longer-than-thirty-two-characters");
    const response = await POST(new Request("https://barjung.example/api/properties/p1/media", { method: "POST" }), { params: Promise.resolve({ id: "p1" }) });

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "AUTH_REQUIRED" });
  });
});
