import { describe, expect, it } from "vitest";
import { buildHashtags, composeNaverPost, splitCopy, stripListMarker } from "../src/adapters/naver/compose.js";
import type { PublishInput } from "../src/types.js";

const legal = ["공인중개사법 시행령에 따른 명시사항", "소재지: 대구광역시 북구 산격동 481-5", "계약면적: 26.42㎡", "방향: 남동향 (주실 창 기준)"].join("\n");

const input: PublishInput = {
  targetId: "t1", platform: "naver", title: "북문 3분, 채광 좋은 분리형 원룸",
  copy: `경북대 북문 도보 3분 원룸입니다.\n1. 채광 좋음\n\n${legal}`,
  imagePaths: ["C:\\tmp\\01.jpg", "C:\\tmp\\02.jpg", "C:\\tmp\\03.jpg"],
  employeeCopy: "경북대 북문 도보 3분 원룸입니다.\n1. 채광 좋음", legalBlock: legal,
  propertyNumber: "260830-01", kind: "원룸", area: "산격동", deposit: 500, rent: 42, maintenance: 7, officeName: "바를정공인중개사사무소",
};
const config = { contactLines: ["문의 카톡 : room5555", "연락처 : 010-0000-0000"], hashtags: ["경북대원룸", "#북문원룸"] };

describe("네이버 글 조립 (기존 블로그 형식 템플릿)", () => {
  it("인사 → 매물번호·조건 → 사진 순서대로 → 원고 → 연락처 → 명시사항 순서로 블록을 만든다", () => {
    const post = composeNaverPost(input, config);
    expect(post.title).toBe("북문 3분, 채광 좋은 분리형 원룸");
    expect(post.blocks.map((b) => b.kind)).toEqual(["text", "image", "image", "image", "text"]);
    const intro = post.blocks[0] as { lines: string[] };
    expect(intro.lines[0]).toBe("안녕하세요~ 바를정공인중개사사무소 입니다.");
    expect(intro.lines[1]).toBe("오늘은 산격동에 위치한 원룸을 가지고 왔습니다.");
    expect(intro.lines).toContain("매물 번호 260830-01");
    expect(intro.lines).toContain("보증금 500만원 월차임 42만원");
    expect(intro.lines).toContain("(관리비 7만원 포함)");
    expect(post.blocks.slice(1, 4).map((b) => (b as { path: string }).path)).toEqual(input.imagePaths);
    const closing = (post.blocks[4] as { lines: string[] }).lines;
    expect(closing[0]).toBe("경북대 북문 도보 3분 원룸입니다.");
    expect(closing[1]).toBe("채광 좋음"); // 자동 목록 트리거 제거
    const legalAt = closing.indexOf("* 공인중개사법 시행령에 따른 명시사항 *");
    expect(legalAt).toBeGreaterThan(closing.indexOf("문의 카톡 : room5555"));
    expect(closing.indexOf("(허위매물근절에 앞장서겠습니다.)")).toBeLessThan(legalAt);
    expect(closing.slice(legalAt + 2)).toEqual(["소재지: 대구광역시 북구 산격동 481-5", "계약면적: 26.42㎡", "방향: 남동향 (주실 창 기준)"]);
    expect(closing[closing.length - 1]).toBe("방향: 남동향 (주실 창 기준)");
  });

  it("해시태그는 지역·유형 자동 + 설정값(# 제거, 중복 제거)", () => {
    expect(buildHashtags(input, config)).toEqual(["대구원룸", "산격동원룸", "경북대원룸", "북문원룸"]);
    expect(buildHashtags(input, { ...config, autoHashtags: false })).toEqual(["경북대원룸", "북문원룸"]);
  });

  it("copy 만 있을 때(하위호환) 명시사항 헤더로 원고와 고지를 가른다", () => {
    const { employeeCopy, legalLines } = splitCopy({ ...input, employeeCopy: undefined, legalBlock: undefined });
    expect(employeeCopy).toBe("경북대 북문 도보 3분 원룸입니다.\n1. 채광 좋음");
    expect(legalLines).toEqual(["소재지: 대구광역시 북구 산격동 481-5", "계약면적: 26.42㎡", "방향: 남동향 (주실 창 기준)"]);
    expect(stripListMarker("- 옵션: 에어컨")).toBe("옵션: 에어컨");
    expect(stripListMarker("2020. 11. 06.")).toBe("2020. 11. 06."); // 날짜는 목록 마커가 아니다 (뒤에 '.'+공백이 붙은 숫자만)
  });

  it("연락처·명시사항이 없으면 그 블록을 넣지 않는다", () => {
    const post = composeNaverPost({ ...input, legalBlock: "", employeeCopy: "짧은 원고", copy: "짧은 원고" }, { contactLines: [], hashtags: [] });
    const closing = (post.blocks[post.blocks.length - 1] as { lines: string[] }).lines;
    expect(closing).toEqual(["짧은 원고", ""]);
    expect(post.hashtags).toEqual(["대구원룸", "산격동원룸"]);
  });
});
