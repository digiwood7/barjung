import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

afterEach(() => vi.unstubAllEnvs());

describe("POST /api/building-register", () => {
  it("Vercel에서 서버 전용 공공데이터 키를 호출하지 못하게 한다", async () => {
    vi.stubEnv("VERCEL", "1");
    const response = await POST(new Request("https://barjung.example/api/building-register", {
      method: "POST",
      body: JSON.stringify({ address: "대구광역시 북구" }),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "REMOTE_ACCESS_DISABLED" });
  });
});
