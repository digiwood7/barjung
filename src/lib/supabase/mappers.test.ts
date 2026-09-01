import { describe, expect, it } from "vitest";
import { defaultSettings } from "@/lib/domain/types";
import { agentFromRow, areaLabel, formatRelativeDate, kstDateStamp, parseFollowUp, settingsFromRow, settingsToRow, targetsFromRows, toKstInputValue, wonFromMan, manFromWon } from "./mappers";

const NOW = new Date("2026-08-30T03:00:00.000Z"); // KST 2026-08-30 12:00

describe("mappers", () => {
  it("모든 날짜 판단은 KST 기준이다", () => {
    expect(kstDateStamp(new Date("2026-08-29T16:30:00.000Z"))).toBe("260830"); // UTC 29일 밤 = KST 30일 새벽
    expect(formatRelativeDate("2026-08-30T01:24:00.000Z", NOW)).toBe("오늘 10:24");
    expect(formatRelativeDate("2026-08-29T07:40:00.000Z", NOW)).toBe("어제 16:40");
    expect(formatRelativeDate("2026-08-27T01:00:00.000Z", NOW)).toBe("8월 27일 10:00");
    expect(formatRelativeDate("2025-12-31T15:30:00.000Z", NOW)).toBe("1월 1일 00:30"); // KST 2026-01-01 → 같은 해
    expect(formatRelativeDate("2025-12-30T15:30:00.000Z", NOW)).toBe("2025. 12. 31. 00:30");
  });

  it("다음 확인일 입력을 KST 로 해석하고 datetime-local 값으로 되돌린다", () => {
    expect(parseFollowUp("2026-09-01 14:00")).toBe("2026-09-01T05:00:00.000Z");
    expect(parseFollowUp("2026-09-01")).toBe("2026-08-31T15:00:00.000Z");
    expect(parseFollowUp("일정 미정")).toBeNull();
    expect(parseFollowUp("오늘 17:30")).toBeNull();
    expect(toKstInputValue("2026-09-01T05:00:00.000Z")).toBe("2026-09-01T14:00");
  });

  it("금액은 만원↔원, 주소는 동 단위 라벨", () => {
    expect(wonFromMan(500)).toBe(5_000_000);
    expect(manFromWon(420_000)).toBe(42);
    expect(areaLabel("대구광역시 북구 산격동")).toBe("산격동");
    expect(areaLabel("대구광역시 북구 산격동 481-5")).toBe("산격동");
  });

  it("배포 대상이 없으면 4개 플랫폼 모두 not_requested", () => {
    const targets = targetsFromRows([]);
    expect(targets.map((t) => t.platform)).toEqual(["naver", "instagram", "daangn", "zigbang"]);
    expect(targets.every((t) => t.status === "not_requested")).toBe(true);
  });

  it("실행기는 30초 안 heartbeat 만 온라인으로 본다", () => {
    const base = { id: "a", device_name: "PC", status: "online" as const };
    expect(agentFromRow({ ...base, last_heartbeat_at: new Date(NOW.getTime() - 10_000).toISOString() }, NOW).status).toBe("online");
    expect(agentFromRow({ ...base, last_heartbeat_at: new Date(NOW.getTime() - 120_000).toISOString() }, NOW)).toMatchObject({ status: "offline", label: "오프라인 · 마지막 2분 전" });
    expect(agentFromRow(null, NOW).deviceName).toBe("실행기 미등록");
  });

  it("고객 문의 유형을 설정 JSON에 왕복 저장한다", () => {
    const row = settingsToRow({ ...defaultSettings, inquiryTypes: ["상가", "토지 문의", "상가 문의"] }, "office-1");
    expect(row.platform_settings).toMatchObject({ inquiry_types: ["상가 문의", "토지 문의"] });
    expect(settingsFromRow(row).inquiryTypes).toEqual(["상가 문의", "토지 문의"]);
  });
});
