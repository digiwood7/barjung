import path from "node:path";
import type { Locator, Page } from "playwright";
import { sleep } from "./browser.js";

export class InstagramLoginRequired extends Error {
  constructor(url: string) {
    super(`Instagram login session expired. 현재 URL: ${url.slice(0, 160)}`);
  }
}

export interface InstagramEditorOptions {
  minDelayMs?: number;
  maxDelayMs?: number;
  typeDelayMs?: number;
  waitScale?: number;
}

function uniqueExisting(paths: string[]): string[] {
  return [...new Set(paths.map((file) => path.resolve(file)))];
}

export function assertInstagramLoggedIn(page: Pick<Page, "url">): void {
  if (/\/accounts\/login|challenge|checkpoint/i.test(page.url())) throw new InstagramLoginRequired(page.url());
}

export class InstagramEditor {
  private readonly minDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly typeDelayMs: number;
  private readonly waitScale: number;

  constructor(private readonly page: Page, options: InstagramEditorOptions = {}) {
    this.minDelayMs = options.minDelayMs ?? 350;
    this.maxDelayMs = options.maxDelayMs ?? 900;
    this.typeDelayMs = options.typeDelayMs ?? 24;
    this.waitScale = options.waitScale ?? 1;
  }

  private async pause(): Promise<void> {
    const delay = this.minDelayMs + Math.random() * Math.max(0, this.maxDelayMs - this.minDelayMs);
    await sleep(delay * this.waitScale);
  }

  private async visible(locator: Locator): Promise<boolean> {
    return locator.isVisible().catch(() => false);
  }

  async profilePostLinks(): Promise<Set<string>> {
    const links = await this.page.locator('a[href*="/p/"], a[href*="/reel/"]').evaluateAll((nodes) => nodes
      .map((node) => node.getAttribute("href"))
      .filter((value): value is string => Boolean(value)));
    return new Set(links);
  }

  async findPostByCaption(fragment: string): Promise<string | undefined> {
    const wanted = fragment.trim().replace(/\s+/g, " ");
    if (!wanted) return undefined;
    const href = await this.page.locator('a[href*="/p/"], a[href*="/reel/"]').evaluateAll((nodes, value) => {
      const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
      const match = nodes.find((node) => normalize(node.querySelector("img")?.getAttribute("alt") ?? "").includes(value));
      return match?.getAttribute("href") ?? undefined;
    }, wanted);
    return href ? new URL(href, "https://www.instagram.com").href : undefined;
  }

  async openNewPost(): Promise<void> {
    const create = this.page.getByRole("link", { name: /새로운 게시물|만들기|Create/i }).first();
    if (!(await this.visible(create))) throw new Error("selector: 인스타 새 게시물 메뉴를 찾지 못했습니다.");
    await create.click();
    await this.pause();

    const select = this.page.getByRole("button", { name: /컴퓨터에서 선택|Select from computer/i });
    if (!(await this.visible(select))) {
      const postMenu = this.page.getByRole("link", { name: /^(게시물)( 게시물)?$|^Post( Post)?$/i }).first();
      if (!(await this.visible(postMenu))) throw new Error("selector: 인스타 게시물 종류 메뉴를 찾지 못했습니다.");
      await postMenu.click();
      await this.pause();
    }
    await select.waitFor({ state: "visible", timeout: 10_000 });
  }

  async uploadVideo(videoPath: string): Promise<void> {
    const [file] = uniqueExisting([videoPath]);
    if (!file) throw new Error("validation: 인스타 릴스에 올릴 세로 영상이 없습니다.");
    const select = this.page.getByRole("button", { name: /컴퓨터에서 선택|Select from computer/i });
    const chooserPromise = this.page.waitForEvent("filechooser", { timeout: 10_000 });
    await select.click();
    const chooser = await chooserPromise;
    await chooser.setFiles(file);
    await this.pause();
    await this.page.getByRole("button", { name: /^(다음|Next)$/i }).waitFor({ state: "visible", timeout: 30_000 });
  }

  async advanceToCaption(): Promise<void> {
    for (let step = 0; step < 2; step += 1) {
      const next = this.page.getByRole("button", { name: /^(다음|Next)$/i });
      await next.waitFor({ state: "visible", timeout: 15_000 });
      await this.pause();
      await next.click();
    }
    await this.captionBox().waitFor({ state: "visible", timeout: 15_000 });
  }

  captionBox(): Locator {
    return this.page.getByRole("textbox", { name: /문구를 입력하세요|Write a caption/i }).or(
      this.page.locator('textarea[aria-label*="문구"], [contenteditable="true"][aria-label*="문구"], textarea[aria-label*="caption" i]'),
    ).first();
  }

  async setCaption(caption: string): Promise<void> {
    const box = this.captionBox();
    await box.click();
    await box.fill("");
    await box.pressSequentially(caption, { delay: Math.max(0, this.typeDelayMs * this.waitScale) });
    const value = await box.inputValue().catch(() => box.textContent());
    if (!(value ?? "").includes(caption.slice(0, Math.min(40, caption.length)))) throw new Error("selector: 인스타 게시글 문구 입력에 실패했습니다.");
  }

  async saveDraft(): Promise<boolean> {
    const close = this.page.getByRole("button", { name: /^(닫기|Close)$/i }).last();
    if (!(await this.visible(close))) return false;
    await close.click();
    const save = this.page.getByRole("button", { name: /임시 저장|Save draft/i });
    if (!(await save.waitFor({ state: "visible", timeout: 10_000 }).then(() => true).catch(() => false))) return false;
    await save.click();
    return true;
  }

  async share(): Promise<boolean> {
    const share = this.page.getByRole("button", { name: /^(공유하기|Share)$/i });
    await share.waitFor({ state: "visible", timeout: 10_000 });
    await this.pause();
    await share.click();
    const success = this.page.getByText(/게시물이 공유되었습니다|Your post has been shared/i).first();
    return success.waitFor({ state: "visible", timeout: 60_000 }).then(() => true).catch(() => false);
  }

  async resolveNewPost(before: Set<string>, profileUrl: string, attempts = 8, waitMs = 2500): Promise<string | undefined> {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      await this.page.goto(profileUrl, { waitUntil: "domcontentloaded" });
      await sleep(waitMs * this.waitScale);
      const current = await this.profilePostLinks();
      const found = [...current].find((href) => !before.has(href));
      if (found) return new URL(found, "https://www.instagram.com").href;
    }
    return undefined;
  }
}
