import { readJson, withLive, type RouteParams } from "@/lib/api/server";
import type { PatchRecord } from "@/lib/domain/repository";
import type { Employee } from "@/lib/domain/types";
import { deleteEmployee, updateEmployee } from "@/lib/supabase/workspace";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: RouteParams<"id">) {
  const { id } = await params;
  return withLive(request, async (ctx) => updateEmployee(ctx, id, await readJson<PatchRecord<Employee>>(request)));
}

export async function DELETE(request: Request, { params }: RouteParams<"id">) {
  const { id } = await params;
  return withLive(request, async (ctx) => { await deleteEmployee(ctx, id); return { ok: true }; });
}
