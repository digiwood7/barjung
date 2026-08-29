import { describe, expect, it } from "vitest";
import { formatDisclosureBlock, validateDisclosure } from "./legal-disclosure";
import type { LegalDisclosure } from "./types";

const valid: LegalDisclosure = {
  location: "대구광역시 북구 산격동",
  contractArea: "26.42㎡",
  propertyCategory: "다가구주택",
  transactionType: "월세",
  floor: "4층 중 2층",
  availableFrom: "즉시 입주",
  rooms: "방 1, 욕실 1",
  approvalDate: "2020. 11. 06.",
  parking: "총 6대",
  maintenance: "월 7만원 (수도·인터넷 포함)",
  direction: "남동향 (주실 창 기준)",
  lotNumberNotice: "중개의뢰인 요청으로 상세 지번 비공개",
  measurementNotice: "면적은 공부상 면적이며 현장 실측과 차이가 있을 수 있습니다.",
};

describe("legal disclosure", () => {
  it("rejects whitespace-only required values", () => {
    expect(validateDisclosure({ ...valid, direction: "  " })).toEqual(["direction"]);
  });

  it("renders every statutory label after the user copy", () => {
    const result = formatDisclosureBlock(valid);
    expect(result).toContain("공인중개사법 시행령에 따른 명시사항");
    expect(result).toContain("소재지: 대구광역시 북구 산격동");
    expect(result).toContain("방향: 남동향 (주실 창 기준)");
    expect(result).toContain("지번 공개 안내: 중개의뢰인 요청으로 상세 지번 비공개");
    expect(result).toContain("면적 안내: 면적은 공부상 면적이며 현장 실측과 차이가 있을 수 있습니다.");
  });
});
