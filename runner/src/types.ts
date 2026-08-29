export type Platform = "naver" | "instagram" | "daangn" | "zigbang";
export type RunnerStatus = "succeeded" | "failed" | "not_configured";

export interface PublishInput {
  targetId: string;
  platform: Platform;
  title: string;
  copy: string;
  imagePaths: string[];
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
