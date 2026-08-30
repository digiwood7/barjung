import { readJson, withLive } from "@/lib/api/server";
import type { NewRecord } from "@/lib/domain/repository";
import type { Customer } from "@/lib/domain/types";
import { createCustomer, loadCustomers } from "@/lib/supabase/workspace";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withLive(request, (ctx) => loadCustomers(ctx));
}

export async function POST(request: Request) {
  return withLive(request, async (ctx) => createCustomer(ctx, await readJson<NewRecord<Customer>>(request)));
}
