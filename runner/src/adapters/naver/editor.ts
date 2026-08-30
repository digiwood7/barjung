import type { Frame, Locator, Page } from "playwright";
import { randomBetween, sleep } from "./browser.js";

/**
 * 네이버 SmartEditor ONE 조작 — DGagent tools/skill-naver-blog-write/scripts/_naver_editor.py 이식.
 * 실측 셀렉터(2026-06~08)와 함정 대응을 그대로 옮기고, 글감·상위글·AI 서식 로직은 뺐다.
 *
 * - 에디터는 iframe#mainFrame 안. name 이 불안정해 element.contentFrame() 으로 잡는다.
 * - '이어서 작성' 팝업(.se-popup-alert-confirm)의 dim 이 클릭을 가로채므로 진입 직후 닫는다.
 * - 입력은 단어 단위 keyboard.type(한글 조합 안정) + 토큰 사이 랜덤 딜레이. 라이브 계정이라 속도를 올리지 않는다.
 * - 발행 레이어 버튼은 CSS 모듈 해시 클래스라 [class*='접두어'] 로 잡는다. '발행' 이름 버튼이 둘(레이어 열기/확정)이라 role 로 잡지 않는다.
 * - 카테고리명 공백은 nbsp 라 정규화해 비교한다.
 * - 발행 직후 page.url 은 글 주소로 안 바뀐다 — 성공 판정은 RSS 로 한다(adapter 담당).
 */
export const SEL = {
  MAIN_FRAME: "mainFrame",
  TITLE: ".se-title-text",
  BODY: ".se-component.se-text",
  BODY_PARA: ".se-component.se-text .se-text-paragraph",
  POPUP: ".se-popup-alert-confirm",
  IMAGE_BUTTON_NAME: "사진",
  CAPTION: ".se-caption, .se-image-caption, [data-placeholder*='사진 설명'], [placeholder*='사진 설명']",
  SAVE_BTN: "button[class*='save_btn']",
  OPEN_PUBLISH_LAYER_BTN: "button[class*='publish_btn']",
  PUBLISH_LAYER: "div[class*='layer_publish']",
  CATEGORY_SELECT_BTN: "button[class*='selectbox_button']",
  PUBLISH_CONFIRM_BTN: "button[class*='confirm_btn']",
} as const;

export class NaverLoginRequired extends Error {
  constructor(url: string) {
    // classifyError 가 'login'/'session' 을 보고 auth_expired 로 분류하도록 영문 키워드를 포함한다.
    super(`네이버 로그인 세션이 만료됐습니다 (login session expired). 2단계 인증이라 자동 복구가 안 됩니다 — 고객 PC에서 npm --prefix runner run naver:login 을 실행해 로그인하세요. 현재 URL: ${url.slice(0, 120)}`);
    this.name = "NaverLoginRequired";
  }
}

/** 에디터 페이지가 로그인 화면으로 튕겼는지 즉시 판별 (셀렉터 타임아웃으로 위장되지 않게) */
export function assertLoggedIn(page: { url(): string }): void {
  const url = page.url() || "";
  if (url.includes("nid.naver.com") || url.includes("nidlogin")) throw new NaverLoginRequired(url);
}

export function normalizeCategory(value: string | null | undefined): string {
  return (value ?? "").replace(/ /g, " ").trim();
}

export interface EditorOptions {
  /** 1 = 사람 속도. 라이브 발행은 절대 올리지 않는다 (anti-bot). */
  typeSpeed?: number;
  /** 고정 대기(팝업·업로드·발행 후) 배율. 테스트에서만 줄인다. */
  waitScale?: number;
  /** 단축키 보조키: mac=Meta, windows/linux=Control */
  modifier?: "Meta" | "Control";
}

export class NaverEditor {
  readonly scope: Frame | Page;
  private readonly speed: number;
  private readonly waitScale: number;
  private readonly mod: "Meta" | "Control";

  private constructor(readonly page: Page, scope: Frame | Page, options: EditorOptions) {
    this.scope = scope;
    this.speed = Math.max(options.typeSpeed ?? 1, 0.1);
    this.waitScale = Math.max(options.waitScale ?? 1, 0.01);
    this.mod = options.modifier ?? (process.platform === "darwin" ? "Meta" : "Control");
  }

  static async create(page: Page, options: EditorOptions = {}): Promise<NaverEditor> {
    return new NaverEditor(page, await NaverEditor.findScope(page), options);
  }

  private static async findScope(page: Page): Promise<Frame | Page> {
    try {
      const element = await page.$(`iframe#${SEL.MAIN_FRAME}`);
      const frame = await element?.contentFrame();
      if (frame) return frame;
    } catch { /* 아래 폴백 */ }
    const named = page.frame({ name: SEL.MAIN_FRAME });
    if (named) return named;
    for (const frame of page.frames()) if ((frame.url() || "").includes("PostWriteForm")) return frame;
    return page;
  }

  private async pause(a: number, b: number): Promise<void> {
    await this.wait((randomBetween(a, b) * 1000) / this.speed);
  }

  private wait(ms: number): Promise<void> {
    return sleep(ms * this.waitScale);
  }

  /** 단어 단위 입력(한글 조합 안정) + 토큰 사이 랜덤 딜레이. "\n" 은 Enter. */
  async humanType(text: string): Promise<void> {
    for (const token of text.match(/[^\s]+|\n| +/g) ?? []) {
      if (token === "\n") await this.page.keyboard.press("Enter");
      else await this.page.keyboard.type(token);
      await this.pause(0.06, 0.22);
    }
  }

  /** '이어서 작성' 팝업 처리. "취소"=새 글, "확인"=이어쓰기 */
  async dismissContinuePopup(action: "취소" | "확인" = "취소"): Promise<boolean> {
    try {
      const alert = this.scope.locator(SEL.POPUP);
      if (await alert.count()) {
        await alert.getByRole("button", { name: action }).first().click();
        await this.wait(1200);
        return true;
      }
    } catch { /* 팝업 없음 */ }
    return false;
  }

  async setTitle(title: string): Promise<void> {
    await this.scope.locator(SEL.TITLE).first().click();
    await this.wait(300);
    await this.humanType(title);
  }

  async bodyText(): Promise<string> {
    const components = this.scope.locator(SEL.BODY);
    const count = await components.count();
    const texts: string[] = [];
    for (let index = 0; index < count; index += 1) texts.push(await components.nth(index).innerText());
    return texts.join("\n");
  }

  async focusBody(): Promise<void> {
    await this.scope.locator(SEL.BODY).first().click();
    await this.wait(500);
  }

  /** 컴포넌트 블록의 '진짜 끝'에 커서 — 여러 줄 단락에서 가운데 줄에 커서가 박혀 문장이 쪼개지는 것을 막는다 */
  async caretToBlockEnd(component: Locator): Promise<void> {
    const box = await component.boundingBox().catch(() => null);
    try {
      if (box && box.height > 6) await component.click({ position: { x: Math.max(box.width - 6, 2), y: Math.max(box.height - 6, 2) } });
      else await component.click();
    } catch {
      await component.click().catch(() => undefined);
    }
    await this.wait(150);
    await this.page.keyboard.press("End");
    await this.wait(100);
  }

  /** 마지막 본문 컴포넌트 끝 → 문서 끝으로 */
  async caretToDocumentEnd(): Promise<void> {
    const texts = this.scope.locator(SEL.BODY);
    const count = await texts.count();
    if (count) await this.caretToBlockEnd(texts.nth(count - 1));
    else await this.focusBody();
    await this.page.keyboard.press(this.mod === "Meta" ? "Meta+ArrowDown" : "Control+End");
    await this.wait(200);
  }

  /** 현재 커서 위치부터 줄들을 입력한다. 빈 줄은 Enter 만. 첫 줄 앞에 Enter 를 넣을지 leadingBreak 로 정한다. */
  async typeLines(lines: string[], leadingBreak = false): Promise<void> {
    if (leadingBreak) { await this.page.keyboard.press("Enter"); await this.wait(120); }
    for (let index = 0; index < lines.length; index += 1) {
      if (index > 0) { await this.page.keyboard.press("Enter"); await this.wait(120); }
      const line = lines[index];
      if (line) await this.humanType(line);
    }
  }

  /** '사진' 버튼 → 파일 선택기로 업로드. caption 은 '사진 설명' 칸에만 넣는다(본문 누출 방지). */
  async insertImage(localPath: string, caption = ""): Promise<boolean> {
    try {
      const chooser = this.page.waitForEvent("filechooser", { timeout: 10_000 });
      await this.scope.getByRole("button", { name: SEL.IMAGE_BUTTON_NAME }).first().click();
      await (await chooser).setFiles(localPath);
      await this.wait(2500);
      if (caption) await this.setLastImageCaption(caption);
      return true;
    } catch {
      return false;
    }
  }

  private async setLastImageCaption(caption: string): Promise<void> {
    try {
      const box = this.scope.locator(SEL.CAPTION).last();
      if (await box.count()) {
        await box.click(); await this.wait(200);
        await this.page.keyboard.type(caption); await this.wait(200);
      }
    } catch { /* 캡션 칸을 못 찾으면 넣지 않는다 */ }
  }

  /** 본문 맨 끝에 해시태그 — 각 '#태그' 뒤 Space 가 태그 칩 변환을 확정한다 */
  async typeHashtags(tags: string[], gapLines = 3): Promise<number> {
    const clean = tags.map((tag) => String(tag).replace(/^#/, "").trim()).filter(Boolean);
    if (!clean.length) return 0;
    try {
      await this.caretToDocumentEnd();
      await this.page.keyboard.press("Enter");
      await this.page.keyboard.press("Enter");
      for (let index = 0; index < gapLines; index += 1) { await this.page.keyboard.press("Enter"); await this.wait(80); }
      await this.wait(200);
      for (const tag of clean) {
        await this.page.keyboard.type(`#${tag}`);
        await this.page.keyboard.press("Space");
        await this.wait(150);
      }
      return clean.length;
    } catch {
      return 0;
    }
  }

  /** 임시저장(저장 버튼) — 발행 아님 */
  async saveDraft(): Promise<boolean> {
    try {
      await this.scope.locator(SEL.SAVE_BTN).first().click();
      await this.wait(2000);
      const confirm = this.scope.getByRole("button", { name: "확인" });
      if (await confirm.count()) { await confirm.first().click(); await this.wait(1000); }
      return true;
    } catch {
      return false;
    }
  }

  async openPublishLayer(): Promise<boolean> {
    await this.scope.locator(SEL.OPEN_PUBLISH_LAYER_BTN).first().click();
    await this.wait(2500);
    return (await this.scope.locator(SEL.PUBLISH_LAYER).count()) > 0;
  }

  async currentCategory(): Promise<string> {
    try { return normalizeCategory(await this.scope.locator(SEL.CATEGORY_SELECT_BTN).first().innerText()); }
    catch { return ""; }
  }

  async selectCategory(name: string): Promise<boolean> {
    const want = normalizeCategory(name);
    if ((await this.currentCategory()) === want) return true;
    await this.scope.locator(SEL.CATEGORY_SELECT_BTN).first().click();
    await this.wait(1200);
    const candidates = [
      this.scope.getByRole("option", { name, exact: true }),
      this.scope.locator(`li:has-text("${name}")`),
      this.scope.getByText(name, { exact: true }),
    ];
    for (const candidate of candidates) {
      try {
        if (await candidate.count()) { await candidate.first().click(); await this.wait(1200); break; }
      } catch { /* 다음 후보 */ }
    }
    return (await this.currentCategory()) === want;
  }

  /** 발행. 카테고리 지정이 실패하면 발행하지 않는다 — 기본 카테고리로 잘못 나가는 것이 실패보다 나쁘다. */
  async publish(category?: string): Promise<boolean> {
    if (!(await this.openPublishLayer())) return false;
    if (category && !(await this.selectCategory(category))) return false;
    await this.scope.locator(SEL.PUBLISH_CONFIRM_BTN).first().click();
    await this.wait(6000);
    return true;
  }
}
