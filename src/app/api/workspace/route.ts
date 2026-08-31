import { NextResponse } from "next/server";
import { liveContext, notConfigured, requireRemoteAdmin } from "@/lib/api/server";
import { isReadOnly } from "@/lib/supabase/server";
import { loadWorkspace } from "@/lib/supabase/workspace";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const denied = requireRemoteAdmin(request);
    if (denied) return denied;
    const ctx = await liveContext();
    if (!ctx) return notConfigured();
    return NextResponse.json(await loadWorkspace(ctx, isReadOnly()));
  } catch (error) {
    const message = error instanceof Error ? error.message : "작업 공간을 읽지 못했습니다.";
    return NextResponse.json({ code: "WORKSPACE_FAILED", message }, { status: 500 });
  }
}
