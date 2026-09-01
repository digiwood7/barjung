import { describe, expect, it } from "vitest";
import { createPlatformAdapters } from "../src/adapters/index.js";

describe("safe platform adapters", () => {
  it("refuses to publish on every platform until customer-PC training is installed", async () => {
    const adapters = createPlatformAdapters({});
    for (const [platform, adapter] of Object.entries(adapters)) {
      expect(await adapter.checkSession()).toEqual({ status: "not_configured" });
      expect(await adapter.publish({ targetId: "target-1", platform: platform as never, title: "매물", copy: "직원 작성 원고", imagePaths: [] })).toEqual({
        status: "not_configured",
        errorCode: "adapter_not_configured",
        errorSummary: `${platform} Playwright 어댑터를 고객 PC에서 연결해야 합니다.`,
      });
    }
  });
});
