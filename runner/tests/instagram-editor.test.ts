import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPlatformAdapters } from "../src/adapters/index.js";
import { InstagramFeedAdapter, readInstagramConfig } from "../src/adapters/instagram/adapter.js";
import { dismissInstagramPostLoginPrompts } from "../src/adapters/instagram/browser.js";
import { InstagramEditor, InstagramLoginRequired, assertInstagramLoggedIn } from "../src/adapters/instagram/editor.js";
import type { PublishInput } from "../src/types.js";

const fixtureUrl = pathToFileURL(path.resolve("tests/fixtures/instagram-create.html")).href;

describe("인스타 피드 작성 조작", () => {
  let browser: Browser;
  let imageDir: string;
  beforeAll(async () => { browser = await chromium.launch(); imageDir = mkdtempSync(path.join(tmpdir(), "barjung-instagram-")); });
  afterAll(async () => { await browser?.close(); });

  const image = (name: string) => {
    const target = path.join(imageDir, name);
    writeFileSync(target, Buffer.from("89504e470d0a1a0a", "hex"));
    return target;
  };

  it("로그인·추가 인증 화면을 즉시 auth 오류로 분류한다", () => {
    expect(() => assertInstagramLoggedIn({ url: () => "https://www.instagram.com/accounts/login/" } as Page)).toThrow(InstagramLoginRequired);
    expect(() => assertInstagramLoggedIn({ url: () => "https://www.instagram.com/challenge/" } as Page)).toThrow(InstagramLoginRequired);
    expect(() => assertInstagramLoggedIn({ url: () => "https://www.instagram.com/example_realty/" } as Page)).not.toThrow();
  });

  it("로그인 정보 저장·알림 중앙 팝업만 자동으로 닫는다", async () => {
    const page = await browser.newPage();
    await page.setContent('<div role="dialog"><p>로그인 정보를 저장하시겠어요?</p><button onclick="this.closest(\'[role=dialog]\').remove()">나중에 하기</button></div>');
    expect(await dismissInstagramPostLoginPrompts(page)).toBe(1);
    expect(await page.getByRole("button", { name: "나중에 하기" }).isVisible()).toBe(false);
    await page.close();
  });

  it("만들기 → 세로 영상 1개 → 다음 2회 → 문구 → 임시 저장을 수행한다", async () => {
    const page = await browser.newPage();
    await page.goto(fixtureUrl);
    const editor = new InstagramEditor(page, { waitScale: 0, typeDelayMs: 0 });
    await editor.openNewPost();
    await editor.uploadVideo(image("vertical.mp4"));
    await editor.advanceToCaption();
    await editor.setCaption("✨ 경북대 원룸\n\n* 공인중개사법 시행령에 따른 명시사항 *");
    expect(await editor.saveDraft()).toBe(true);
    expect(await page.locator("body").getAttribute("data-saved")).toBe("true");
    await page.close();
  });

  it("공유 완료와 새 피드 주소를 확인한다", async () => {
    const page = await browser.newPage();
    await page.goto(fixtureUrl);
    const editor = new InstagramEditor(page, { waitScale: 0, typeDelayMs: 0 });
    const before = await editor.profilePostLinks();
    await editor.openNewPost();
    await editor.uploadVideo(image("share.mp4"));
    await editor.advanceToCaption();
    await editor.setCaption("새 매물 게시글");
    expect(await editor.share()).toBe(true);
    const current = await editor.profilePostLinks();
    expect([...current].find((href) => !before.has(href))).toBe("/example_realty/p/new-post/");
    await page.close();
  });

  it("환경변수로 활성화하며 기본은 draft·headed 이다", () => {
    expect(createPlatformAdapters({}).instagram.constructor.name).toBe("NotConfiguredAdapter");
    expect(createPlatformAdapters({ BARJUNG_INSTAGRAM_ENABLED: "true" }).instagram.constructor.name).toBe("InstagramFeedAdapter");
    const config = readInstagramConfig({ BARJUNG_PLAYWRIGHT_PROFILE_DIR: "C:\\barjung-profiles", BARJUNG_INSTAGRAM_CONTACT: "DM 문의|카톡 example_kakao", BARJUNG_INSTAGRAM_HASHTAGS: "경북대원룸, 산격동원룸" });
    expect(config.mode).toBe("draft");
    expect(config.headless).toBe(false);
    expect(config.profileDir).toBe(path.join("C:\\barjung-profiles", "instagram"));
    expect(config.contactLines).toEqual(["DM 문의", "카톡 example_kakao"]);
    expect(config.hashtags).toEqual(["경북대원룸", "산격동원룸"]);
  });

  it("어댑터 draft 모드는 세로 영상과 캡션을 넣고 임시 저장한다", async () => {
    const page = await browser.newPage();
    const session = async () => ({ page, close: async () => undefined });
    const adapter = new InstagramFeedAdapter({
      ...readInstagramConfig({ BARJUNG_INSTAGRAM_MODE: "draft" }),
      username: undefined,
      pageLoadMs: 0,
      editorOptions: { waitScale: 0, typeDelayMs: 0 },
      contactLines: ["DM 문의"],
      officeLines: ["바를 정 공인중개사 사무소", "등록번호 : 27230-2024-00067"],
      hashtags: [],
    }, { session });
    const input: PublishInput = {
      targetId: "t1", platform: "instagram", title: "새 매물", copy: "소개\n\n공인중개사법 시행령에 따른 명시사항\n소재지: 산격동",
      employeeCopy: "소개", legalBlock: "공인중개사법 시행령에 따른 명시사항\n소재지: 산격동", imagePaths: [], videoPath: image("adapter.mp4"),
      area: "산격동", kind: "원룸", deposit: 500, rent: 40, maintenance: 5,
    };
    const originalGoto = page.goto.bind(page);
    page.goto = ((url: string | URL, options?: Parameters<Page["goto"]>[1]) => originalGoto(fixtureUrl, options)) as Page["goto"];
    await expect(adapter.publish(input)).resolves.toMatchObject({ status: "not_configured", errorCode: "draft_saved" });
    await page.close();
  });
});
