"use client";

import { Check } from "lucide-react";
import type { DistributionTarget, EmploymentStatus, LegalDisclosure, Platform, PropertyStatus, PublishStatus } from "@/lib/domain/types";

export type Tone = "slate" | "green" | "blue" | "amber" | "red";

export const platformName: Record<Platform, string> = { naver: "네이버", daangn: "당근", instagram: "인스타", tiktok: "틱톡", youtube: "유튜브 쇼츠" };
export const platformInitial: Record<Platform, string> = { naver: "N", daangn: "D", instagram: "I", tiktok: "T", youtube: "Y" };

export const disclosureLabel: Record<keyof LegalDisclosure, string> = {
  location: "소재지", contractArea: "계약면적", propertyCategory: "대상물 종류", transactionType: "거래형태", floor: "해당 층/총 층수",
  availableFrom: "입주가능일", rooms: "방/욕실", approvalDate: "사용승인일", parking: "주차", maintenance: "관리비", direction: "방향",
  lotNumberNotice: "지번 공개 안내", measurementNotice: "면적 안내",
};
/** 건축물대장에서 자동으로 채우는 항목 */
export const automaticDisclosureKeys: ReadonlyArray<keyof LegalDisclosure> = ["location", "propertyCategory", "approvalDate", "parking"];

export function propertyStatusTone(status: PropertyStatus): Tone {
  if (status === "광고 중") return "green";
  if (status === "검토 완료") return "blue";
  if (status === "등록 대기") return "amber";
  return "slate";
}

export function employmentTone(status: EmploymentStatus): Tone {
  return status === "재직" ? "green" : status === "휴직" ? "amber" : "slate";
}

export function targetSummary(target: DistributionTarget): string {
  switch (target.status) {
    case "succeeded": return "게시 완료";
    case "failed": return target.error || "게시 실패";
    case "not_configured": return target.error || "현장 연결 전";
    case "queued": return "실행기 대기 중";
    case "running": return "게시 진행 중";
    case "cancelled": return "취소됨";
    default: return "아직 배포하지 않음";
  }
}

export const terminalStatuses: ReadonlySet<PublishStatus> = new Set(["succeeded", "failed", "cancelled", "not_configured", "not_requested"]);

export function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: Tone }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function PlatformLogo({ platform, compact = false, status }: { platform: Platform; compact?: boolean; status?: PublishStatus }) {
  return (
    <span className={`platform-logo platform-brand ${platform} ${compact ? "compact" : ""} ${status ? `status-${status}` : ""}`} aria-label={platformName[platform]} title={`${platformName[platform]}${status ? ` · ${status}` : ""}`}>
      {platform === "naver" && <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3h6.1l4.7 7.1V3H20v18h-6.1l-4.7-7.1V21H4V3Z" /></svg>}
      {platform === "instagram" && <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5.2" /><circle cx="12" cy="12" r="4.1" /><circle className="solid" cx="17.4" cy="6.7" r="1.15" /></svg>}
      {platform === "daangn" && <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.4 7.9c-3.4.9-5 3.2-4 6.3 1.1 3.5 4.8 7.4 7.1 6.6 2.3-.8 5.5-5.4 6.2-8.8.6-3.1-2.5-5.1-9.3-4.1Z" /><path d="M10.1 8.1C8.7 5.4 9.4 3.2 11.7 2c1.4 2.1 1.2 4.2-.6 6.2m1.1-.4c.6-2.5 2.4-3.8 5-3.5-.1 2.6-1.6 4.1-4.5 4.2" /></svg>}
      {platform === "tiktok" && <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3v10.2a4.3 4.3 0 1 1-3.4-4.2v3.1a1.4 1.4 0 1 0 .5 1.1V3H14Zm0 0c.5 2.7 2.1 4.3 5 4.8v3.1c-2-.2-3.6-.9-5-2.1" /></svg>}
      {platform === "youtube" && <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 8.1a3 3 0 0 0-2.1-2.2C17 5.4 12 5.4 12 5.4s-5 0-6.9.5A3 3 0 0 0 3 8.1 31 31 0 0 0 2.5 12 31 31 0 0 0 3 15.9a3 3 0 0 0 2.1 2.2c1.9.5 6.9.5 6.9.5s5 0 6.9-.5a3 3 0 0 0 2.1-2.2 31 31 0 0 0 .5-3.9 31 31 0 0 0-.5-3.9Z" /><path className="play" d="m10 9 5 3-5 3V9Z" /></svg>}
    </span>
  );
}

export function PlatformDots({ targets, compact = false }: { targets: DistributionTarget[]; compact?: boolean }) {
  return (
    <div className={`platform-dots ${compact ? "compact" : ""}`}>
      {targets.map((target) => (
        <div className={`platform-dot ${target.status}`} title={`${platformName[target.platform]} · ${target.status}`} key={target.platform}>
          {target.status === "succeeded" ? <Check size={11} strokeWidth={3} /> : platformInitial[target.platform]}
        </div>
      ))}
    </div>
  );
}

export function money(value: number): string {
  return value.toLocaleString("ko-KR");
}
