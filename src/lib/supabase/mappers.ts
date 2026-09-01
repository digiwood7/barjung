import { PLATFORMS, defaultSettings, normalizeInquiryTypes } from "@/lib/domain/types";
import type {
  AddressPolicy, AgentStatus, AppSettings, Customer, DistributionTarget, Employee, EmploymentStatus,
  LegalDisclosure, Platform, Property, PropertyKind, PropertyStatus, PublishStatus,
} from "@/lib/domain/types";

// ---- DB 행 타입 (migration 20260829154401 기준) ----
export type DbPropertyKind = "one_room" | "two_room" | "officetel";
export type DbPropertyStatus = "draft" | "reviewed" | "advertising" | "contracting" | "completed" | "paused" | "closed";
export type DbEmployment = "active" | "leave" | "inactive";

export interface OfficeRow { id: string; name: string; region_label: string }
export interface EmployeeRow { id: string; office_id: string; name: string; phone: string; position: string; employment_status: DbEmployment; created_at?: string }
export interface CustomerRow { id: string; office_id: string; name: string; phone: string; inquiry_type: string; desired_conditions: string; memo: string; follow_up_at: string | null; created_at?: string }
export interface PropertyRow {
  id: string; office_id: string; property_number: string; title: string; property_kind: DbPropertyKind; status: DbPropertyStatus;
  exact_address: string; public_address: string; default_address_policy: AddressPolicy;
  deposit_won: number; monthly_rent_won: number; maintenance_fee_won: number; available_from: string; direction: string;
  registered_by: string | null; created_at: string; updated_at: string;
}
export interface DisclosureRow {
  property_id: string; location: string; contract_area: string; property_category: string; transaction_type: string; floor_text: string;
  available_from: string; rooms_text: string; approval_date: string; parking_text: string; maintenance_text: string; direction_text: string;
  lot_number_notice: string; measurement_notice: string; validation_status: "pending" | "valid" | "invalid";
}
export interface MediaRow { property_id: string }
export interface DraftRow { id: string; property_id: string; platform: Platform | null; employee_copy: string; legal_block: string; version: number }
export interface JobRow { id: string; property_id: string; requested_at: string }
export interface TargetRow { id: string; distribution_job_id: string; platform: Platform; status: PublishStatus; error_code: string | null; error_summary: string | null; retry_count: number; published_url: string | null }
export interface AgentRow { id: string; device_name: string; status: "online" | "offline" | "degraded"; last_heartbeat_at: string | null }
export interface SettingsRow { office_id: string; publish_mode: "review" | "automatic"; image_max_edge: number; image_quality: number; image_target_kb: number; platform_settings: Record<string, unknown> | null }

// ---- 열거값 변환 ----
const kindToDbMap: Record<PropertyKind, DbPropertyKind> = { 원룸: "one_room", 투룸: "two_room", 오피스텔: "officetel" };
const kindFromDbMap: Record<DbPropertyKind, PropertyKind> = { one_room: "원룸", two_room: "투룸", officetel: "오피스텔" };
const statusToDbMap: Record<PropertyStatus, DbPropertyStatus> = { "등록 대기": "draft", "검토 완료": "reviewed", "광고 중": "advertising", "계약 진행": "contracting", "거래 완료": "completed", 보류: "paused", 종료: "closed" };
const statusFromDbMap: Record<DbPropertyStatus, PropertyStatus> = { draft: "등록 대기", reviewed: "검토 완료", advertising: "광고 중", contracting: "계약 진행", completed: "거래 완료", paused: "보류", closed: "종료" };
const employmentToDbMap: Record<EmploymentStatus, DbEmployment> = { 재직: "active", 휴직: "leave", 퇴사: "inactive" };
const employmentFromDbMap: Record<DbEmployment, EmploymentStatus> = { active: "재직", leave: "휴직", inactive: "퇴사" };

export const kindToDb = (kind: PropertyKind) => kindToDbMap[kind];
export const kindFromDb = (kind: DbPropertyKind) => kindFromDbMap[kind] ?? "원룸";
export const statusToDb = (status: PropertyStatus) => statusToDbMap[status];
export const statusFromDb = (status: DbPropertyStatus) => statusFromDbMap[status] ?? "등록 대기";
export const employmentToDb = (status: EmploymentStatus) => employmentToDbMap[status];
export const employmentFromDb = (status: DbEmployment) => employmentFromDbMap[status] ?? "재직";

/** 화면은 만원 단위, DB는 원 단위 */
export const wonFromMan = (man: number) => Math.round((Number(man) || 0) * 10000);
export const manFromWon = (won: number) => Math.round((Number(won) || 0) / 10000);

// ---- 날짜 (모든 표시·판단은 KST) ----
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
function kst(date: Date) {
  const shifted = new Date(date.getTime() + KST_OFFSET_MS);
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth() + 1, d: shifted.getUTCDate(), hh: shifted.getUTCHours(), mm: shifted.getUTCMinutes(), dayIndex: Math.floor(shifted.getTime() / 86_400_000) };
}
const two = (n: number) => String(n).padStart(2, "0");

export function kstDateStamp(now: Date): string {
  const { y, m, d } = kst(now);
  return `${String(y).slice(-2)}${two(m)}${two(d)}`;
}

export function kstMinuteStamp(now: Date): string {
  const { y, m, d, hh, mm } = kst(now);
  return `${y}${two(m)}${two(d)}${two(hh)}${two(mm)}`;
}

export function formatRelativeDate(iso: string | null | undefined, now: Date): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const a = kst(date); const b = kst(now);
  const time = `${two(a.hh)}:${two(a.mm)}`;
  if (a.dayIndex === b.dayIndex) return `오늘 ${time}`;
  if (a.dayIndex === b.dayIndex - 1) return `어제 ${time}`;
  if (a.dayIndex === b.dayIndex + 1) return `내일 ${time}`;
  if (a.y === b.y) return `${a.m}월 ${a.d}일 ${time}`;
  return `${a.y}. ${two(a.m)}. ${two(a.d)}. ${time}`;
}

export function formatFollowUp(iso: string | null | undefined, now: Date): string {
  return formatRelativeDate(iso, now) || "일정 미정";
}

/** "2026-09-01 14:00" · "2026-09-01" · ISO 문자열을 받아 UTC ISO 로 바꾼다. 못 읽으면 null. */
export function parseFollowUp(text: string | null | undefined): string | null {
  const value = (text ?? "").trim();
  if (!value || value === "일정 미정") return null;
  const local = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?$/);
  if (local) {
    const [, y, m, d, hh = "0", mm = "0"] = local;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh) - 9, Number(mm))).toISOString();
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

/** datetime-local 입력값(KST) 으로 변환 */
export function toKstInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const { y, m, d, hh, mm } = kst(date);
  return `${y}-${two(m)}-${two(d)}T${two(hh)}:${two(mm)}`;
}

// ---- 표시 보조 ----
export function areaLabel(publicAddress: string): string {
  const tokens = publicAddress.trim().split(/\s+/).filter(Boolean);
  const named = [...tokens].reverse().find((token) => /(동|읍|면|가|리)$/.test(token));
  return named ?? tokens[tokens.length - 1] ?? "";
}

const accents = [
  "linear-gradient(135deg,#7c9bb3,#e5d9c5)",
  "linear-gradient(135deg,#b7896b,#f2dfbf)",
  "linear-gradient(135deg,#5b6f65,#d7d9cd)",
  "linear-gradient(135deg,#89918f,#d9c9bd)",
  "linear-gradient(135deg,#8a7ca3,#e2d6e8)",
  "linear-gradient(135deg,#6f8fa8,#d5e0e6)",
];
export function accentFor(id: string): string {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return accents[hash % accents.length];
}

// ---- 법정 고지 ----
export function disclosureFromRow(row: DisclosureRow | null | undefined): LegalDisclosure {
  return {
    location: row?.location ?? "", contractArea: row?.contract_area ?? "", propertyCategory: row?.property_category ?? "",
    transactionType: row?.transaction_type ?? "", floor: row?.floor_text ?? "", availableFrom: row?.available_from ?? "",
    rooms: row?.rooms_text ?? "", approvalDate: row?.approval_date ?? "", parking: row?.parking_text ?? "",
    maintenance: row?.maintenance_text ?? "", direction: row?.direction_text ?? "",
    lotNumberNotice: row?.lot_number_notice ?? "", measurementNotice: row?.measurement_notice ?? "",
  };
}

export function disclosureToRow(disclosure: LegalDisclosure, ids: { officeId: string; propertyId: string }, valid: boolean): Omit<DisclosureRow, never> & { office_id: string } {
  return {
    office_id: ids.officeId, property_id: ids.propertyId,
    location: disclosure.location ?? "", contract_area: disclosure.contractArea ?? "", property_category: disclosure.propertyCategory ?? "",
    transaction_type: disclosure.transactionType ?? "", floor_text: disclosure.floor ?? "", available_from: disclosure.availableFrom ?? "",
    rooms_text: disclosure.rooms ?? "", approval_date: disclosure.approvalDate ?? "", parking_text: disclosure.parking ?? "",
    maintenance_text: disclosure.maintenance ?? "", direction_text: disclosure.direction ?? "",
    lot_number_notice: disclosure.lotNumberNotice ?? "", measurement_notice: disclosure.measurementNotice ?? "",
    validation_status: valid ? "valid" : "invalid",
  };
}

// ---- 배포 상태 ----
const progressFor: Record<PublishStatus, number> = { not_requested: 0, queued: 0, running: 50, succeeded: 100, failed: 100, cancelled: 0, not_configured: 100 };

function targetFromRow(row: TargetRow): DistributionTarget {
  return {
    platform: row.platform, status: row.status, progress: progressFor[row.status] ?? 0,
    url: row.published_url ?? undefined, error: row.error_summary ?? undefined,
    errorCode: row.error_code ?? undefined, retryCount: row.retry_count,
  };
}

export function targetsFromRows(rows: TargetRow[]): DistributionTarget[] {
  return PLATFORMS.map((platform) => {
    const row = rows.find((item) => item.platform === platform);
    return row ? targetFromRow(row) : { platform, status: "not_requested", progress: 0 };
  });
}

/** 플랫폼마다 "그 플랫폼을 포함한 가장 최근 작업"의 대상 행을 고른다 (개별 재시도 작업이 다른 플랫폼 상태를 덮지 않게). */
export function latestTargetsForProperty(jobs: JobRow[], targets: TargetRow[], propertyId: string): DistributionTarget[] {
  const ordered = jobs.filter((job) => job.property_id === propertyId).sort((a, b) => (a.requested_at < b.requested_at ? 1 : a.requested_at > b.requested_at ? -1 : 0));
  return PLATFORMS.map((platform) => {
    for (const job of ordered) {
      const row = targets.find((target) => target.distribution_job_id === job.id && target.platform === platform);
      if (row) return targetFromRow(row);
    }
    return { platform, status: "not_requested", progress: 0 };
  });
}

// ---- 매물 조립 (순수 함수: 서버·테스트 공용) ----
export interface PropertySources {
  properties: PropertyRow[];
  disclosures: DisclosureRow[];
  media: MediaRow[];
  drafts: DraftRow[];
  jobs: JobRow[];
  targets: TargetRow[];
  employees: Pick<EmployeeRow, "id" | "name">[];
  now: Date;
}

export function latestDraftsByPlatform(drafts: DraftRow[], propertyId: string): Partial<Record<Platform, DraftRow>> {
  const result: Partial<Record<Platform, DraftRow>> = {};
  for (const draft of drafts) {
    if (draft.property_id !== propertyId || !draft.platform) continue;
    const current = result[draft.platform];
    if (!current || draft.version > current.version) result[draft.platform] = draft;
  }
  return result;
}

export function assembleProperties(sources: PropertySources): Property[] {
  const employeeName = new Map(sources.employees.map((row) => [row.id, row.name]));
  const mediaCount = new Map<string, number>();
  for (const row of sources.media) mediaCount.set(row.property_id, (mediaCount.get(row.property_id) ?? 0) + 1);
  return sources.properties.map((row) => {
    const disclosure = disclosureFromRow(sources.disclosures.find((item) => item.property_id === row.id));
    const drafts = latestDraftsByPlatform(sources.drafts, row.id);
    const copies: Partial<Record<Platform, string>> = {};
    for (const platform of PLATFORMS) if (drafts[platform]) copies[platform] = drafts[platform]!.employee_copy;
    return {
      id: row.id,
      number: row.property_number,
      title: row.title,
      type: kindFromDb(row.property_kind),
      status: statusFromDb(row.status),
      area: areaLabel(row.public_address),
      exactAddress: row.exact_address,
      publicAddress: row.public_address,
      deposit: manFromWon(row.deposit_won),
      rent: manFromWon(row.monthly_rent_won),
      maintenance: manFromWon(row.maintenance_fee_won),
      registeredBy: (row.registered_by && employeeName.get(row.registered_by)) || "미지정",
      registeredById: row.registered_by,
      createdAt: formatRelativeDate(row.created_at, sources.now),
      updatedAt: formatRelativeDate(row.updated_at, sources.now),
      photos: mediaCount.get(row.id) ?? 0,
      accent: accentFor(row.id),
      employeeCopy: copies.naver ?? Object.values(copies)[0],
      copies,
      disclosure,
      targets: latestTargetsForProperty(sources.jobs, sources.targets, row.id),
    };
  });
}

// ---- 직원·고객 ----
export function employeeFromRow(row: EmployeeRow): Employee {
  return { id: row.id, name: row.name, role: row.position, phone: row.phone, status: employmentFromDb(row.employment_status) };
}
export function employeeToRow(input: Partial<Omit<Employee, "id">>): Partial<Omit<EmployeeRow, "id" | "office_id">> {
  const row: Partial<Omit<EmployeeRow, "id" | "office_id">> = {};
  if (input.name !== undefined) row.name = input.name.trim();
  if (input.phone !== undefined) row.phone = input.phone.trim();
  if (input.role !== undefined) row.position = input.role.trim();
  if (input.status !== undefined) row.employment_status = employmentToDb(input.status);
  return row;
}

export function customerFromRow(row: CustomerRow, now: Date): Customer & { followUpAt: string | null } {
  return {
    id: row.id, name: row.name, phone: row.phone, interest: row.inquiry_type,
    budget: row.desired_conditions, note: row.memo,
    followUp: formatFollowUp(row.follow_up_at, now), followUpAt: row.follow_up_at,
  };
}
export function customerToRow(input: Partial<Omit<Customer, "id">> & { followUpAt?: string | null }): Partial<Omit<CustomerRow, "id" | "office_id">> {
  const row: Partial<Omit<CustomerRow, "id" | "office_id">> = {};
  if (input.name !== undefined) row.name = input.name.trim();
  if (input.phone !== undefined) row.phone = input.phone.trim();
  if (input.interest !== undefined) row.inquiry_type = input.interest;
  if (input.budget !== undefined) row.desired_conditions = input.budget;
  if (input.note !== undefined) row.memo = input.note;
  if (input.followUpAt !== undefined) row.follow_up_at = input.followUpAt ? parseFollowUp(input.followUpAt) : null;
  else if (input.followUp !== undefined) row.follow_up_at = parseFollowUp(input.followUp);
  return row;
}

// ---- 설정·실행기 ----
export function settingsFromRow(row: SettingsRow | null | undefined): AppSettings {
  const platformSettings = row?.platform_settings as { address_policy?: Partial<Record<Platform, AddressPolicy>>; inquiry_types?: string[] } | null;
  const policy = platformSettings?.address_policy ?? {};
  return {
    publishMode: row?.publish_mode ?? defaultSettings.publishMode,
    imageMaxEdge: row?.image_max_edge ?? defaultSettings.imageMaxEdge,
    imageQuality: row?.image_quality ?? defaultSettings.imageQuality,
    imageTargetKb: row?.image_target_kb ?? defaultSettings.imageTargetKb,
    inquiryTypes: normalizeInquiryTypes(platformSettings?.inquiry_types),
    publicAddressPolicy: { ...defaultSettings.publicAddressPolicy, ...policy },
  };
}
export function settingsToRow(settings: AppSettings, officeId: string): SettingsRow {
  return {
    office_id: officeId, publish_mode: settings.publishMode, image_max_edge: settings.imageMaxEdge,
    image_quality: settings.imageQuality, image_target_kb: settings.imageTargetKb,
    platform_settings: { address_policy: settings.publicAddressPolicy, inquiry_types: normalizeInquiryTypes(settings.inquiryTypes) },
  };
}

export const AGENT_ONLINE_WINDOW_MS = 30_000;

export function agentFromRow(row: AgentRow | null | undefined, now: Date): AgentStatus {
  if (!row) return { id: null, deviceName: "실행기 미등록", status: "offline", lastHeartbeatAt: null, label: "seed 를 적용하면 등록됩니다" };
  const beat = row.last_heartbeat_at ? new Date(row.last_heartbeat_at).getTime() : NaN;
  const ageMs = Number.isNaN(beat) ? Number.POSITIVE_INFINITY : now.getTime() - beat;
  const fresh = ageMs <= AGENT_ONLINE_WINDOW_MS;
  const status: AgentStatus["status"] = fresh ? (row.status === "degraded" ? "degraded" : "online") : "offline";
  const ago = Number.isFinite(ageMs) ? (ageMs < 60_000 ? `${Math.max(0, Math.round(ageMs / 1000))}초 전` : ageMs < 3_600_000 ? `${Math.round(ageMs / 60_000)}분 전` : formatRelativeDate(row.last_heartbeat_at, now)) : "기록 없음";
  const label = status === "online" ? `온라인 · ${ago}` : status === "degraded" ? `주의 · ${ago}` : `오프라인 · 마지막 ${ago}`;
  return { id: row.id, deviceName: row.device_name, status, lastHeartbeatAt: row.last_heartbeat_at, label };
}
