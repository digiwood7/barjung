import { NotConfiguredAdapter } from "./base.js";
import type { PlatformAdapter, PublishInput, PublishResult, SessionResult } from "../types.js";
import { defaultDaangnProfileDir, openDaangnContext, verifyDaangnLogin } from "./daangn/browser.js";

export function createDaangnAdapter(env: NodeJS.ProcessEnv = process.env): PlatformAdapter {
  if (env.BARJUNG_DAANGN_ENABLED?.trim().toLowerCase() !== "true") return new NotConfiguredAdapter("daangn");
  return {
    platform: "daangn" as const,
    async checkSession(): Promise<SessionResult> {
      const context = await openDaangnContext({ profileDir: defaultDaangnProfileDir(env), headless: true, channel: env.BARJUNG_DAANGN_CHANNEL?.trim() || "chrome", retries: 1 });
      try {
        const result = await verifyDaangnLogin(context);
        return { status: result.ok ? "connected" : "expired" };
      } catch {
        return { status: "action_required" };
      } finally {
        await context.close().catch(() => undefined);
      }
    },
    async publish(_input: PublishInput): Promise<PublishResult> {
      return { status: "not_configured", errorCode: "adapter_not_configured", errorSummary: "당근 로그인은 연결됐지만 게시 자동화는 아직 검증 전입니다." };
    },
  };
}

export const daangnAdapter = createDaangnAdapter();
