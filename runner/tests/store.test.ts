import { describe, expect, it } from "vitest";

describe("runner publish payload", () => {
  it("keeps the immutable legal block after the employee copy", () => {
    const employeeCopy = "경북대 북문 도보 3분 원룸입니다.";
    const legalBlock = "공인중개사법 시행령에 따른 명시사항\n소재지: 대구광역시 북구 산격동";
    const payload = `${employeeCopy.trim()}\n\n${legalBlock.trim()}`;
    expect(payload.indexOf(employeeCopy)).toBeLessThan(payload.indexOf(legalBlock));
    expect(payload).toContain("공인중개사법 시행령에 따른 명시사항");
  });
});
