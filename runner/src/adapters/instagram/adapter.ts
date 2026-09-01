import type { BrowserContext, Page } from "playwright";
import type { PlatformAdapter, PublishInput, PublishResult, SessionResult } from "../../types.js";
import { defaultInstagramProfileDir, instagramProfileUrl, openInstagramContext, sleep, verifyInstagramPage } from "./browser.js";
import { composeInstagramPost, type InstagramPostConfig } from "./compose.js";
import { assertInstagramLoggedIn, InstagramEditor, type InstagramEditorOptions } from "./editor.js";

export interface InstagramAdapterConfig extends InstagramPostConfig {
  mode: "draft" | "publish";
  username?: string;
  profileDir: string;
  headless: boolean;
  channel?: string;
  pageLoadMs?: number;
  editorOptions?: InstagramEditorOptions;
}

export interface InstagramSession {
  page: Page;
  close(): Promise<void>;
}

export type InstagramSessionFactory = () => Promise<InstagramSession>;

const split = (value: string | undefined, separator: RegExp) => (value ?? "").split(separator).map((item) => item.trim()).filter(Boolean);

export function readInstagramConfig(env: NodeJS.ProcessEnv = process.env): InstagramAdapterConfig {
  return {
    mode: env.BARJUNG_INSTAGRAM_MODE?.trim() === "publish" ? "publish" : "draft",
    username: env.BARJUNG_INSTAGRAM_USERNAME?.trim().replace(/^@/, "") || undefined,
    contactLines: split(env.BARJUNG_INSTAGRAM_CONTACT, /\|/),
    officeLines: split(env.BARJUNG_INSTAGRAM_OFFICE_LINES, /\|/),
    hashtags: split(env.BARJUNG_INSTAGRAM_HASHTAGS, /[,\s]+/),
    autoHashtags: env.BARJUNG_INSTAGRAM_AUTO_HASHTAGS?.trim().toLowerCase() !== "false",
    profileDir: defaultInstagramProfileDir(env),
    headless: env.BARJUNG_HEADLESS?.trim().toLowerCase() === "true",
    channel: env.BARJUNG_INSTAGRAM_CHANNEL?.trim() || "chrome",
    editorOptions: {
      minDelayMs: Number(env.BARJUNG_INSTAGRAM_MIN_DELAY_MS ?? "350") || 350,
      maxDelayMs: Number(env.BARJUNG_INSTAGRAM_MAX_DELAY_MS ?? "900") || 900,
      typeDelayMs: Number(env.BARJUNG_INSTAGRAM_TYPE_DELAY_MS ?? "24") || 24,
    },
  };
}

export function isInstagramEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.BARJUNG_INSTAGRAM_ENABLED?.trim().toLowerCase() === "true";
}

function defaultSessionFactory(config: InstagramAdapterConfig, headless: boolean): InstagramSessionFactory {
  return async () => {
    const context: BrowserContext = await openInstagramContext({ profileDir: config.profileDir, headless, channel: config.channel });
    const page = await context.newPage();
    return { page, close: async () => { await sleep(1200); await context.close().catch(() => undefined); } };
  };
}

export class InstagramFeedAdapter implements PlatformAdapter {
  readonly platform = "instagram" as const;
  private readonly openPublishSession: InstagramSessionFactory;
  private readonly openCheckSession: InstagramSessionFactory;

  constructor(
    private readonly config: InstagramAdapterConfig,
    overrides: { session?: InstagramSessionFactory; checkSession?: InstagramSessionFactory } = {},
  ) {
    this.openPublishSession = overrides.session ?? defaultSessionFactory(config, config.headless);
    this.openCheckSession = overrides.checkSession ?? defaultSessionFactory(config, true);
  }

  async checkSession(): Promise<SessionResult> {
    const session = await this.openCheckSession();
    try {
      await session.page.goto(instagramProfileUrl(this.config.username), { waitUntil: "domcontentloaded" });
      await sleep(this.config.pageLoadMs ?? 2500);
      const result = await verifyInstagramPage(session.page, this.config.username);
      return { status: result.ok ? "connected" : "expired" };
    } catch {
      return { status: "action_required" };
    } finally {
      await session.close();
    }
  }

  async publish(input: PublishInput): Promise<PublishResult> {
    if (!input.videoPath) return { status: "failed", errorCode: "validation", errorSummary: "인스타 릴스에 올릴 세로 영상이 없습니다." };
    if (!(input.legalBlock || input.copy.includes("공인중개사법 시행령에 따른 명시사항"))) {
      return { status: "failed", errorCode: "validation", errorSummary: "공인중개사법 명시사항이 없어 게시하지 않았습니다." };
    }
    let post;
    try {
      post = composeInstagramPost(input, this.config);
    } catch (error) {
      return { status: "failed", errorCode: "validation", errorSummary: error instanceof Error ? error.message.replace(/^validation:\s*/, "") : "인스타 게시글을 만들지 못했습니다." };
    }

    const session = await this.openPublishSession();
    try {
      const profileUrl = instagramProfileUrl(this.config.username);
      await session.page.goto(profileUrl, { waitUntil: "domcontentloaded" });
      await sleep(this.config.pageLoadMs ?? 2500);
      assertInstagramLoggedIn(session.page);
      const editor = new InstagramEditor(session.page, this.config.editorOptions);
      const duplicate = await editor.findPostByCaption(input.title);
      if (duplicate) return { status: "succeeded", publishedUrl: duplicate, errorSummary: "같은 제목의 기존 게시물을 확인해 중복 게시하지 않았습니다." };
      const before = await editor.profilePostLinks();
      await editor.openNewPost();
      await editor.uploadVideo(input.videoPath);
      await editor.advanceToCaption();
      await editor.setCaption(post.caption);

      if (this.config.mode !== "publish") {
        const saved = await editor.saveDraft();
        return {
          status: "not_configured",
          errorCode: saved ? "draft_saved" : "draft_save_failed",
          errorSummary: saved
            ? "인스타 릴스 임시 저장 완료(세로 영상 1개) — 앱에서 확인 후 BARJUNG_INSTAGRAM_MODE=publish 로 전환하세요."
            : "영상과 문구는 입력했지만 인스타 임시 저장 버튼을 확인하지 못했습니다.",
        };
      }

      if (!(await editor.share())) return { status: "failed", errorCode: "selector_changed", errorSummary: "공유 버튼을 눌렀지만 게시 완료 화면을 확인하지 못했습니다." };
      const publishedUrl = await editor.resolveNewPost(before, profileUrl);
      return {
        status: "succeeded",
        publishedUrl,
        errorSummary: publishedUrl ? undefined : "피드는 게시됐지만 새 게시물 주소를 아직 확인하지 못했습니다.",
      };
    } finally {
      await session.close();
    }
  }
}
