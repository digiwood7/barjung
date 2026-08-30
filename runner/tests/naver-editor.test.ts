import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NaverBlogAdapter, isNaverEnabled, readNaverConfig } from "../src/adapters/naver/adapter.js";
import { NaverEditor, NaverLoginRequired, assertLoggedIn, normalizeCategory } from "../src/adapters/naver/editor.js";
import { createPlatformAdapters } from "../src/adapters/index.js";
import type { PublishInput } from "../src/types.js";

/** SmartEditor 모형(tests/fixtures) 위에서 실제 Chromium 으로 조작 순서를 검증한다. 실제 네이버 DOM 은 고객 PC headed 검증이 별도로 필요하다. */
const fixtureUrl = pathToFileURL(path.resolve("tests/fixtures/naver-outer.html")).href;

function fakeImage(dir: string, name: string): string {
  const file = path.join(dir, name);
  writeFileSync(file, Buffer.from("89504e470d0a1a0a", "hex"));
  return file;
}

describe("네이버 에디터 조작 (모형 SmartEditor, 실제 Chromium)", () => {
  let browser: Browser;
  let page: Page;
  let imageDir: string;
  beforeAll(async () => { browser = await chromium.launch(); imageDir = mkdtempSync(path.join(tmpdir(), "barjung-naver-")); });
  afterAll(async () => { await browser?.close(); });

  it("로그인 화면으로 튕기면 셀렉터를 기다리지 않고 즉시 auth 오류를 낸다", () => {
    expect(() => assertLoggedIn({ url: () => "https://nid.naver.com/nidlogin.login?mode=form&url=..." })).toThrow(NaverLoginRequired);
    expect(() => assertLoggedIn({ url: () => "https://blog.naver.com/PostWriteForm.naver?blogId=x" })).not.toThrow();
    expect(normalizeCategory("IT\u00a0뉴스 ")).toBe("IT 뉴스");
  });

  it("iframe 스코프 → 팝업 닫기 → 제목·본문 입력 → 사진 순서대로 → 해시태그 → 카테고리 발행", async () => {
    page = await browser.newPage();
    await page.goto(fixtureUrl);
    const editor = await NaverEditor.create(page, { typeSpeed: 50, waitScale: 0.05, modifier: "Control" });
    expect(editor.scope).not.toBe(page); // iframe#mainFrame 안을 잡았다
    expect(await editor.dismissContinuePopup("취소")).toBe(true);
    expect(await editor.scope.locator(".se-popup-alert-confirm").count()).toBe(0);

    await editor.setTitle("북문 3분 원룸");
    expect((await editor.scope.locator(".se-title-text").innerText()).trim()).toBe("북문 3분 원룸");

    await editor.focusBody();
    await editor.typeLines(["안녕하세요~ 바를정 입니다.", "", "매물 번호 260830-01"]);
    await editor.caretToDocumentEnd();
    expect(await editor.insertImage(fakeImage(imageDir, "01.png"), "첫 사진")).toBe(true);
    await editor.caretToDocumentEnd();
    expect(await editor.insertImage(fakeImage(imageDir, "02.png"))).toBe(true);
    await editor.caretToDocumentEnd();
    await editor.typeLines(["직원 원고입니다.", "", "* 공인중개사법 시행령에 따른 명시사항 *", "소재지: 산격동"], true);
    expect(await editor.typeHashtags(["대구원룸", "#산격동원룸"], 1)).toBe(2);

    const images = await editor.scope.locator(".se-component.se-image img").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-name")));
    expect(images).toEqual(["01.png", "02.png"]);
    expect((await editor.scope.locator(".se-caption").first().innerText()).trim()).toBe("첫 사진");
    const body = await editor.bodyText();
    expect(body).toContain("매물 번호 260830-01");
    expect(body.indexOf("직원 원고입니다.")).toBeGreaterThan(body.indexOf("매물 번호 260830-01"));
    expect(body).toContain("소재지: 산격동");
    expect(body).toContain("#대구원룸 #산격동원룸");
    // 사진 아래 새 단락에 원고가 들어갔다 (이미지 위로 새지 않음)
    const lastComponentText = await editor.scope.locator(".se-component.se-text").last().innerText();
    expect(lastComponentText).toContain("직원 원고입니다.");

    expect(await editor.openPublishLayer()).toBe(true);
    expect(await editor.currentCategory()).toBe("게시판");
    expect(await editor.selectCategory("매물 소개")).toBe(true); // nbsp 정규화
    expect(await editor.selectCategory("없는 카테고리")).toBe(false);
    await page.close();
  }, 60_000);

  it("어댑터: 임시저장 모드는 not_configured/draft_saved, 발행 모드는 RSS 로 URL 을 확인해 succeeded", async () => {
    const input: PublishInput = {
      targetId: "t1", platform: "naver", title: "테스트 매물 글", copy: "원고\n\n공인중개사법 시행령에 따른 명시사항\n소재지: 산격동",
      imagePaths: [fakeImage(imageDir, "a.png"), fakeImage(imageDir, "b.png")], employeeCopy: "원고", legalBlock: "공인중개사법 시행령에 따른 명시사항\n소재지: 산격동",
      propertyNumber: "260830-02", kind: "원룸", area: "산격동", deposit: 500, rent: 42, maintenance: 7,
    };
    const session = async () => { const p = await browser.newPage(); return { page: p, close: async () => { await p.close(); } }; };
    const base = { ...readNaverConfig({}), editorUrl: fixtureUrl, editorLoadMs: 300, editorOptions: { typeSpeed: 50, waitScale: 0.05, modifier: "Control" as const }, contactLines: ["연락처 : 010"], hashtags: [] };

    const draft = new NaverBlogAdapter({ ...base, mode: "draft" }, { session });
    expect(await draft.publish(input)).toMatchObject({ status: "not_configured", errorCode: "draft_saved" });

    let resolvedTitle = "";
    const live = new NaverBlogAdapter({ ...base, mode: "publish", category: "매물 소개" }, { session, resolveUrl: async (title) => { resolvedTitle = title; return "https://blog.naver.com/x/1"; } });
    expect(await live.publish(input)).toEqual({ status: "succeeded", publishedUrl: "https://blog.naver.com/x/1", errorSummary: undefined });
    expect(resolvedTitle).toBe("테스트 매물 글");

    const wrongCategory = new NaverBlogAdapter({ ...base, mode: "publish", category: "없는 카테고리" }, { session });
    expect((await wrongCategory.publish(input)).status).toBe("failed"); // 카테고리 못 고르면 발행 안 함
  }, 120_000);

  it("BARJUNG_NAVER_ENABLED 가 true 일 때만 실제 어댑터가 연결된다", () => {
    expect(isNaverEnabled({})).toBe(false);
    expect(createPlatformAdapters({}).naver.constructor.name).toBe("NotConfiguredAdapter");
    expect(createPlatformAdapters({ BARJUNG_NAVER_ENABLED: "true" }).naver.constructor.name).toBe("NaverBlogAdapter");
    const config = readNaverConfig({ BARJUNG_NAVER_MODE: "publish", BARJUNG_NAVER_CONTACT: "문의 카톡 : room5555 | 연락처 : 010-0", BARJUNG_NAVER_HASHTAGS: "대구원룸, 북문원룸", BARJUNG_PLAYWRIGHT_PROFILE_DIR: "C:\\barjung-profiles", BARJUNG_HEADLESS: "false" });
    expect(config.mode).toBe("publish");
    expect(config.contactLines).toEqual(["문의 카톡 : room5555", "연락처 : 010-0"]);
    expect(config.hashtags).toEqual(["대구원룸", "북문원룸"]);
    expect(config.profileDir).toBe(path.join("C:\\barjung-profiles", "naver"));
    expect(config.headless).toBe(false);
  });
});
