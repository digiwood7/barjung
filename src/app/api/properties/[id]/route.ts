import { readJson, withLive, type RouteParams } from "@/lib/api/server";
import type { PatchRecord } from "@/lib/domain/repository";
import type { Property } from "@/lib/domain/types";
import { deleteProperty, getProperty, updateProperty } from "@/lib/supabase/workspace";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: RouteParams<"id">) {
  const { id } = await params;
  return withLive(request, async (ctx) => {
    const property = await getProperty(ctx, id);
    if (!property) throw new Error("매물을 찾을 수 없습니다.");
    return property;
  });
}

export async function PATCH(request: Request, { params }: RouteParams<"id">) {
  const { id } = await params;
  return withLive(request, async (ctx) => updateProperty(ctx, id, await readJson<PatchRecord<Property>>(request)));
}

export async function DELETE(request: Request, { params }: RouteParams<"id">) {
  const { id } = await params;
  return withLive(request, async (ctx) => { await deleteProperty(ctx, id); return { ok: true }; });
}
