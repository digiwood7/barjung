import { existsSync, mkdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";

export const DAANGN_HOME_URL = "https://realty.daangn.com/";
export const DAANGN_LOGIN_URL = "https://realty.daangn.com/";

export interface DaangnLoginCheck { ok: boolean; reason: string }
export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function defaultDaangnProfileDir(env: NodeJS.ProcessEnv = process.env): string {
  const base = env.BARJUNG_PLAYWRIGHT_PROFILE_DIR?.trim() || path.join(homedir(), "barjung-profiles");
  return path.join(base, "daangn");
}

function clearStaleLocks(profileDir: string): void {
  for (const name of ["SingletonLock", "SingletonSocket", "SingletonCookie", "lockfile"]) {
    const target = path.join(profileDir, name);
    try { if (existsSync(target)) rmSync(target, { force: true }); } catch { /* 다음 시도에서 오류를 표시한다. */ }
  }
}

export async function openDaangnContext(options: { profileDir: string; headless: boolean; channel?: string; retries?: number }): Promise<BrowserContext> {
  const profileDir = path.resolve(options.profileDir);
  mkdirSync(profileDir, { recursive: true });
  let lastError: unknown;
  for (let attempt = 0; attempt < (options.retries ?? 3); attempt += 1) {
    for (const channel of [options.channel ?? "chrome", undefined]) {
      try {
        return await chromium.launchPersistentContext(profileDir, { channel, headless: options.headless, viewport: null, args: ["--window-size=1280,1600"] });
      } catch (error) {
        lastError = error;
        if (/ProcessSingleton|SingletonLock|already in use|profile is already/i.test(error instanceof Error ? error.message : String(error))) {
          clearStaleLocks(profileDir);
          break;
        }
      }
    }
    await sleep(1500);
  }
  throw new Error(`Daangn Chrome profile launch failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

export async function verifyDaangnPage(page: Page): Promise<DaangnLoginCheck> {
  const url = page.url();
  if (/\/login(?:[/?#]|$)|\/auth\/|signin/i.test(url)) return { ok: false, reason: "당근부동산 로그인 화면입니다." };
  const login = page.getByRole("button", { name: "로그인", exact: true }).first();
  if (await login.isVisible().catch(() => false)) return { ok: false, reason: "당근부동산 로그인이 필요합니다." };
  const register = page.getByRole("button", { name: "매물 등록", exact: true }).first();
  const officeHome = page.getByRole("link", { name: "중개소 홈", exact: true }).first();
  if (await register.isVisible().catch(() => false) || await officeHome.isVisible().catch(() => false)) {
    return { ok: true, reason: "저장된 당근부동산 공인중개사 세션 확인" };
  }
  const logout = page.getByText(/로그아웃/i).first();
  if (await logout.isVisible().catch(() => false)) return { ok: true, reason: "저장된 당근 로그인 세션 확인" };
  return { ok: false, reason: "로그인된 당근부동산 중개소 메뉴를 확인하지 못했습니다." };
}

export async function verifyDaangnLogin(context: BrowserContext): Promise<DaangnLoginCheck> {
  const page = await context.newPage();
  try {
    await page.goto(DAANGN_HOME_URL, { waitUntil: "domcontentloaded" });
    await sleep(2500);
    return await verifyDaangnPage(page);
  } finally {
    await page.close().catch(() => undefined);
  }
}
