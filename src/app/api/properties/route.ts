import { readJson, withLive } from "@/lib/api/server";
import type { NewRecord } from "@/lib/domain/repository";
import type { Property } from "@/lib/domain/types";
import { createProperty, loadProperties } from "@/lib/supabase/workspace";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withLive(request, (ctx) => loadProperties(ctx));
}

export async function POST(request: Request) {
  return withLive(request, async (ctx) => createProperty(ctx, await readJson<NewRecord<Property>>(request)));
}
