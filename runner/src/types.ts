export type Platform = "naver" | "daangn" | "instagram" | "tiktok" | "youtube";
export type RunnerStatus = "succeeded" | "failed" | "not_configured";

export interface PublishInput {
  targetId: string;
  platform: Platform;
  title: string;
  /** 직원 원고 + 법정 고지 블록을 합친 전체 본문 (하위호환) */
  copy: string;
  imagePaths: string[];
  /** 인스타·틱톡·유튜브 쇼츠 공용 세로 영상 */
  videoPath?: string;
  /** 아래는 플랫폼 템플릿용 부가 정보 (없으면 copy 만으로 게시) */
  employeeCopy?: string;
  legalBlock?: string;
  propertyNumber?: string;
  /** 원룸·투룸·오피스텔 */
  kind?: string;
  /** 동 단위 지역 라벨 (예: 산격동) */
  area?: string;
  /** 만원 단위 */
  deposit?: number;
  rent?: number;
  maintenance?: number;
  officeName?: string;
}

export interface PublishResult {
  status: RunnerStatus;
  publishedUrl?: string;
  errorCode?: string;
  errorSummary?: string;
}

export interface SessionResult { status: "connected" | "expired" | "action_required" | "not_configured" }

export interface PlatformAdapter {
  readonly platform: Platform;
  checkSession(): Promise<SessionResult>;
  publish(input: PublishInput): Promise<PublishResult>;
}

export type AdapterMap = Partial<Record<Platform, PlatformAdapter>>;
