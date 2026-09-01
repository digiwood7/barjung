import { createDaangnAdapter } from "./daangn.js";
import { createInstagramAdapter } from "./instagram.js";
import { createNaverAdapter } from "./naver.js";
import { tiktokAdapter } from "./tiktok.js";
import { youtubeAdapter } from "./youtube.js";
import type { AdapterMap } from "../types.js";

export function createPlatformAdapters(env: NodeJS.ProcessEnv = process.env): Required<AdapterMap> {
  return {
    naver: createNaverAdapter(env),
    daangn: createDaangnAdapter(env),
    instagram: createInstagramAdapter(env),
    tiktok: tiktokAdapter,
    youtube: youtubeAdapter,
  };
}
