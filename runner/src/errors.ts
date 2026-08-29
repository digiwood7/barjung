export interface ClassifiedError { code: string; retryable: boolean; summary: string }

export function classifyError(error: unknown): ClassifiedError {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("locator") || message.includes("selector")) return { code: "selector_changed", retryable: false, summary: "플랫폼 화면 구성이 변경되었습니다." };
  if (message.includes("login") || message.includes("token") || message.includes("session")) return { code: "auth_expired", retryable: false, summary: "플랫폼 로그인이 만료되었습니다." };
  if (message.includes("captcha") || message.includes("verification")) return { code: "user_action_required", retryable: false, summary: "추가 인증을 브라우저에서 완료해야 합니다." };
  if (message.includes("timeout") || message.includes("network")) return { code: "network", retryable: true, summary: "네트워크 연결을 확인한 뒤 다시 시도합니다." };
  return { code: "unexpected", retryable: false, summary: "플랫폼 작업 중 확인되지 않은 오류가 발생했습니다." };
}
