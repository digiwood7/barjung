import type { BrowserContext, Page } from "playwright";
import type { PlatformAdapter, PublishInput, PublishResult, SessionResult } from "../../types.js";
import { NAVER_WRITE_URL, defaultProfileDir, openNaverContext, sleep } from "./browser.js";
import { composeNaverPost, type NaverPostConfig } from "./compose.js";
import { NaverEditor, assertLoggedIn, type EditorOptions } from "./editor.js";

/**
 * 네이버 블로그 어댑터 — 사진 순서대로 업로드 + 템플릿 글 + 명시사항 + 해시태그.
 * 기본은 임시저장(draft) 모드. BARJUNG_NAVER_MODE=publish 일 때만 실제 발행한다.
 */
export interface NaverAdapterConfig extends NaverPostConfig {
  mode: "draft" | "publish";
  /** RSS 로 발행 URL 을 확인할 블로그 ID (예: dhroom5555) */
  blogId?: string;
  category?: string;
  profileDir: string;
  headless: boolean;
  channel?: string;
  editorUrl?: string;
  editorOptions?: EditorOptions;
  /** 에디터 로딩 대기(ms). 실측 8초. */
  editorLoadMs?: number;
}

export interface NaverSession {
  page: Page;
  close(): Promise<void>;
}

export type SessionFactory = () => Promise<NaverSession>;
export type UrlResolver = (title: string) => Promise<string | undefined>;

export function readNaverConfig(env: NodeJS.ProcessEnv = process.env): NaverAdapterConfig {
  const split = (value: string | undefined, separator: RegExp) => (value ?? "").split(separator).map((item) => item.trim()).filter(Boolean);
  return {
    mode: env.BARJUNG_NAVER_MODE?.trim() === "publish" ? "publish" : "draft",
    blogId: env.BARJUNG_NAVER_BLOG_ID?.trim() || undefined,
    category: env.BARJUNG_NAVER_CATEGORY?.trim() || undefined,
    contactLines: split(env.BARJUNG_NAVER_CONTACT, /\|/),
    hashtags: split(env.BARJUNG_NAVER_HASHTAGS, /[,\s]+/),
    autoHashtags: env.BARJUNG_NAVER_AUTO_HASHTAGS?.trim().toLowerCase() !== "false",
    profileDir: defaultProfileDir(env),
    headless: env.BARJUNG_HEADLESS?.trim().toLowerCase() === "true",
    channel: env.BARJUNG_NAVER_CHANNEL?.trim() || "chrome",
    editorOptions: { typeSpeed: Number(env.BARJUNG_NAVER_TYPE_SPEED ?? "1") || 1 },
  };
}

export function isNaverEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.BARJUNG_NAVER_ENABLED?.trim().toLowerCase() === "true";
}

/** 발행 직후 page.url 은 안 바뀐다 → RSS 최상단 글 제목이 같으면 그 링크를 발행 URL 로 본다 (실측 2026-08-25) */
export async function resolvePublishedUrlViaRss(blogId: string, title: string, attempts = 6, waitMs = 5000, fetchImpl: typeof fetch = fetch): Promise<string | undefined> {
  const wanted = title.replace(/\s+/g, "");
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetchImpl(`https://rss.blog.naver.com/${encodeURIComponent(blogId)}.xml`, { cache: "no-store" } as RequestInit);
      const xml = await response.text();
      const item = xml.match(/<item>([\s\S]*?)<\/item>/)?.[1] ?? "";
      const itemTitle = (item.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1] ?? "").replace(/\s+/g, "");
      const link = item.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim();
      if (link && itemTitle === wanted) return link;
    } catch { /* 다음 시도 */ }
    if (attempt < attempts - 1) await sleep(waitMs);
  }
  return undefined;
}

function defaultSessionFactory(config: NaverAdapterConfig): SessionFactory {
  return async () => {
    const context: BrowserContext = await openNaverContext({ profileDir: config.profileDir, headless: config.headless, channel: config.channel });
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "https://blog.naver.com" }).catch(() => undefined);
    const page = await context.newPage();
    return { page, close: async () => { await sleep(2000); await context.close().catch(() => undefined); } };
  };
}

export class NaverBlogAdapter implements PlatformAdapter {
  readonly platform = "naver" as const;
  private readonly openSession: SessionFactory;
  private readonly resolveUrl: UrlResolver;

  constructor(
    private readonly config: NaverAdapterConfig,
    overrides: { session?: SessionFactory; resolveUrl?: UrlResolver } = {},
  ) {
    this.openSession = overrides.session ?? defaultSessionFactory(config);
    this.resolveUrl = overrides.resolveUrl ?? (async (title) => (config.blogId ? resolvePublishedUrlViaRss(config.blogId, title) : undefined));
  }

  async checkSession(): Promise<SessionResult> {
    const session = await this.openSession();
    try {
      await session.page.goto(this.config.editorUrl ?? NAVER_WRITE_URL, { waitUntil: "domcontentloaded" });
      await sleep(Math.min(this.config.editorLoadMs ?? 8000, 5000));
      const url = session.page.url();
      return { status: url.includes("nid.naver.com") || url.includes("nidlogin") ? "expired" : "connected" };
    } catch {
      return { status: "action_required" };
    } finally {
      await session.close();
    }
  }

  async publish(input: PublishInput): Promise<PublishResult> {
    const post = composeNaverPost(input, this.config);
    if (!post.title) return { status: "failed", errorCode: "validation", errorSummary: "글 제목이 없습니다." };
    const session = await this.openSession();
    try {
      const { page } = session;
      await page.goto(this.config.editorUrl ?? NAVER_WRITE_URL, { waitUntil: "domcontentloaded" });
      await sleep(this.config.editorLoadMs ?? 8000);
      assertLoggedIn(page); // 로그인 만료를 셀렉터 타임아웃으로 위장시키지 않는다
      const editor = await NaverEditor.create(page, this.config.editorOptions);
      await editor.dismissContinuePopup("취소");
      await editor.setTitle(post.title);

      await editor.focusBody();
      let typedSomething = false;
      let uploaded = 0;
      for (const block of post.blocks) {
        if (block.kind === "text") {
          if (typedSomething) await editor.caretToDocumentEnd();
          await editor.typeLines(block.lines, typedSomething);
          typedSomething = true;
        } else {
          await editor.caretToDocumentEnd();
          if (await editor.insertImage(block.path, block.caption)) uploaded += 1;
          else throw new Error(`selector: 사진 업로드 실패 (${block.path})`);
        }
      }
      if (!(await editor.bodyText()).trim()) throw new Error("selector: 본문 입력 실패");
      await editor.typeHashtags(post.hashtags);

      if (this.config.mode !== "publish") {
        const saved = await editor.saveDraft();
        return {
          status: "not_configured",
          errorCode: saved ? "draft_saved" : "draft_save_failed",
          errorSummary: saved
            ? `네이버 임시저장 완료(사진 ${uploaded}장) — 발행은 블로그 '저장된 글'에서 직접 확인 후 진행. 자동 발행은 BARJUNG_NAVER_MODE=publish`
            : "네이버 본문은 입력됐지만 임시저장 버튼을 누르지 못했습니다.",
        };
      }

      const published = await editor.publish(this.config.category);
      if (!published) return { status: "failed", errorCode: "selector_changed", errorSummary: this.config.category ? `발행 레이어에서 카테고리 '${this.config.category}' 를 고르지 못해 발행하지 않았습니다.` : "발행 레이어를 열지 못했습니다." };
      const url = await this.resolveUrl(post.title);
      return { status: "succeeded", publishedUrl: url, errorSummary: url ? undefined : "발행은 눌렀지만 RSS 에서 글 주소를 아직 확인하지 못했습니다(BARJUNG_NAVER_BLOG_ID 확인)." };
    } finally {
      await session.close();
    }
  }
}
