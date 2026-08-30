import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 테스트용 메모리 Supabase 흉내.
 * workspace.ts 가 쓰는 체인(select/insert/update/delete/upsert · eq/in/order/limit · single/maybeSingle)만 구현한다.
 * unique 제약은 uniqueKeys 로 흉내 내며 위반 시 PostgREST 와 같은 code "23505" 를 돌려준다.
 */
type Row = Record<string, unknown>;
type Result = { data: unknown; error: { code?: string; message?: string } | null };

export interface FakeOptions {
  uniqueKeys?: Record<string, string[][]>;
  defaults?: Record<string, () => Row>;
}

let counter = 0;
const uuid = () => (typeof globalThis.crypto?.randomUUID === "function" ? crypto.randomUUID() : `id-${++counter}`);
/** 같은 ms 안의 insert 도 순서가 갈리도록 단조 증가하는 시각 (DB default now() 흉내) */
let clock = Date.now();
const nextStamp = () => new Date(++clock).toISOString();

class Query implements PromiseLike<Result> {
  private op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private payload: Row | Row[] | null = null;
  private upsertOn: string[] = [];
  private filters: Array<(row: Row) => boolean> = [];
  private orders: Array<{ key: string; ascending: boolean }> = [];
  private take: number | null = null;
  private wantSingle: "single" | "maybe" | null = null;
  private returning = false;

  constructor(private readonly db: FakeSupabase, private readonly table: string) {}

  select(_columns?: string) { if (this.op !== "select") this.returning = true; return this; }
  insert(payload: Row | Row[]) { this.op = "insert"; this.payload = payload; return this; }
  update(payload: Row) { this.op = "update"; this.payload = payload; return this; }
  delete() { this.op = "delete"; return this; }
  upsert(payload: Row | Row[], options?: { onConflict?: string }) { this.op = "upsert"; this.payload = payload; this.upsertOn = (options?.onConflict ?? "id").split(",").map((s) => s.trim()); return this; }
  eq(key: string, value: unknown) { this.filters.push((row) => row[key] === value); return this; }
  in(key: string, values: unknown[]) { this.filters.push((row) => values.includes(row[key])); return this; }
  order(key: string, options?: { ascending?: boolean }) { this.orders.push({ key, ascending: options?.ascending ?? true }); return this; }
  limit(n: number) { this.take = n; return this; }
  single() { this.wantSingle = "single"; return this; }
  maybeSingle() { this.wantSingle = "maybe"; return this; }

  then<R1 = Result, R2 = never>(onfulfilled?: ((value: Result) => R1 | PromiseLike<R1>) | null, onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null): Promise<R1 | R2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }

  private matches(row: Row) { return this.filters.every((filter) => filter(row)); }

  private violation(candidate: Row, ignoreId?: unknown): string | null {
    for (const keys of this.db.options.uniqueKeys?.[this.table] ?? []) {
      const clash = this.db.rows(this.table).some((row) => row.id !== ignoreId && keys.every((key) => row[key] === candidate[key]));
      if (clash) return `duplicate key value violates unique constraint (${keys.join(",")})`;
    }
    return null;
  }

  private prepare(row: Row): Row {
    const defaults = this.db.options.defaults?.[this.table]?.() ?? {};
    const now = nextStamp();
    const columnDefaults: Row = this.table === "distribution_jobs" ? { requested_at: now } : {};
    return { id: uuid(), created_at: now, updated_at: now, ...columnDefaults, ...defaults, ...row };
  }

  private run(): Result {
    const table = this.db.rows(this.table);
    let data: Row[] = [];
    if (this.op === "select") {
      data = table.filter((row) => this.matches(row));
    } else if (this.op === "insert") {
      const list = Array.isArray(this.payload) ? this.payload : [this.payload as Row];
      const prepared = list.map((row) => this.prepare(row));
      for (const row of prepared) { const message = this.violation(row); if (message) return { data: null, error: { code: "23505", message } }; }
      table.push(...prepared); data = prepared;
    } else if (this.op === "upsert") {
      const list = Array.isArray(this.payload) ? this.payload : [this.payload as Row];
      for (const row of list) {
        const index = table.findIndex((existing) => this.upsertOn.every((key) => existing[key] === row[key]));
        if (index >= 0) { table[index] = { ...table[index], ...row, updated_at: new Date().toISOString() }; data.push(table[index]); }
        else { const prepared = this.prepare(row); table.push(prepared); data.push(prepared); }
      }
    } else if (this.op === "update") {
      for (let index = 0; index < table.length; index += 1) {
        if (!this.matches(table[index])) continue;
        const next = { ...table[index], ...(this.payload as Row), updated_at: new Date().toISOString() };
        const message = this.violation(next, table[index].id);
        if (message) return { data: null, error: { code: "23505", message } };
        table[index] = next; data.push(next);
      }
    } else if (this.op === "delete") {
      const remaining = table.filter((row) => !this.matches(row));
      data = table.filter((row) => this.matches(row));
      this.db.replace(this.table, remaining);
      this.db.cascade(this.table, data.map((row) => row.id));
    }

    for (const { key, ascending } of [...this.orders].reverse()) {
      data = [...data].sort((a, b) => { const x = String(a[key] ?? ""); const y = String(b[key] ?? ""); return (x < y ? -1 : x > y ? 1 : 0) * (ascending ? 1 : -1); });
    }
    if (this.take !== null) data = data.slice(0, this.take);
    if (this.wantSingle === "single") {
      if (data.length !== 1) return { data: null, error: { code: "PGRST116", message: `expected 1 row, got ${data.length}` } };
      return { data: data[0], error: null };
    }
    if (this.wantSingle === "maybe") return { data: data[0] ?? null, error: null };
    if (this.op !== "select" && !this.returning) return { data: null, error: null };
    return { data, error: null };
  }
}

export class FakeSupabase {
  private tables = new Map<string, Row[]>();
  constructor(readonly options: FakeOptions = {}) {}
  rows(table: string): Row[] { if (!this.tables.has(table)) this.tables.set(table, []); return this.tables.get(table)!; }
  replace(table: string, rows: Row[]) { this.tables.set(table, rows); }
  seed(table: string, rows: Row[]) { this.rows(table).push(...rows.map((row) => { const now = nextStamp(); return { id: uuid(), created_at: now, updated_at: now, ...row }; })); return this; }
  /** properties 삭제 시 하위 행 cascade 흉내 */
  cascade(table: string, ids: unknown[]) {
    if (table !== "properties" || !ids.length) return;
    for (const child of ["legal_disclosures", "content_drafts", "property_media", "distribution_jobs"]) {
      this.replace(child, this.rows(child).filter((row) => !ids.includes(row.property_id)));
    }
  }
  from(table: string) { return new Query(this, table); }
  asClient(): SupabaseClient { return this as unknown as SupabaseClient; }
}

export const barjungUniqueKeys: FakeOptions["uniqueKeys"] = {
  customers: [["office_id", "phone"]],
  properties: [["office_id", "property_number"]],
  distribution_jobs: [["office_id", "idempotency_key"]],
  legal_disclosures: [["property_id"]],
  app_settings: [["office_id"]],
};
