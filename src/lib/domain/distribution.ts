import { formatDisclosureBlock } from "./legal-disclosure";
import type { DistributionTarget, LegalDisclosure, Platform, PublishStatus } from "./types";

const transitions: Record<PublishStatus, PublishStatus[]> = {
  not_requested: ["queued", "cancelled"],
  queued: ["running", "cancelled"],
  running: ["succeeded", "failed", "not_configured"],
  succeeded: [],
  failed: ["queued", "cancelled"],
  cancelled: ["queued"],
  not_configured: ["queued", "cancelled"],
};

export function composePlatformCopy(platform: Platform, employeeCopy: string, disclosure: LegalDisclosure): string {
  const copy = employeeCopy.trim();
  if (!copy) throw new Error(`${platform} 게시 원고를 입력해 주세요.`);
  return `${copy}\n\n${formatDisclosureBlock(disclosure)}`;
}

export function transitionTarget(target: DistributionTarget, next: PublishStatus): DistributionTarget {
  if (!transitions[target.status].includes(next)) {
    throw new Error(`${target.status} 상태에서 ${next}(으)로 변경할 수 없습니다.`);
  }
  return {
    ...target,
    status: next,
    progress: next === "succeeded" ? 100 : next === "running" ? Math.max(target.progress, 1) : target.progress,
  };
}
