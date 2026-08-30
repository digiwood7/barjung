import { NextResponse } from "next/server";
import { isRemoteAdminRuntime, liveContext, notConfigured, remoteAccessDisabled } from "@/lib/api/server";
import { isReadOnly } from "@/lib/supabase/server";
import { loadWorkspace } from "@/lib/supabase/workspace";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (isRemoteAdminRuntime()) return remoteAccessDisabled();
    const ctx = await liveContext();
    if (!ctx) return notConfigured();
    return NextResponse.json(await loadWorkspace(ctx, isReadOnly()));
  } catch (error) {
    const message = error instanceof Error ? error.message : "작업 공간을 읽지 못했습니다.";
    return NextResponse.json({ code: "WORKSPACE_FAILED", message }, { status: 500 });
  }
}
