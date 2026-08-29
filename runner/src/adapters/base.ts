import type { Platform, PlatformAdapter, PublishInput, PublishResult, SessionResult } from "../types.js";

export class NotConfiguredAdapter implements PlatformAdapter {
  constructor(readonly platform: Platform) {}
  async checkSession(): Promise<SessionResult> { return { status: "not_configured" }; }
  async publish(_input: PublishInput): Promise<PublishResult> {
    return {
      status: "not_configured",
      errorCode: "adapter_not_configured",
      errorSummary: `${this.platform} Playwright 어댑터를 고객 PC에서 연결해야 합니다.`,
    };
  }
}
