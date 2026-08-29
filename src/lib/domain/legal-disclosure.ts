import type { LegalDisclosure } from "./types";

export const disclosureLabels: ReadonlyArray<[keyof LegalDisclosure, string]> = [
  ["location", "소재지"],
  ["contractArea", "계약면적"],
  ["propertyCategory", "중개대상물 종류"],
  ["transactionType", "거래형태"],
  ["floor", "해당 층 / 총 층수"],
  ["availableFrom", "입주가능일"],
  ["rooms", "방 / 욕실"],
  ["approvalDate", "사용승인일"],
  ["parking", "총 주차대수"],
  ["maintenance", "관리비"],
  ["direction", "방향"],
  ["lotNumberNotice", "지번 공개 안내"],
  ["measurementNotice", "면적 안내"],
];

export function validateDisclosure(disclosure: LegalDisclosure): Array<keyof LegalDisclosure> {
  return disclosureLabels
    .map(([key]) => key)
    .filter((key) => !disclosure[key]?.trim());
}

export function formatDisclosureBlock(disclosure: LegalDisclosure): string {
  const missing = validateDisclosure(disclosure);
  if (missing.length) throw new Error(`법정 고지 필수값 누락: ${missing.join(", ")}`);

  return [
    "공인중개사법 시행령에 따른 명시사항",
    ...disclosureLabels.map(([key, label]) => `${label}: ${disclosure[key].trim()}`),
  ].join("\n");
}
