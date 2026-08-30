import { NAVER_LOGIN_URL, defaultProfileDir, openNaverContext, sleep, verifyNaverLogin } from "./adapters/naver/browser.js";

/**
 * 네이버 최초 1회 로그인 — 크롬 창을 띄우고 사람이 로그인(2단계 인증까지)하면 자동 감지해 프로필에 저장한다.
 * 사용: npm --prefix runner run naver:login
 * DGagent _browser.py --login 이식. '로그인 상태 유지' 를 체크해야 영구 쿠키가 남는다.
 */
async function main(): Promise<number> {
  const profileDir = defaultProfileDir();
  const timeoutSec = Number(process.env.BARJUNG_NAVER_LOGIN_TIMEOUT ?? "300") || 300;
  const context = await openNaverContext({ profileDir, headless: false, channel: process.env.BARJUNG_NAVER_CHANNEL?.trim() || "chrome" });
  try {
    const page = await context.newPage();
    await page.goto(NAVER_LOGIN_URL);
    console.log(`크롬 창에서 네이버에 로그인하세요('로그인 상태 유지' 체크, 2단계 인증까지). 최대 ${timeoutSec}초 기다립니다...`);
    const need = ["NID_AUT", "NID_SES"];
    let seen = false;
    for (let elapsed = 0; elapsed < timeoutSec; elapsed += 2) {
      const names = new Set((await context.cookies().catch(() => [])).map((cookie) => cookie.name));
      if (need.every((name) => names.has(name))) { seen = true; break; }
      await sleep(2000);
    }
    if (!seen) { console.log(`LOGIN_FAIL 로그인 감지 실패(시간초과). 필요한 쿠키: ${need.join(", ")}`); return 1; }
    await sleep(2000);
    const check = await verifyNaverLogin(context);
    if (check.ok) { console.log(`LOGIN_OK 세션 저장·검증 완료: ${profileDir}`); return 0; }
    console.log(`LOGIN_FAIL ${check.reason}`);
    return 2;
  } finally {
    await context.close().catch(() => undefined);
  }
}

main().then((code) => process.exit(code)).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
