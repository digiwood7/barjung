import { describe, expect, it } from "vitest";
import { runTargets } from "../src/jobs/worker.js";
import type { PlatformAdapter, PublishInput } from "../src/types.js";

const input = (platform: PublishInput["platform"]): PublishInput => ({ targetId: platform, platform, title: "매물", copy: "직원 원고", imagePaths: [] });

describe("runner worker", () => {
  it("keeps other platforms independent when one adapter throws", async () => {
    const success: PlatformAdapter = { platform: "naver", async checkSession() { return { status: "connected" }; }, async publish() { return { status: "succeeded", publishedUrl: "https://example.test/post" }; } };
    const failure: PlatformAdapter = { platform: "tiktok", async checkSession() { return { status: "connected" }; }, async publish() { throw new Error("locator missing"); } };
    const result = await runTargets([input("naver"), input("tiktok")], { naver: success, tiktok: failure });
    expect(result.naver?.status).toBe("succeeded");
    expect(result.tiktok).toMatchObject({ status: "failed", errorCode: "selector_changed" });
  });
});
