import { daangnAdapter } from "./daangn.js";
import { instagramAdapter } from "./instagram.js";
import { createNaverAdapter } from "./naver.js";
import { zigbangAdapter } from "./zigbang.js";
import type { AdapterMap } from "../types.js";

export function createPlatformAdapters(env: NodeJS.ProcessEnv = process.env): Required<AdapterMap> {
  return { naver: createNaverAdapter(env), instagram: instagramAdapter, daangn: daangnAdapter, zigbang: zigbangAdapter };
}
