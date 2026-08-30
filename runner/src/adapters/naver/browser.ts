import { existsSync, mkdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { chromium, type BrowserContext } from "playwright";

/**
 * 네이버용 영구 프로필 브라우저 — DGagent tools/skill-naver-blog-write/scripts/_browser.py 이식.
 * 실제 크롬 채널 + 영구 프로필 + 사람형 딜레이. 과한 위장은 하지 않는다.
 * 프로필은 저장소 밖(BARJUNG_PLAYWRIGHT_PROFILE_DIR/naver) 에만 둔다.
 */
export interface NaverBrowserOptions {
  profileDir: string;
  headless: boolean;
  /** "chrome"(설치된 크롬) → 실패하면 내장 Chromium 으로 폴백 */
  channel?: string;
  retries?: number;
  waitMs?: number;
}

export const NAVER_LOGIN_URL = "https://nid.naver.com/nidlogin.login";
export const NAVER_WRITE_URL = "https://blog.naver.com/GoBlogWrite.naver";

export function defaultProfileDir(env: NodeJS.ProcessEnv = process.env): string {
  const base = env.BARJUNG_PLAYWRIGHT_PROFILE_DIR?.trim() || path.join(homedir(), "barjung-profiles");
  return path.join(base, "naver");
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
export const randomBetween = (a: number, b: number) => a + Math.random() * (b - a);

/** 살아있는 크롬이 없는데 남은 락 파일만 지운다 (mac/linux Singleton*, windows lockfile) */
function clearStaleLocks(profileDir: string): void {
  for (const name of ["SingletonLock", "SingletonSocket", "SingletonCookie", "lockfile"]) {
    const target = path.join(profileDir, name);
    try { if (existsSync(target)) rmSync(target, { force: true }); } catch { /* 다음 launch 에서 드러난다 */ }
  }
}

function isLockError(message: string): boolean {
  return /ProcessSingleton|SingletonLock|already in use|profile is already/i.test(message);
}

export async function openNaverContext(options: NaverBrowserOptions): Promise<BrowserContext> {
  const profileDir = path.resolve(options.profileDir);
  mkdirSync(profileDir, { recursive: true });
  const retries = options.retries ?? 3;
  const waitMs = options.waitMs ?? 10_000;
  const args = ["--disable-blink-features=AutomationControlled", "--window-size=1280,1600"];
  let lastError: unknown;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    for (const channel of [options.channel ?? "chrome", undefined]) {
      try {
        return await chromium.launchPersistentContext(profileDir, { channel, headless: options.headless, viewport: null, args });
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        if (isLockError(message)) {
          clearStaleLocks(profileDir);
          break; // 채널 폴백 말고 재시도
        }
        // 크롬 채널이 없으면 내장 Chromium 으로 한 번 더
      }
    }
    if (attempt < retries) await sleep(waitMs);
  }
  throw new Error(`Chrome profile launch failed after ${retries} attempts. profile=${profileDir}, last_error=${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

export interface LoginCheck { ok: boolean; reason: string }

/**
 * 로그인 상태 저장 검증 — DGagent login_and_save 의 세 단계 이식.
 * ① NID_AUT + NID_SES 둘 다 있을 것 ② 영구 쿠키일 것(로그인 상태 유지 체크) ③ 글쓰기 페이지가 로그인 화면으로 안 튕길 것
 */
export async function verifyNaverLogin(context: BrowserContext): Promise<LoginCheck> {
  const need = ["NID_AUT", "NID_SES"];
  const cookies = await context.cookies();
  const byName = new Map(cookies.map((cookie) => [cookie.name, cookie]));
  const missing = need.filter((name) => !byName.has(name));
  if (missing.length) return { ok: false, reason: `쿠키 없음: ${missing.join(", ")}` };
  const temporary = need.filter((name) => (byName.get(name)?.expires ?? -1) <= 0);
  if (temporary.length) return { ok: false, reason: `${temporary.join(", ")} 가 임시 쿠키입니다 — 로그인 화면의 '로그인 상태 유지'에 체크하고 다시 로그인하세요.` };
  const page = await context.newPage();
  try {
    await page.goto(NAVER_WRITE_URL, { waitUntil: "domcontentloaded" });
    await sleep(5000);
    const url = page.url();
    if (url.includes("nid.naver.com") || url.includes("nidlogin")) return { ok: false, reason: "글쓰기 페이지에서 로그인 화면으로 튕깁니다 — 2단계 인증이 덜 끝났을 수 있습니다." };
    return { ok: true, reason: "글쓰기 페이지 진입 확인" };
  } finally {
    await page.close().catch(() => undefined);
  }
}
