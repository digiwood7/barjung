import { describe, expect, it } from "vitest";
import { runTargets } from "../src/jobs/worker.js";
import type { PlatformAdapter, PublishInput } from "../src/types.js";

const input = (platform: PublishInput["platform"]): PublishInput => ({ targetId: platform, platform, title: "매물", copy: "직원 원고", imagePaths: [] });

describe("runner worker", () => {
  it("keeps other platforms independent when one adapter throws", async () => {
    const success: PlatformAdapter = { platform: "naver", async checkSession() { return { status: "connected" }; }, async publish() { return { status: "succeeded", publishedUrl: "https://example.test/post" }; } };
    const failure: PlatformAdapter = { platform: "zigbang", async checkSession() { return { status: "connected" }; }, async publish() { throw new Error("locator missing"); } };
    const result = await runTargets([input("naver"), input("zigbang")], { naver: success, zigbang: failure });
    expect(result.naver?.status).toBe("succeeded");
    expect(result.zigbang).toMatchObject({ status: "failed", errorCode: "selector_changed" });
  });
});
