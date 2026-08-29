export type Platform = "naver" | "instagram" | "daangn" | "zigbang";
export type PublishStatus =
  | "not_requested"
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "not_configured";
export type PropertyStatus = "등록 대기" | "검토 완료" | "광고 중" | "계약 진행" | "거래 완료" | "보류" | "종료";

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
  type: "원룸" | "투룸" | "오피스텔";
  status: PropertyStatus;
  area: string;
  exactAddress: string;
  publicAddress: string;
  deposit: number;
  rent: number;
  maintenance: number;
  registeredBy: string;
  createdAt: string;
  updatedAt?: string;
  photos: number;
  accent: string;
  employeeCopy?: string;
  disclosure: LegalDisclosure;
  targets: DistributionTarget[];
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  phone: string;
  status: "재직" | "휴직";
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  interest: string;
  budget: string;
  followUp: string;
  note: string;
}

export interface AppSettings {
  publishMode: "review" | "automatic";
  imageMaxEdge: number;
  imageQuality: number;
  imageTargetKb: number;
  publicAddressPolicy: Record<Platform, "lot" | "district" | "hidden">;
}

export interface DemoSeed {
  properties: Property[];
  employees: Employee[];
  customers: Customer[];
}
