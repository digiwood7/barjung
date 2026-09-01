import { NotConfiguredAdapter } from "./base.js";

/** 유튜브 쇼츠 게시 계약 자리. OAuth·게시 검증 전에는 실제 업로드하지 않는다. */
export const youtubeAdapter = new NotConfiguredAdapter("youtube");
