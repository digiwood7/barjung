import { cookies } from "next/headers";
import { BarjungApp } from "@/components/barjung-app";
import { AdminLogin } from "@/components/admin-login";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/session";
import { isRemoteAdminRuntime } from "@/lib/api/server";

export default async function Page() {
  const cookieStore = await cookies();
  if (isRemoteAdminRuntime()) {
    if (!verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) return <AdminLogin />;
  }
  return <BarjungApp />;
}
