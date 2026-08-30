export type Platform = "naver" | "instagram" | "daangn" | "zigbang";
export const PLATFORMS: readonly Platform[] = ["naver", "instagram", "daangn", "zigbang"];

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

export type WorkspaceMode = "demo" | "live";

export interface WorkspaceSnapshot {
  mode: WorkspaceMode;
  readOnly: boolean;
  office: OfficeInfo;
  agent: AgentStatus;
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
  publicAddressPolicy: { naver: "district", instagram: "district", daangn: "district", zigbang: "lot" },
};
