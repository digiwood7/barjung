import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "barjung_admin_session";
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 12;

export interface AdminSession {
  adminUserId: string;
  officeId: string;
  username: string;
  expiresAt: number;
}

function sessionSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.BARJUNG_SESSION_SECRET?.trim() || "";
  if (secret.length < 32) throw new Error("BARJUNG_SESSION_SECRET은 32자 이상이어야 합니다.");
  return secret;
}

function signature(payload: string, env?: NodeJS.ProcessEnv): Buffer {
  return createHmac("sha256", sessionSecret(env)).update(payload).digest();
}

export function createAdminSessionToken(
  input: Omit<AdminSession, "expiresAt">,
  env: NodeJS.ProcessEnv = process.env,
  now = Date.now(),
): string {
  const session: AdminSession = { ...input, expiresAt: now + ADMIN_SESSION_MAX_AGE * 1000 };
  const payload = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return `${payload}.${signature(payload, env).toString("base64url")}`;
}

export function verifyAdminSessionToken(
  token: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
  now = Date.now(),
): AdminSession | null {
  if (!token) return null;
  const [payload, encodedSignature, extra] = token.split(".");
  if (!payload || !encodedSignature || extra) return null;
  try {
    const actual = Buffer.from(encodedSignature, "base64url");
    const expected = signature(payload, env);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AdminSession;
    if (!session.adminUserId || !session.officeId || !session.username || session.expiresAt <= now) return null;
    return session;
  } catch {
    return null;
  }
}

export function sessionTokenFromRequest(request: Request): string | undefined {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === ADMIN_SESSION_COOKIE) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

export function isAdminRequestAuthenticated(request: Request, env: NodeJS.ProcessEnv = process.env): boolean {
  return verifyAdminSessionToken(sessionTokenFromRequest(request), env) !== null;
}
