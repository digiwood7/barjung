import type { PublishInput } from "../../types.js";

/**
 * 네이버 블로그 글 조립 — 바를정 기존 글(blog.naver.com/dhroom5555/224369047575) 형식을 고정 템플릿으로 옮긴 것.
 * 런타임 AI 없음(PRD 6절). 인사 → 매물번호·조건 → 사진 순서대로 → 직원 원고 → 문의 연락처 → 명시사항 → 해시태그.
 */
export interface NaverPostConfig {
  /** 문의 줄들 (예: "문의 카톡 : room5555", "연락처 : 010-0000-0000") */
  contactLines: string[];
  /** 고정 해시태그 (# 없이) */
  hashtags: string[];
  /** 매물·지역 기반 자동 해시태그(#대구원룸 #산격동원룸) 생성 여부 */
  autoHashtags?: boolean;
}

export type PostBlock =
  | { kind: "text"; lines: string[] }
  | { kind: "image"; path: string; caption?: string };

export interface NaverPost {
  title: string;
  blocks: PostBlock[];
  hashtags: string[];
}

export const LEGAL_HEADER = "공인중개사법 시행령에 따른 명시사항";
// 1~2자리 번호만 목록으로 본다 — "2020. 11. 06." 같은 날짜 줄은 보존 (DGagent 원본은 \d+ 라 연도를 지웠다)
const LIST_MARKER = /^[ \t]*(?:\d{1,2}[.)]|[-*•·▪◦])[ \t]+/;

/** SmartEditor 는 줄 앞 '1. '/'- ' 를 자동 목록으로 바꾸므로 평문으로 만든다 (DGagent _strip_list_marker 이식) */
export function stripListMarker(line: string): string {
  return line.replace(LIST_MARKER, "");
}

/** copy 에 합쳐진 원고/명시사항을 분리한다 (employeeCopy·legalBlock 이 따로 오면 그대로 사용) */
export function splitCopy(input: PublishInput): { employeeCopy: string; legalLines: string[] } {
  let employeeCopy = input.employeeCopy ?? "";
  let legal = input.legalBlock ?? "";
  if (!input.employeeCopy && !input.legalBlock) {
    const index = input.copy.indexOf(LEGAL_HEADER);
    if (index >= 0) { employeeCopy = input.copy.slice(0, index); legal = input.copy.slice(index); }
    else employeeCopy = input.copy;
  }
  const legalLines = legal.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && line !== LEGAL_HEADER);
  return { employeeCopy: employeeCopy.trim(), legalLines };
}

function textLines(text: string): string[] {
  return text.split(/\r?\n/).map((line) => stripListMarker(line).trimEnd());
}

export function buildHashtags(input: PublishInput, config: NaverPostConfig): string[] {
  const tags: string[] = [];
  if (config.autoHashtags !== false && input.kind) {
    tags.push(`대구${input.kind}`);
    if (input.area) tags.push(`${input.area}${input.kind}`);
  }
  for (const tag of config.hashtags) {
    const clean = tag.replace(/^#/, "").replace(/\s+/g, "").trim();
    if (clean) tags.push(clean);
  }
  return [...new Set(tags)];
}

export function composeNaverPost(input: PublishInput, config: NaverPostConfig): NaverPost {
  const { employeeCopy, legalLines } = splitCopy(input);
  const office = input.officeName?.trim() || "바를정 공인중개사 사무소";
  const kind = input.kind || "매물";
  const blocks: PostBlock[] = [];

  const intro = [
    `안녕하세요~ ${office} 입니다.`,
    input.area ? `오늘은 ${input.area}에 위치한 ${kind}을 가지고 왔습니다.` : `오늘은 ${kind}을 가지고 왔습니다.`,
    "직접 찍은 사진 첨부해드립니다.",
    "", "▼", "▼", "▼", "",
  ];
  if (input.propertyNumber) intro.push(`매물 번호 ${input.propertyNumber}`);
  if (typeof input.deposit === "number" && typeof input.rent === "number") {
    intro.push(`보증금 ${input.deposit.toLocaleString("ko-KR")}만원 월차임 ${input.rent.toLocaleString("ko-KR")}만원`);
    if (typeof input.maintenance === "number" && input.maintenance > 0) intro.push(`(관리비 ${input.maintenance}만원 포함)`);
  }
  blocks.push({ kind: "text", lines: intro });

  for (const path of input.imagePaths) blocks.push({ kind: "image", path });

  const body = employeeCopy ? textLines(employeeCopy) : [];
  const closing = ["", ...config.contactLines.map((line) => line.trim()).filter(Boolean)];
  if (config.contactLines.length) closing.push("", "(허위매물근절에 앞장서겠습니다.)");
  if (legalLines.length) closing.push("", `* ${LEGAL_HEADER} *`, "", ...legalLines);
  blocks.push({ kind: "text", lines: [...body, ...closing] });

  return { title: input.title.trim(), blocks, hashtags: buildHashtags(input, config) };
}
