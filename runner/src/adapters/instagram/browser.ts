import { existsSync, mkdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";

export const INSTAGRAM_HOME_URL = "https://www.instagram.com/";
export const INSTAGRAM_LOGIN_URL = "https://www.instagram.com/accounts/login/";

export interface InstagramBrowserOptions {
  profileDir: string;
  headless: boolean;
  channel?: string;
  retries?: number;
  waitMs?: number;
}

export interface InstagramLoginCheck { ok: boolean; reason: string }

export function defaultInstagramProfileDir(env: NodeJS.ProcessEnv = process.env): string {
  const base = env.BARJUNG_PLAYWRIGHT_PROFILE_DIR?.trim() || path.join(homedir(), "barjung-profiles");
  return path.join(base, "instagram");
}

export const instagramProfileUrl = (username?: string) => username?.trim()
  ? `https://www.instagram.com/${encodeURIComponent(username.trim().replace(/^@/, ""))}/`
  : INSTAGRAM_HOME_URL;

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function clearStaleLocks(profileDir: string): void {
  for (const name of ["SingletonLock", "SingletonSocket", "SingletonCookie", "lockfile"]) {
    const target = path.join(profileDir, name);
    try { if (existsSync(target)) rmSync(target, { force: true }); } catch { /* 다음 실행에서 원인을 드러낸다. */ }
  }
}

function isLockError(message: string): boolean {
  return /ProcessSingleton|SingletonLock|already in use|profile is already/i.test(message);
}

/** 고객 PC의 별도 영구 프로필을 사용한다. 자동화 탐지 우회용 플래그는 넣지 않는다. */
export async function openInstagramContext(options: InstagramBrowserOptions): Promise<BrowserContext> {
  const profileDir = path.resolve(options.profileDir);
  mkdirSync(profileDir, { recursive: true });
  const retries = options.retries ?? 3;
  const waitMs = options.waitMs ?? 10_000;
  let lastError: unknown;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    for (const channel of [options.channel ?? "chrome", undefined]) {
      try {
        return await chromium.launchPersistentContext(profileDir, {
          channel,
          headless: options.headless,
          viewport: null,
          args: ["--window-size=1280,1600"],
        });
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        if (isLockError(message)) {
          clearStaleLocks(profileDir);
          break;
        }
      }
    }
    if (attempt < retries) await sleep(waitMs);
  }
  throw new Error(`Instagram Chrome profile launch failed after ${retries} attempts. profile=${profileDir}, last_error=${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

export async function verifyInstagramPage(page: Page, username?: string): Promise<InstagramLoginCheck> {
  const url = page.url();
  if (/\/accounts\/login|challenge|checkpoint/i.test(url)) return { ok: false, reason: "인스타그램 로그인 또는 추가 인증 화면입니다." };
  const loginInputs = await page.locator('input[name="username"], input[name="password"]').count();
  if (loginInputs) return { ok: false, reason: "인스타그램 로그인 입력창이 표시됩니다." };
  const ownerSignal = username
    ? await page.getByRole("link", { name: /프로필 편집|Edit profile/i }).count()
    : await page.getByRole("link", { name: /새로운 게시물|만들기|Create/i }).count();
  return ownerSignal > 0
    ? { ok: true, reason: "저장된 인스타그램 로그인 세션 확인" }
    : { ok: false, reason: "로그인된 계정의 피드 작성 메뉴를 확인하지 못했습니다." };
}

/** 로그인 직후의 저장 안내·알림 권유만 닫는다. 추가 인증·보안 확인 화면은 건드리지 않는다. */
export async function dismissInstagramPostLoginPrompts(page: Page): Promise<number> {
  if (/challenge|checkpoint/i.test(page.url())) return 0;
  let dismissed = 0;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const dialogs = page.getByRole("dialog");
    if (!(await dialogs.count())) break;
    const dialog = dialogs.last();
    const later = dialog.getByRole("button", { name: /^(나중에 하기|Not now)$/i }).first();
    if (await later.isVisible().catch(() => false)) {
      await later.click();
      dismissed += 1;
      await sleep(400);
      continue;
    }
    const close = dialog.getByRole("button", { name: /^(닫기|Close)$/i }).first();
    if (await close.isVisible().catch(() => false)) {
      await close.click();
      dismissed += 1;
      await sleep(400);
      continue;
    }
    break;
  }
  return dismissed;
}

export async function verifyInstagramLogin(context: BrowserContext, username?: string): Promise<InstagramLoginCheck> {
  const page = await context.newPage();
  try {
    await page.goto(instagramProfileUrl(username), { waitUntil: "domcontentloaded" });
    await sleep(2500);
    await dismissInstagramPostLoginPrompts(page);
    return await verifyInstagramPage(page, username);
  } finally {
    await page.close().catch(() => undefined);
  }
}
