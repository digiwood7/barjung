import type {
  AddressLookupInput,
  BuildingRegisterLookupResult,
  BuildingRegisterTitleItem,
  ParcelAddressInput,
} from "./types";

const codePattern = /^\d{5}$/;
const lotPattern = /^\d{1,4}$/;

function requiredText(value: unknown, label: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new Error(`${label} 값이 없습니다.`);
  return text;
}

export function validateParcelAddress(input: ParcelAddressInput): void {
  requiredText(input.address, "주소");
  if (!codePattern.test(input.sigunguCd)) throw new Error("시군구코드는 숫자 5자리여야 합니다.");
  if (!codePattern.test(input.bjdongCd)) throw new Error("법정동코드는 숫자 5자리여야 합니다.");
  if (!lotPattern.test(input.bun)) throw new Error("본번은 숫자 1~4자리여야 합니다.");
  if (input.ji && !lotPattern.test(input.ji)) throw new Error("부번은 숫자 1~4자리여야 합니다.");
}

export function normalizeLotNumber(value: string | undefined): string {
  return (value?.trim() || "0").padStart(4, "0");
}

type JusoResponse = {
  results?: {
    common?: { errorCode?: string; errorMessage?: string };
    juso?: Array<{ admCd?: string; lnbrMnnm?: string; lnbrSlno?: string; mtYn?: string; jibunAddr?: string }> | null;
  };
};

export async function resolveParcelAddress(
  address: string,
  options: { apiKey: string; baseUrl?: string; fetcher?: typeof fetch },
): Promise<ParcelAddressInput> {
  requiredText(address, "주소");
  if (!options.apiKey.trim()) throw new Error("JUSO_API_KEY 환경변수가 필요합니다.");
  const url = new URL(options.baseUrl || "https://business.juso.go.kr/addrlink/addrLinkApi.do");
  url.searchParams.set("confmKey", options.apiKey);
  url.searchParams.set("currentPage", "1");
  url.searchParams.set("countPerPage", "10");
  url.searchParams.set("keyword", address);
  url.searchParams.set("resultType", "json");

  const response = await (options.fetcher || fetch)(url, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`주소 검색 API HTTP ${response.status}`);
  const payload = await response.json() as JusoResponse;
  const common = payload.results?.common;
  if (common?.errorCode && common.errorCode !== "0") throw new Error(`주소 검색 API ${common.errorCode}: ${common.errorMessage || "조회 실패"}`);
  const match = payload.results?.juso?.[0];
  const administrativeCode = match?.admCd?.trim() || "";
  if (!match || !/^\d{10}$/.test(administrativeCode) || !match.lnbrMnnm) throw new Error("정확한 지번 주소를 찾지 못했습니다.");
  return {
    address: match.jibunAddr?.trim() || address,
    sigunguCd: administrativeCode.slice(0, 5),
    bjdongCd: administrativeCode.slice(5),
    platGbCd: match.mtYn === "1" ? "1" : "0",
    bun: match.lnbrMnnm,
    ji: match.lnbrSlno || "0",
  };
}

function toCount(value: string | number | undefined): number {
  const count = Number(value ?? 0);
  return Number.isFinite(count) ? count : 0;
}

function formatApprovalDate(value: string | undefined): string {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits.length === 8 ? `${digits.slice(0, 4)}. ${digits.slice(4, 6)}. ${digits.slice(6, 8)}.` : (value?.trim() || "확인 필요");
}

export function mapBuildingTitle(
  item: BuildingRegisterTitleItem,
  queriedAt = new Date().toISOString(),
): BuildingRegisterLookupResult {
  const above = toCount(item.grndFlrCnt);
  const below = toCount(item.ugrndFlrCnt);
  const parking = toCount(item.indrMechUtcnt) + toCount(item.oudrMechUtcnt)
    + toCount(item.indrAutoUtcnt) + toCount(item.oudrAutoUtcnt);
  const location = requiredText(item.platPlc || item.newPlatPlc, "대지위치");

  return {
    source: "MOLIT_BUILDING_HUB",
    queriedAt,
    managementId: requiredText(item.mgmBldrgstPk, "관리건축물대장PK"),
    address: location,
    roadAddress: item.newPlatPlc?.trim() || "",
    buildingName: item.bldNm?.trim() || "",
    buildingArea: item.totArea ? `${item.totArea}㎡ (건축물 연면적)` : "확인 필요",
    disclosure: {
      location,
      propertyCategory: item.etcPurps?.trim() || item.mainPurpsCdNm?.trim() || "확인 필요",
      floor: `지상 ${above}층${below > 0 ? ` / 지하 ${below}층` : ""}`,
      approvalDate: formatApprovalDate(item.useAprDay),
      parking: `총 ${parking}대`,
    },
    raw: item,
  };
}

type DataGoResponse = {
  response?: {
    header?: { resultCode?: string; resultMsg?: string };
    body?: { items?: { item?: BuildingRegisterTitleItem | BuildingRegisterTitleItem[] } };
  };
};

export async function lookupBuildingRegister(
  input: ParcelAddressInput,
  options: { apiKey: string; baseUrl?: string; fetcher?: typeof fetch },
): Promise<BuildingRegisterLookupResult> {
  validateParcelAddress(input);
  if (!options.apiKey.trim()) throw new Error("BUILDING_REGISTER_API_KEY 환경변수가 필요합니다.");

  const url = new URL(`${(options.baseUrl || "https://apis.data.go.kr/1613000/BldRgstHubService").replace(/\/$/, "")}/getBrTitleInfo`);
  url.searchParams.set("serviceKey", options.apiKey);
  url.searchParams.set("sigunguCd", input.sigunguCd);
  url.searchParams.set("bjdongCd", input.bjdongCd);
  url.searchParams.set("platGbCd", input.platGbCd || "0");
  url.searchParams.set("bun", normalizeLotNumber(input.bun));
  url.searchParams.set("ji", normalizeLotNumber(input.ji));
  url.searchParams.set("_type", "json");
  url.searchParams.set("numOfRows", "20");
  url.searchParams.set("pageNo", "1");

  const response = await (options.fetcher || fetch)(url, { cache: "no-store", signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`건축물대장 API HTTP ${response.status}`);
  const payload = await response.json() as DataGoResponse;
  const header = payload.response?.header;
  if (header?.resultCode && !["00", "000"].includes(header.resultCode)) {
    throw new Error(`건축물대장 API ${header.resultCode}: ${header.resultMsg || "조회 실패"}`);
  }
  const items = payload.response?.body?.items?.item;
  const first = Array.isArray(items) ? items[0] : items;
  if (!first) throw new Error("해당 주소의 건축물대장을 찾지 못했습니다.");
  return mapBuildingTitle(first);
}

export async function lookupBuildingRegisterByAddress(
  input: AddressLookupInput,
  options: {
    buildingApiKey: string;
    jusoApiKey: string;
    buildingBaseUrl?: string;
    jusoBaseUrl?: string;
    fetcher?: typeof fetch;
  },
): Promise<BuildingRegisterLookupResult> {
  const parcel = input.sigunguCd && input.bjdongCd && input.bun
    ? input as ParcelAddressInput
    : await resolveParcelAddress(input.address, { apiKey: options.jusoApiKey, baseUrl: options.jusoBaseUrl, fetcher: options.fetcher });
  return lookupBuildingRegister(parcel, { apiKey: options.buildingApiKey, baseUrl: options.buildingBaseUrl, fetcher: options.fetcher });
}
