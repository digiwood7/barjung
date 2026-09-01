import type { Page } from "playwright";
import {
  defaultInstagramProfileDir,
  dismissInstagramPostLoginPrompts,
  INSTAGRAM_LOGIN_URL,
  instagramProfileUrl,
  openInstagramContext,
  sleep,
  verifyInstagramPage,
  type InstagramLoginCheck,
} from "./adapters/instagram/browser.js";

/** 한 탭만 유지한다. 로그인 감지 때문에 새 탭을 반복 생성하지 않는다. */
export async function waitForManualInstagramLogin(page: Page, username: string | undefined, timeoutSec: number): Promise<InstagramLoginCheck> {
  let openedOwnerProfile = false;
  let last: InstagramLoginCheck = { ok: false, reason: "인스타그램 로그인 대기 중" };
  for (let elapsed = 0; elapsed < timeoutSec; elapsed += 3) {
    await dismissInstagramPostLoginPrompts(page);
    last = await verifyInstagramPage(page);
    if (last.ok && username && !openedOwnerProfile) {
      await page.goto(instagramProfileUrl(username), { waitUntil: "domcontentloaded" });
      await sleep(2000);
      await dismissInstagramPostLoginPrompts(page);
      openedOwnerProfile = true;
    }
    if (last.ok) {
      last = await verifyInstagramPage(page, username);
      if (last.ok) return last;
    }
    await sleep(3000);
  }
  return last;
}

/** 고객이 직접 로그인·추가 인증을 마치면 별도 영구 프로필에 세션을 저장한다. */
async function main(): Promise<number> {
  const profileDir = defaultInstagramProfileDir();
  const username = process.env.BARJUNG_INSTAGRAM_USERNAME?.trim().replace(/^@/, "") || undefined;
  const timeoutSec = Number(process.env.BARJUNG_INSTAGRAM_LOGIN_TIMEOUT ?? "300") || 300;
  const context = await openInstagramContext({
    profileDir,
    headless: false,
    channel: process.env.BARJUNG_INSTAGRAM_CHANNEL?.trim() || "chrome",
  });
  try {
    const page = await context.newPage();
    await page.goto(instagramProfileUrl(username), { waitUntil: "domcontentloaded" });
    await sleep(2000);
    await dismissInstagramPostLoginPrompts(page);
    const saved = await verifyInstagramPage(page, username);
    if (saved.ok) {
      console.log(`LOGIN_OK 기존 세션 확인 완료: ${profileDir}`);
      return 0;
    }
    await page.goto(INSTAGRAM_LOGIN_URL, { waitUntil: "domcontentloaded" });
    console.log(`크롬 창에서 인스타그램에 로그인하고 추가 인증을 완료하세요. 최대 ${timeoutSec}초 기다립니다...`);
    const result = await waitForManualInstagramLogin(page, username, timeoutSec);
    if (result.ok) {
      console.log(`LOGIN_OK 세션 저장·검증 완료: ${profileDir}`);
      return 0;
    }
    console.log(`LOGIN_FAIL 인스타그램 로그인 감지 실패(시간초과): ${result.reason}`);
    return 1;
  } finally {
    await context.close().catch(() => undefined);
  }
}

main().then((code) => process.exit(code)).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
