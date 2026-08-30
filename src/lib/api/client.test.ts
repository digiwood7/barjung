import { afterEach, describe, expect, it, vi } from "vitest";
import { connectRepository } from "./client";

afterEach(() => vi.unstubAllGlobals());

describe("connectRepository", () => {
  it("NOT_CONFIGURED 응답만 데모 저장소로 전환한다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ code: "NOT_CONFIGURED" }), { status: 503 })));

    const repository = await connectRepository();

    expect(repository.mode).toBe("demo");
  });

  it("Supabase 서버 오류를 데모 데이터로 숨기지 않는다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ code: "WORKSPACE_FAILED", message: "고객 DB 연결 실패" }), { status: 500 })));

    await expect(connectRepository()).rejects.toThrow("고객 DB 연결 실패");
  });
});
