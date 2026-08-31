import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

afterEach(() => vi.unstubAllEnvs());

describe("POST /api/building-register", () => {
  it("세션 없는 Vercel 요청은 공공데이터 키 호출 전에 거부한다", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("BARJUNG_SESSION_SECRET", "test-secret-that-is-longer-than-thirty-two-characters");
    const response = await POST(new Request("https://barjung.example/api/building-register", {
      method: "POST",
      body: JSON.stringify({ address: "대구광역시 북구" }),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "AUTH_REQUIRED" });
  });

  it("건축HUB 키가 있어도 지번 코드가 없으면 주소 선택을 요청한다", async () => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("BUILDING_REGISTER_API_KEY", "building-key");
    vi.stubEnv("JUSO_API_KEY", "");
    const response = await POST(new Request("http://localhost/api/building-register", {
      method: "POST",
      body: JSON.stringify({ address: "대구광역시 북구 산격동 1240-1" }),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: "ADDRESS_SELECTION_REQUIRED" });
  });
});
