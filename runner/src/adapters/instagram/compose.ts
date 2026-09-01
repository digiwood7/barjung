import type { PublishInput } from "../../types.js";

export const INSTAGRAM_CAPTION_LIMIT = 2200;
export const INSTAGRAM_LEGAL_HEADER = "공인중개사법 시행령에 따른 명시사항";

export interface InstagramPostConfig {
  contactLines: string[];
  officeLines: string[];
  hashtags: string[];
  autoHashtags?: boolean;
}

export interface InstagramPost {
  caption: string;
  hashtags: string[];
}

function cleanLines(value: string | undefined): string[] {
  return (value ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function splitCopy(input: PublishInput): { employeeLines: string[]; legalLines: string[] } {
  let employee = input.employeeCopy ?? "";
  let legal = input.legalBlock ?? "";
  if (!input.employeeCopy && !input.legalBlock) {
    const index = input.copy.indexOf(INSTAGRAM_LEGAL_HEADER);
    if (index >= 0) {
      employee = input.copy.slice(0, index);
      legal = input.copy.slice(index);
    } else {
      employee = input.copy;
    }
  }
  return {
    employeeLines: cleanLines(employee),
    legalLines: cleanLines(legal).filter((line) => line.replace(/^\*+|\*+$/g, "").trim() !== INSTAGRAM_LEGAL_HEADER),
  };
}

function hashtag(value: string): string {
  return value.replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, "").trim();
}

export function buildInstagramHashtags(input: PublishInput, config: InstagramPostConfig): string[] {
  const tags = config.hashtags.map(hashtag).filter(Boolean);
  if (config.autoHashtags !== false) {
    tags.unshift("대구부동산", "경북대원룸", "바를정공인중개사");
    if (input.area) tags.push(`${input.area}${input.kind || "부동산"}`);
    if (input.kind) tags.push(`대구${input.kind}`);
  }
  return [...new Set(tags)].slice(0, 20);
}

function terms(input: PublishInput): string[] {
  if (typeof input.deposit !== "number" || typeof input.rent !== "number") return [];
  const result = [`— 보증금 ${input.deposit.toLocaleString("ko-KR")}만 / 월 ${input.rent.toLocaleString("ko-KR")}만`];
  if (typeof input.maintenance === "number" && input.maintenance > 0) result.push(`(관리비 ${input.maintenance.toLocaleString("ko-KR")}만 포함)`);
  return result;
}

function joinSections(sections: string[][]): string {
  return sections.filter((section) => section.length).map((section) => section.join("\n")).join("\n\n");
}

function truncateLines(lines: string[], maxLength: number): string[] {
  if (maxLength <= 1) return [];
  const text = lines.join("\n");
  if (text.length <= maxLength) return lines;
  const sliced = text.slice(0, Math.max(0, maxLength - 1)).replace(/\s+\S*$/, "").trimEnd();
  return sliced ? [`${sliced}…`] : [];
}

/** 최근 피드의 반복 형식: 훅 → 금액 → 문의 → 법정 명시사항 → 사무소 정보 → 해시태그. */
export function composeInstagramPost(input: PublishInput, config: InstagramPostConfig): InstagramPost {
  const { employeeLines, legalLines } = splitCopy(input);
  const title = input.title.trim();
  const promotional = employeeLines[0] === title ? employeeLines.slice(1) : employeeLines;
  const hashtagValues = buildInstagramHashtags(input, config);
  const fixedSections = [
    title ? [`✨ ${title}`] : [],
    terms(input),
    config.contactLines.length ? ["━━━━━━━━━━━━━━━━━━━━━━━━━", ...config.contactLines.map((line) => line.trim()).filter(Boolean), "━━━━━━━━━━━━━━━━━━━━━━━━━"] : [],
    legalLines.length ? [`* ${INSTAGRAM_LEGAL_HEADER} *`, ...legalLines] : [],
    config.officeLines.map((line) => line.trim()).filter(Boolean),
    hashtagValues.length ? [hashtagValues.map((tag) => `#${tag}`).join(" ")] : [],
  ];
  const fixedCaption = joinSections(fixedSections);
  if (fixedCaption.length > INSTAGRAM_CAPTION_LIMIT) {
    throw new Error(`validation: 인스타 필수 고지와 사무소 정보가 ${INSTAGRAM_CAPTION_LIMIT}자를 초과합니다.`);
  }
  const separatorCost = promotional.length && fixedCaption ? 2 : 0;
  const allowedPromotion = INSTAGRAM_CAPTION_LIMIT - fixedCaption.length - separatorCost;
  const caption = joinSections([
    fixedSections[0],
    truncateLines(promotional, allowedPromotion),
    ...fixedSections.slice(1),
  ]);
  return { caption, hashtags: hashtagValues };
}
