import { afterEach, describe, expect, it, vi } from "vitest";
import { connectRepository, createApiRepository } from "./client";

const storageMocks = vi.hoisted(() => ({ uploadToSignedUrl: vi.fn(async () => ({ data: { path: "staging" }, error: null })) }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ storage: { from: () => ({ uploadToSignedUrl: storageMocks.uploadToSignedUrl }) } }),
}));

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); storageMocks.uploadToSignedUrl.mockClear(); });

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

  it("원본을 staging에 직접 올리고 Windows 최적화 큐 완료까지 확인한다", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-test-key");
    const property = { id: "p1", photos: 1 };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ jobId: "j1", bucket: "property-media-staging", uploads: [{ name: "room.jpg", type: "image/jpeg", size: 5, path: "o/p/j/01.jpg", token: "signed" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ jobId: "j1", status: "queued" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "succeeded", property }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createApiRepository().uploadPropertyMedia("p1", [new File(["photo"], "room.jpg", { type: "image/jpeg" })]);

    expect(result).toMatchObject(property);
    expect(storageMocks.uploadToSignedUrl).toHaveBeenCalledWith("o/p/j/01.jpg", "signed", expect.any(File), { contentType: "image/jpeg" });
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/properties/p1/media?jobId=j1", expect.any(Object));
  });
});
