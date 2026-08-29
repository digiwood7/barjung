import { daangnAdapter } from "./daangn.js";
import { instagramAdapter } from "./instagram.js";
import { naverAdapter } from "./naver.js";
import { zigbangAdapter } from "./zigbang.js";
import type { AdapterMap } from "../types.js";

export function createPlatformAdapters(): Required<AdapterMap> {
  return { naver: naverAdapter, instagram: instagramAdapter, daangn: daangnAdapter, zigbang: zigbangAdapter };
}
