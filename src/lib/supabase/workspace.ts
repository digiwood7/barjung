import type { SupabaseClient } from "@supabase/supabase-js";
import { formatDisclosureBlock, validateDisclosure } from "@/lib/domain/legal-disclosure";
import type { NewRecord, PatchRecord } from "@/lib/domain/repository";
import { PLATFORMS } from "@/lib/domain/types";
import type { AgentStatus, AppSettings, Customer, Employee, OfficeInfo, Platform, Property, WorkspaceSnapshot } from "@/lib/domain/types";
import {
  type AgentRow, type CustomerRow, type DisclosureRow, type DraftRow, type EmployeeRow, type JobRow, type MediaRow, type OfficeRow,
  type PropertyRow, type SettingsRow, type TargetRow,
  agentFromRow, assembleProperties, customerFromRow, customerToRow, disclosureToRow, employeeFromRow, employeeToRow,
  kindToDb, kstDateStamp, kstMinuteStamp, latestDraftsByPlatform, settingsFromRow, settingsToRow, statusToDb, wonFromMan,
} from "./mappers";

/**
 * 고객 Supabase 를 읽고 쓰는 서버 전용 데이터 서비스.
 * 모든 조회는 office_id 로 한정한 단순 쿼리만 쓰고, 조립은 mappers 의 순수 함수가 맡는다
 * (임베드·FK 힌트에 기대지 않아 가짜 클라이언트로도 그대로 검증된다).
 */
export interface WorkspaceContext {
  client: SupabaseClient;
  officeId: string;
  now?: Date;
}

const nowOf = (ctx: WorkspaceContext) => ctx.now ?? new Date();

function fail(label: string, error: { code?: string; message?: string } | null): never {
  throw new Error(`${label} 실패: ${error?.message || error?.code || "알 수 없는 오류"}`);
}

async function rows<T>(label: string, query: PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>): Promise<T[]> {
  const { data, error } = await query;
  if (error) fail(label, error);
  return (data ?? []) as T[];
}

async function one<T>(label: string, query: PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>): Promise<T | null> {
  const { data, error } = await query;
  if (error) fail(label, error);
  return (data ?? null) as T | null;
}

export async function resolveOfficeId(client: SupabaseClient, env: NodeJS.ProcessEnv = process.env): Promise<string> {
  const configured = env.BARJUNG_OFFICE_ID?.trim();
  if (configured) return configured;
  const office = await one<{ id: string }>("사업장 조회", client.from("offices").select("id").order("created_at", { ascending: true }).limit(1).maybeSingle());
  if (!office) throw new Error("offices 테이블이 비어 있습니다. `supabase db push --include-seed` 로 seed 를 적용하세요.");
  return office.id;
}

// ---------- 조회 ----------
async function loadPropertyRows(ctx: WorkspaceContext, propertyId?: string): Promise<Property[]> {
  const { client, officeId } = ctx;
  let propertyFilter = client.from("properties").select("*").eq("office_id", officeId);
  if (propertyId) propertyFilter = propertyFilter.eq("id", propertyId);
  const [properties, disclosures, media, drafts, jobs, targets, employees] = await Promise.all([
    rows<PropertyRow>("매물 조회", propertyFilter.order("created_at", { ascending: false })),
    rows<DisclosureRow>("법정 고지 조회", client.from("legal_disclosures").select("*").eq("office_id", officeId)),
    rows<MediaRow>("사진 조회", client.from("property_media").select("property_id").eq("office_id", officeId)),
    rows<DraftRow>("원고 조회", client.from("content_drafts").select("id,property_id,platform,employee_copy,legal_block,version").eq("office_id", officeId)),
    rows<JobRow>("배포 작업 조회", client.from("distribution_jobs").select("id,property_id,requested_at").eq("office_id", officeId)),
    rows<TargetRow>("배포 대상 조회", client.from("distribution_targets").select("id,distribution_job_id,platform,status,error_code,error_summary,retry_count,published_url").eq("office_id", officeId)),
    rows<Pick<EmployeeRow, "id" | "name">>("직원 조회", client.from("employees").select("id,name").eq("office_id", officeId)),
  ]);
  return assembleProperties({ properties, disclosures, media, drafts, jobs, targets, employees, now: nowOf(ctx) });
}

export async function loadProperties(ctx: WorkspaceContext): Promise<Property[]> {
  return loadPropertyRows(ctx);
}

export async function getProperty(ctx: WorkspaceContext, id: string): Promise<Property | null> {
  return (await loadPropertyRows(ctx, id))[0] ?? null;
}

export async function loadEmployees(ctx: WorkspaceContext): Promise<Employee[]> {
  const list = await rows<EmployeeRow>("직원 조회", ctx.client.from("employees").select("*").eq("office_id", ctx.officeId).order("created_at", { ascending: true }));
  return list.map(employeeFromRow);
}

export async function loadCustomers(ctx: WorkspaceContext): Promise<Customer[]> {
  const list = await rows<CustomerRow>("고객 조회", ctx.client.from("customers").select("*").eq("office_id", ctx.officeId).order("created_at", { ascending: false }));
  return list.map((row) => customerFromRow(row, nowOf(ctx)));
}

export async function loadSettings(ctx: WorkspaceContext): Promise<AppSettings> {
  const row = await one<SettingsRow>("설정 조회", ctx.client.from("app_settings").select("*").eq("office_id", ctx.officeId).maybeSingle());
  return settingsFromRow(row);
}

export async function loadAgent(ctx: WorkspaceContext): Promise<AgentStatus> {
  const row = await one<AgentRow>("실행기 조회", ctx.client.from("local_agents").select("id,device_name,status,last_heartbeat_at").eq("office_id", ctx.officeId).order("last_heartbeat_at", { ascending: false }).limit(1).maybeSingle());
  return agentFromRow(row, nowOf(ctx));
}

export async function loadOffice(ctx: WorkspaceContext): Promise<OfficeInfo> {
  const row = await one<OfficeRow>("사업장 조회", ctx.client.from("offices").select("id,name,region_label").eq("id", ctx.officeId).maybeSingle());
  if (!row) throw new Error("사업장을 찾을 수 없습니다. BARJUNG_OFFICE_ID 값을 확인하세요.");
  return { id: row.id, name: row.name, regionLabel: row.region_label };
}

export async function loadWorkspace(ctx: WorkspaceContext, readOnly: boolean): Promise<WorkspaceSnapshot> {
  const [office, agent, settings, properties, employees, customers] = await Promise.all([
    loadOffice(ctx), loadAgent(ctx), loadSettings(ctx), loadProperties(ctx), loadEmployees(ctx), loadCustomers(ctx),
  ]);
  return { mode: "live", readOnly, office, agent, settings, properties, employees, customers };
}

// ---------- 매물 ----------
export async function nextPropertyNumber(ctx: WorkspaceContext): Promise<string> {
  const prefix = kstDateStamp(nowOf(ctx));
  const existing = await rows<{ property_number: string }>("매물번호 조회", ctx.client.from("properties").select("property_number").eq("office_id", ctx.officeId));
  const latest = existing.reduce((max, row) => {
    const match = row.property_number.match(new RegExp(`^${prefix}-(\\d+)$`));
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${prefix}-${String(latest + 1).padStart(2, "0")}`;
}

async function resolveEmployeeId(ctx: WorkspaceContext, input: { registeredById?: string | null; registeredBy?: string }): Promise<string | null> {
  if (input.registeredById) return input.registeredById;
  if (!input.registeredBy) return null;
  const match = await one<{ id: string }>("직원 조회", ctx.client.from("employees").select("id").eq("office_id", ctx.officeId).eq("name", input.registeredBy).limit(1).maybeSingle());
  return match?.id ?? null;
}

function draftTexts(input: { copies?: Partial<Record<Platform, string>>; employeeCopy?: string }): Partial<Record<Platform, string>> {
  const result: Partial<Record<Platform, string>> = {};
  for (const platform of PLATFORMS) {
    const text = (input.copies?.[platform] ?? input.employeeCopy ?? "").trim();
    if (text) result[platform] = text;
  }
  return result;
}

function automaticCopy(property: Pick<Property, "title" | "type" | "area" | "publicAddress" | "deposit" | "rent" | "maintenance">, platform: Platform): string {
  const location = property.area || property.publicAddress;
  const terms = `보증금 ${property.deposit}만원 / 월세 ${property.rent}만원 / 관리비 ${property.maintenance}만원`;
  if (platform === "instagram") return `${property.title}\n${location} ${property.type} · ${terms}`;
  if (platform === "daangn") return `${location} ${property.type} 매물입니다.\n${property.title}\n${terms}`;
  if (platform === "zigbang") return `${location} / ${property.type} / ${terms}\n${property.title}`;
  return `${property.title}\n\n${location}에 위치한 ${property.type} 매물입니다.\n${terms}`;
}

function automaticDraftTexts(property: Property): Record<Platform, string> {
  const additions = draftTexts({ copies: property.copies, employeeCopy: property.employeeCopy });
  return Object.fromEntries(PLATFORMS.map((platform) => {
    const base = automaticCopy(property, platform);
    const addition = additions[platform]?.trim();
    return [platform, addition?.startsWith(base) ? addition : addition ? `${base}\n\n${addition}` : base];
  })) as Record<Platform, string>;
}

async function insertDrafts(ctx: WorkspaceContext, propertyId: string, texts: Partial<Record<Platform, string>>, legalBlock: string, createdBy: string | null): Promise<void> {
  const entries = Object.entries(texts) as [Platform, string][];
  if (!entries.length) return;
  const existing = await rows<DraftRow>("원고 조회", ctx.client.from("content_drafts").select("id,property_id,platform,employee_copy,legal_block,version").eq("property_id", propertyId));
  const latest = latestDraftsByPlatform(existing, propertyId);
  const payload = entries
    .filter(([platform, text]) => latest[platform]?.employee_copy !== text || latest[platform]?.legal_block !== legalBlock)
    .map(([platform, text]) => ({
      office_id: ctx.officeId, property_id: propertyId, platform, employee_copy: text, legal_block: legalBlock,
      version: (latest[platform]?.version ?? 0) + 1, created_by: createdBy,
    }));
  if (!payload.length) return;
  const { error } = await ctx.client.from("content_drafts").insert(payload);
  if (error) fail("원고 저장", error);
}

function legalBlockFor(disclosure: Property["disclosure"]): { valid: boolean; block: string } {
  const valid = validateDisclosure(disclosure).length === 0;
  return { valid, block: valid ? formatDisclosureBlock(disclosure) : "" };
}

export async function createProperty(ctx: WorkspaceContext, input: NewRecord<Property>): Promise<Property> {
  if (!input.title?.trim()) throw new Error("매물 제목을 입력하세요.");
  if (!input.exactAddress?.trim()) throw new Error("정확한 주소를 입력하세요.");
  const registeredBy = await resolveEmployeeId(ctx, input);
  const number = input.number?.trim() || await nextPropertyNumber(ctx);
  const row = {
    office_id: ctx.officeId, property_number: number, title: input.title.trim(), property_kind: kindToDb(input.type),
    status: statusToDb(input.status ?? "등록 대기"), exact_address: input.exactAddress.trim(),
    public_address: (input.publicAddress || input.disclosure?.location || input.exactAddress).trim(),
    deposit_won: wonFromMan(input.deposit), monthly_rent_won: wonFromMan(input.rent), maintenance_fee_won: wonFromMan(input.maintenance),
    available_from: input.disclosure?.availableFrom ?? "", direction: input.disclosure?.direction ?? "", registered_by: registeredBy,
  };
  const created = await one<{ id: string }>("매물 저장", ctx.client.from("properties").insert(row).select("id").single());
  if (!created) throw new Error("매물 저장 실패: 응답이 비어 있습니다.");

  const { valid, block } = legalBlockFor(input.disclosure);
  const { error: disclosureError } = await ctx.client.from("legal_disclosures").upsert(disclosureToRow(input.disclosure, { officeId: ctx.officeId, propertyId: created.id }, valid), { onConflict: "property_id" });
  if (disclosureError) fail("법정 고지 저장", disclosureError);
  await insertDrafts(ctx, created.id, draftTexts(input), block, registeredBy);

  const property = await getProperty(ctx, created.id);
  if (!property) throw new Error("저장한 매물을 다시 읽지 못했습니다.");
  return property;
}

export async function updateProperty(ctx: WorkspaceContext, id: string, patch: PatchRecord<Property>): Promise<Property> {
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) row.title = patch.title.trim();
  if (patch.type !== undefined) row.property_kind = kindToDb(patch.type);
  if (patch.status !== undefined) row.status = statusToDb(patch.status);
  if (patch.exactAddress !== undefined) row.exact_address = patch.exactAddress.trim();
  if (patch.publicAddress !== undefined) row.public_address = patch.publicAddress.trim();
  if (patch.deposit !== undefined) row.deposit_won = wonFromMan(patch.deposit);
  if (patch.rent !== undefined) row.monthly_rent_won = wonFromMan(patch.rent);
  if (patch.maintenance !== undefined) row.maintenance_fee_won = wonFromMan(patch.maintenance);
  if (patch.registeredById !== undefined) row.registered_by = patch.registeredById;
  if (patch.disclosure) { row.available_from = patch.disclosure.availableFrom ?? ""; row.direction = patch.disclosure.direction ?? ""; }
  if (Object.keys(row).length) {
    const { error } = await ctx.client.from("properties").update(row).eq("id", id).eq("office_id", ctx.officeId);
    if (error) fail("매물 수정", error);
  }

  const current = await getProperty(ctx, id);
  if (!current) throw new Error("매물을 찾을 수 없습니다.");
  const disclosure = patch.disclosure ?? current.disclosure;
  const { valid, block } = legalBlockFor(disclosure);
  if (patch.disclosure) {
    const { error } = await ctx.client.from("legal_disclosures").upsert(disclosureToRow(disclosure, { officeId: ctx.officeId, propertyId: id }, valid), { onConflict: "property_id" });
    if (error) fail("법정 고지 저장", error);
  }
  if (patch.copies || patch.employeeCopy !== undefined || patch.disclosure) {
    const texts = draftTexts({ copies: patch.copies ?? current.copies, employeeCopy: patch.employeeCopy ?? current.employeeCopy });
    await insertDrafts(ctx, id, texts, block, current.registeredById ?? null);
  }
  const updated = await getProperty(ctx, id);
  if (!updated) throw new Error("수정한 매물을 다시 읽지 못했습니다.");
  return updated;
}

export async function deleteProperty(ctx: WorkspaceContext, id: string): Promise<void> {
  const { error } = await ctx.client.from("properties").delete().eq("id", id).eq("office_id", ctx.officeId);
  if (error) fail("매물 삭제", error);
}

// ---------- 배포 ----------
export async function requestDistribution(ctx: WorkspaceContext, propertyId: string, platforms?: Platform[]): Promise<Property> {
  const property = await getProperty(ctx, propertyId);
  if (!property) throw new Error("매물을 찾을 수 없습니다.");
  const missing = validateDisclosure(property.disclosure);
  if (missing.length) throw new Error(`법정 고지 필수값 누락: ${missing.join(", ")}`);
  const block = formatDisclosureBlock(property.disclosure);
  const selected: Platform[] = platforms?.length
    ? PLATFORMS.filter((platform) => platforms.includes(platform))
    : [...PLATFORMS];
  if (!selected.length) throw new Error("배포할 플랫폼을 선택하세요.");

  const texts = automaticDraftTexts(property);
  await insertDrafts(ctx, propertyId, texts, block, property.registeredById ?? null);
  const drafts = latestDraftsByPlatform(
    await rows<DraftRow>("원고 조회", ctx.client.from("content_drafts").select("id,property_id,platform,employee_copy,legal_block,version").eq("property_id", propertyId)),
    propertyId,
  );

  const settings = await loadSettings(ctx);
  const job = await one<{ id: string }>("배포 작업 생성", ctx.client.from("distribution_jobs").insert({
    office_id: ctx.officeId, property_id: propertyId, mode: settings.publishMode, overall_status: "queued",
    idempotency_key: `${propertyId}:${selected.join("+")}:${kstMinuteStamp(nowOf(ctx))}`, requested_by: property.registeredById ?? null,
  }).select("id").single().then((result) => {
    if (result.error?.code === "23505") return { data: null, error: { code: "23505", message: "같은 매물의 배포를 방금 요청했습니다. 1분 뒤 다시 시도하세요." } };
    return result;
  }));
  if (!job) throw new Error("배포 작업 생성 실패");

  const { error } = await ctx.client.from("distribution_targets").insert(selected.map((platform) => ({
    office_id: ctx.officeId, distribution_job_id: job.id, platform, status: "queued", content_draft_id: drafts[platform]?.id ?? null,
  })));
  if (error) fail("배포 대상 생성", error);

  const updated = await getProperty(ctx, propertyId);
  if (!updated) throw new Error("배포 요청 후 매물을 다시 읽지 못했습니다.");
  return updated;
}

// ---------- 직원 ----------
export async function createEmployee(ctx: WorkspaceContext, input: NewRecord<Employee>): Promise<Employee> {
  if (!input.name?.trim() || !input.phone?.trim()) throw new Error("이름과 전화번호를 입력하세요.");
  const row = await one<EmployeeRow>("직원 등록", ctx.client.from("employees").insert({ office_id: ctx.officeId, employment_status: "active", ...employeeToRow(input) }).select("*").single());
  if (!row) throw new Error("직원 등록 실패");
  return employeeFromRow(row);
}
export async function updateEmployee(ctx: WorkspaceContext, id: string, patch: PatchRecord<Employee>): Promise<Employee> {
  const row = await one<EmployeeRow>("직원 수정", ctx.client.from("employees").update(employeeToRow(patch)).eq("id", id).eq("office_id", ctx.officeId).select("*").single());
  if (!row) throw new Error("직원을 찾을 수 없습니다.");
  return employeeFromRow(row);
}
export async function deleteEmployee(ctx: WorkspaceContext, id: string): Promise<void> {
  const { error } = await ctx.client.from("employees").delete().eq("id", id).eq("office_id", ctx.officeId);
  if (error) fail("직원 삭제", error);
}

// ---------- 고객 ----------
export async function createCustomer(ctx: WorkspaceContext, input: NewRecord<Customer> & { followUpAt?: string | null }): Promise<Customer> {
  if (!input.name?.trim() || !input.phone?.trim()) throw new Error("이름과 전화번호를 입력하세요.");
  const row = await one<CustomerRow>("고객 등록", ctx.client.from("customers").insert({ office_id: ctx.officeId, ...customerToRow(input) }).select("*").single().then((result) => {
    if (result.error?.code === "23505") return { data: null, error: { code: "23505", message: "같은 전화번호의 고객이 이미 있습니다." } };
    return result;
  }));
  if (!row) throw new Error("고객 등록 실패");
  return customerFromRow(row, nowOf(ctx));
}
export async function updateCustomer(ctx: WorkspaceContext, id: string, patch: PatchRecord<Customer> & { followUpAt?: string | null }): Promise<Customer> {
  const row = await one<CustomerRow>("고객 수정", ctx.client.from("customers").update(customerToRow(patch)).eq("id", id).eq("office_id", ctx.officeId).select("*").single());
  if (!row) throw new Error("고객을 찾을 수 없습니다.");
  return customerFromRow(row, nowOf(ctx));
}
export async function deleteCustomer(ctx: WorkspaceContext, id: string): Promise<void> {
  const { error } = await ctx.client.from("customers").delete().eq("id", id).eq("office_id", ctx.officeId);
  if (error) fail("고객 삭제", error);
}

// ---------- 설정 ----------
export async function updateSettings(ctx: WorkspaceContext, patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await loadSettings(ctx);
  const merged: AppSettings = { ...current, ...patch, publicAddressPolicy: { ...current.publicAddressPolicy, ...(patch.publicAddressPolicy ?? {}) } };
  const { error } = await ctx.client.from("app_settings").upsert(settingsToRow(merged, ctx.officeId), { onConflict: "office_id" });
  if (error) fail("설정 저장", error);
  return loadSettings(ctx);
}
