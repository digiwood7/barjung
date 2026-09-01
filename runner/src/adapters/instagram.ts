import { NotConfiguredAdapter } from "./base.js";
import { InstagramFeedAdapter, isInstagramEnabled, readInstagramConfig } from "./instagram/adapter.js";
import type { PlatformAdapter } from "../types.js";

export function createInstagramAdapter(env: NodeJS.ProcessEnv = process.env): PlatformAdapter {
  return isInstagramEnabled(env) ? new InstagramFeedAdapter(readInstagramConfig(env)) : new NotConfiguredAdapter("instagram");
}

export const instagramAdapter = createInstagramAdapter();
