export type Platform = "naver" | "daangn" | "instagram" | "tiktok" | "youtube";
export const PHOTO_PLATFORMS: readonly Platform[] = ["naver", "daangn"];
export const VIDEO_PLATFORMS: readonly Platform[] = ["instagram", "tiktok", "youtube"];
export const PLATFORMS: readonly Platform[] = [...PHOTO_PLATFORMS, ...VIDEO_PLATFORMS];

export type PublishStatus =
  | "not_requested"
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "not_configured";
export type PropertyStatus = "등록 대기" | "검토 완료" | "광고 중" | "계약 진행" | "거래 완료" | "보류" | "종료";
export type PropertyKind = "원룸" | "투룸" | "오피스텔";
export type EmploymentStatus = "재직" | "휴직" | "퇴사";
export type AddressPolicy = "lot" | "district" | "hidden";
export const DEFAULT_INQUIRY_TYPES = ["원룸 문의", "투룸 문의", "오피스텔 문의"] as const;

export function normalizeInquiryTypeLabel(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  return trimmed.endsWith("문의") ? trimmed : `${trimmed} 문의`;
}

export function normalizeInquiryTypes(values: readonly unknown[] | null | undefined): string[] {
  const normalized = (values ?? [])
    .filter((value): value is string => typeof value === "string")
    .map(normalizeInquiryTypeLabel)
    .filter((value, index, all) => value && all.indexOf(value) === index)
    .slice(0, 20);
  return normalized.length ? normalized : [...DEFAULT_INQUIRY_TYPES];
}

export interface DistributionTarget {
  platform: Platform;
  status: PublishStatus;
  progress: number;
  url?: string;
  error?: string;
  errorCode?: string;
  retryCount?: number;
}

export interface LegalDisclosure {
  location: string;
  contractArea: string;
  propertyCategory: string;
  transactionType: string;
  floor: string;
  availableFrom: string;
  rooms: string;
  approvalDate: string;
  parking: string;
  maintenance: string;
  direction: string;
  lotNumberNotice: string;
  measurementNotice: string;
}

export interface Property {
  id: string;
  number: string;
  title: string;
  type: PropertyKind;
  status: PropertyStatus;
  area: string;
  exactAddress: string;
  publicAddress: string;
  /** 만원 단위 */
  deposit: number;
  /** 만원 단위 */
  rent: number;
  /** 만원 단위 */
  maintenance: number;
  registeredBy: string;
  registeredById?: string | null;
  createdAt: string;
  updatedAt?: string;
  photos: number;
  /** 인스타·틱톡·유튜브 쇼츠에 공통으로 사용하는 세로 영상 1개 */
  hasVideo: boolean;
  videoName?: string;
  accent: string;
  employeeCopy?: string;
  copies?: Partial<Record<Platform, string>>;
  disclosure: LegalDisclosure;
  targets: DistributionTarget[];
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  phone: string;
  status: EmploymentStatus;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  interest: string;
  budget: string;
  /** 화면 표시용 문자열 (예: "오늘 17:30" · "일정 미정") */
  followUp: string;
  /** 라이브 모드에서만 채워지는 실제 시각(UTC ISO). null = 미정 */
  followUpAt?: string | null;
  note: string;
}

export interface AppSettings {
  publishMode: "review" | "automatic";
  imageMaxEdge: number;
  imageQuality: number;
  imageTargetKb: number;
  inquiryTypes: string[];
  publicAddressPolicy: Record<Platform, AddressPolicy>;
}

export interface OfficeInfo {
  id: string;
  name: string;
  regionLabel: string;
}

export interface AgentStatus {
  id: string | null;
  deviceName: string;
  status: "online" | "offline" | "degraded";
  lastHeartbeatAt: string | null;
  /** 화면 표시용 (예: "온라인 · 방금 전") */
  label: string;
}

export type PlatformConnectionStatus = "connected" | "expired" | "action_required" | "not_configured";

export interface PlatformConnection {
  platform: Platform;
  status: PlatformConnectionStatus;
  lastCheckedAt: string | null;
}

export type WorkspaceMode = "demo" | "live";

export interface WorkspaceSnapshot {
  mode: WorkspaceMode;
  readOnly: boolean;
  office: OfficeInfo;
  agent: AgentStatus;
  connections?: PlatformConnection[];
  settings: AppSettings;
  properties: Property[];
  employees: Employee[];
  customers: Customer[];
}

export interface DemoSeed {
  properties: Property[];
  employees: Employee[];
  customers: Customer[];
  office?: OfficeInfo;
  agent?: AgentStatus;
  settings?: AppSettings;
}

export const defaultSettings: AppSettings = {
  publishMode: "review",
  imageMaxEdge: 1920,
  imageQuality: 82,
  imageTargetKb: 800,
  inquiryTypes: [...DEFAULT_INQUIRY_TYPES],
  publicAddressPolicy: { naver: "district", daangn: "district", instagram: "district", tiktok: "district", youtube: "district" },
};
