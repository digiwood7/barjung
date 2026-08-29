import { describe, expect, it } from "vitest";
import { composePlatformCopy, transitionTarget } from "./distribution";
import type { DistributionTarget, LegalDisclosure } from "./types";

const disclosure: LegalDisclosure = {
  location: "대구광역시 북구 산격동", contractArea: "26.42㎡", propertyCategory: "다가구주택",
  transactionType: "월세", floor: "4층 중 2층", availableFrom: "즉시 입주", rooms: "방 1, 욕실 1",
  approvalDate: "2020. 11. 06.", parking: "총 6대", maintenance: "월 7만원", direction: "남향",
  lotNumberNotice: "상세 지번 비공개", measurementNotice: "현장 실측과 차이가 있을 수 있습니다.",
};

describe("distribution rules", () => {
  it("always appends the immutable legal block to employee copy", () => {
    const result = composePlatformCopy("naver", "북문 가까운 원룸입니다.", disclosure);
    expect(result.startsWith("북문 가까운 원룸입니다.")).toBe(true);
    expect(result).toContain("공인중개사법 시행령에 따른 명시사항");
  });

  it("refuses a succeeded target transition back to running", () => {
    const done: DistributionTarget = { platform: "naver", status: "succeeded", progress: 100 };
    expect(() => transitionTarget(done, "running")).toThrow("succeeded");
  });
});
