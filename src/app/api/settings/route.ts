import { readJson, withLive } from "@/lib/api/server";
import type { AppSettings } from "@/lib/domain/types";
import { loadSettings, updateSettings } from "@/lib/supabase/workspace";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withLive(request, (ctx) => loadSettings(ctx));
}

export async function PATCH(request: Request) {
  return withLive(request, async (ctx) => updateSettings(ctx, await readJson<Partial<AppSettings>>(request)));
}
