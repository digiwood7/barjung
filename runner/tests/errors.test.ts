import { describe, expect, it } from "vitest";
import { classifyError } from "../src/errors.js";

describe("runner errors", () => {
  it("marks selector changes retryable only after maintenance", () => {
    expect(classifyError(new Error("locator missing"))).toEqual({ code: "selector_changed", retryable: false, summary: "플랫폼 화면 구성이 변경되었습니다." });
  });

  it("does not expose raw authentication details", () => {
    const result = classifyError(new Error("token abcdef login expired"));
    expect(result).toEqual({ code: "auth_expired", retryable: false, summary: "플랫폼 로그인이 만료되었습니다." });
    expect(result.summary).not.toContain("abcdef");
  });
});
