import { readJson, withLive } from "@/lib/api/server";
import type { NewRecord } from "@/lib/domain/repository";
import type { Employee } from "@/lib/domain/types";
import { createEmployee, loadEmployees } from "@/lib/supabase/workspace";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withLive(request, (ctx) => loadEmployees(ctx));
}

export async function POST(request: Request) {
  return withLive(request, async (ctx) => createEmployee(ctx, await readJson<NewRecord<Employee>>(request)));
}
