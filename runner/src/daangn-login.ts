import type { Page } from "playwright";
import { DAANGN_HOME_URL, DAANGN_LOGIN_URL, defaultDaangnProfileDir, openDaangnContext, sleep, verifyDaangnPage, type DaangnLoginCheck } from "./adapters/daangn/browser.js";

export async function waitForManualDaangnLogin(page: Page, timeoutSec: number): Promise<DaangnLoginCheck> {
  let last: DaangnLoginCheck = { ok: false, reason: "당근 로그인 대기 중" };
  for (let elapsed = 0; elapsed < timeoutSec; elapsed += 3) {
    last = await verifyDaangnPage(page);
    if (last.ok) return last;
    await sleep(3000);
  }
  return last;
}

async function main(): Promise<number> {
  const profileDir = defaultDaangnProfileDir();
  const timeoutSec = Number(process.env.BARJUNG_DAANGN_LOGIN_TIMEOUT ?? "300") || 300;
  const context = await openDaangnContext({ profileDir, headless: false, channel: process.env.BARJUNG_DAANGN_CHANNEL?.trim() || "chrome" });
  try {
    const page = await context.newPage();
    await page.goto(DAANGN_HOME_URL, { waitUntil: "domcontentloaded" });
    await sleep(2000);
    const saved = await verifyDaangnPage(page);
    if (saved.ok) { console.log(`LOGIN_OK 기존 당근 세션 확인 완료: ${profileDir}`); return 0; }
    await page.goto(DAANGN_LOGIN_URL, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "로그인", exact: true }).click().catch(() => undefined);
    console.log(`크롬 창에서 당근부동산 공인중개사 로그인을 완료하세요. 최대 ${timeoutSec}초 기다립니다...`);
    const result = await waitForManualDaangnLogin(page, timeoutSec);
    if (result.ok) { console.log(`LOGIN_OK 당근 세션 저장·검증 완료: ${profileDir}`); return 0; }
    console.log(`LOGIN_FAIL 당근 로그인 감지 실패(시간초과): ${result.reason}`);
    return 1;
  } finally {
    await context.close().catch(() => undefined);
  }
}

main().then((code) => process.exit(code)).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
