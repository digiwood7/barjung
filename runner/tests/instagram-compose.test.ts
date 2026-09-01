import { describe, expect, it } from "vitest";
import { buildInstagramHashtags, composeInstagramPost, INSTAGRAM_CAPTION_LIMIT } from "../src/adapters/instagram/compose.js";
import type { PublishInput } from "../src/types.js";

const legal = [
  "공인중개사법 시행령에 따른 명시사항",
  "소재지: 대구광역시 북구 산격동 481-5",
  "계약면적: 26.42㎡",
  "중개대상물 종류: 다가구주택",
  "거래형태: 임대",
  "방향: 남동향 (주실 창 기준)",
].join("\n");

const input: PublishInput = {
  targetId: "instagram-1", platform: "instagram", title: "경북대 북문 채광 좋은 원룸", copy: `직접 보고 온 실매물이에요.\n\n${legal}`,
  imagePaths: ["C:\\tmp\\01.jpg"], employeeCopy: "직접 보고 온 실매물이에요.", legalBlock: legal,
  kind: "원룸", area: "산격동", deposit: 500, rent: 42, maintenance: 7,
};

const config = {
  contactLines: ["📞 문의사항", "💬 카톡 ID : example_kakao"],
  officeLines: ["바를 정 공인중개사 사무소", "등록번호 : 27230-2024-00067"],
  hashtags: ["경북대부동산", "#산격동원룸"],
};

describe("인스타 피드 캡션 조립", () => {
  it("훅 → 금액 → 문의 → 법정 고지 → 사무소 정보 → 해시태그 순서를 지킨다", () => {
    const { caption } = composeInstagramPost(input, config);
    const positions = [
      caption.indexOf("✨ 경북대 북문"), caption.indexOf("보증금 500만 / 월 42만"), caption.indexOf("📞 문의사항"),
      caption.indexOf("* 공인중개사법 시행령에 따른 명시사항 *"), caption.indexOf("등록번호"), caption.indexOf("#대구부동산"),
    ];
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(caption).toContain("관리비 7만 포함");
    expect(caption.length).toBeLessThanOrEqual(INSTAGRAM_CAPTION_LIMIT);
  });

  it("지역·유형 태그와 설정 태그를 중복 없이 만든다", () => {
    expect(buildInstagramHashtags(input, config)).toEqual([
      "대구부동산", "경북대원룸", "바를정공인중개사", "경북대부동산", "산격동원룸", "대구원룸",
    ]);
  });

  it("긴 직원 원고만 줄이고 법정 고지는 보존한다", () => {
    const post = composeInstagramPost({ ...input, employeeCopy: "아주 좋은 매물 ".repeat(400) }, config);
    expect(post.caption.length).toBeLessThanOrEqual(INSTAGRAM_CAPTION_LIMIT);
    expect(post.caption).toContain("소재지: 대구광역시 북구 산격동 481-5");
    expect(post.caption).toContain("등록번호 : 27230-2024-00067");
  });
});
