import { readJson, withLive, type RouteParams } from "@/lib/api/server";
import type { PatchRecord } from "@/lib/domain/repository";
import type { Customer } from "@/lib/domain/types";
import { deleteCustomer, updateCustomer } from "@/lib/supabase/workspace";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: RouteParams<"id">) {
  const { id } = await params;
  return withLive(request, async (ctx) => updateCustomer(ctx, id, await readJson<PatchRecord<Customer>>(request)));
}

export async function DELETE(request: Request, { params }: RouteParams<"id">) {
  const { id } = await params;
  return withLive(request, async (ctx) => { await deleteCustomer(ctx, id); return { ok: true }; });
}
