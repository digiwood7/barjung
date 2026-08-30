import { NotConfiguredAdapter } from "./base.js";
import { NaverBlogAdapter, isNaverEnabled, readNaverConfig } from "./naver/adapter.js";
import type { PlatformAdapter } from "../types.js";

/**
 * BARJUNG_NAVER_ENABLED=true 일 때만 실제 네이버 블로그 어댑터를 쓴다.
 * 그 전에는 안전한 not_configured (고객 PC 에서 headed 로 검증 후 켠다 — docs/PLATFORM_ADAPTER_GUIDE.md).
 */
export function createNaverAdapter(env: NodeJS.ProcessEnv = process.env): PlatformAdapter {
  return isNaverEnabled(env) ? new NaverBlogAdapter(readNaverConfig(env)) : new NotConfiguredAdapter("naver");
}

export const naverAdapter = createNaverAdapter();
