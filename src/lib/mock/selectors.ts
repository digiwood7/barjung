import type { LegalDisclosure, Property } from "./types";

export interface PropertyFilters {
  query?: string;
  type?: string;
  status?: string;
  publish?: "all" | "done" | "failed" | "unpublished";
}

export function filterProperties(items: Property[], filters: PropertyFilters) {
  return items.filter((item) => {
    const query = filters.query?.trim().toLowerCase();
    if (query && !`${item.number} ${item.title} ${item.exactAddress}`.toLowerCase().includes(query)) return false;
    if (filters.type && filters.type !== "전체" && item.type !== filters.type) return false;
    if (filters.status && filters.status !== "전체" && item.status !== filters.status) return false;
    if (filters.publish === "done" && !item.targets.every((target) => target.status === "succeeded")) return false;
    if (filters.publish === "failed" && !item.targets.some((target) => target.status === "failed")) return false;
    if (filters.publish === "unpublished" && !item.targets.every((target) => target.status === "not_requested")) return false;
    return true;
  });
}

export function validateLegalDisclosure(value: LegalDisclosure) {
  const labels: Record<keyof LegalDisclosure, string> = {
    location: "소재지", contractArea: "계약면적", propertyCategory: "중개대상물 종류",
    transactionType: "거래형태", floor: "층수", availableFrom: "입주가능일", rooms: "방/욕실 수",
    approvalDate: "사용승인일", parking: "주차대수", maintenance: "관리비", direction: "방향",
    lotNumberNotice: "지번 공개 안내", measurementNotice: "면적 안내",
  };
  return (Object.keys(labels) as (keyof LegalDisclosure)[])
    .filter((key) => !value[key]?.trim())
    .map((key) => labels[key]);
}
