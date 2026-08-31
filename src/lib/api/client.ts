import { createClient } from "@supabase/supabase-js";
import { createDemoRepository, type BarjungRepository, type CrudRepository } from "@/lib/domain/repository";
import type { AppSettings, Customer, Employee, Platform, Property, WorkspaceSnapshot } from "@/lib/domain/types";
import { customers as demoCustomers, employees as demoEmployees, properties as demoProperties } from "@/lib/mock/data";

async function call<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  const payload = await response.json().catch(() => ({})) as T & { message?: string };
  if (!response.ok) throw new Error(payload.message || `요청 실패 (${response.status})`);
  return payload;
}

interface PreparedUpload { name: string; type: string; size: number; path: string; token: string }
interface PreparedMediaJob { jobId: string; bucket: string; uploads: PreparedUpload[] }
interface MediaJobStatus {
  status: "uploading" | "queued" | "running" | "succeeded" | "failed";
  error?: string | null;
  property?: Property | null;
}

function browserStorageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) throw new Error("브라우저 사진 업로드용 Supabase 공개 키가 없습니다.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function uploadMedia(propertyId: string, files: File[]): Promise<Property> {
  const path = `/api/properties/${encodeURIComponent(propertyId)}/media`;
  const prepared = await call<PreparedMediaJob>(path, {
    method: "POST",
    body: JSON.stringify({ action: "prepare", files: files.map((file) => ({ name: file.name, type: file.type, size: file.size })) }),
  });
  const storage = browserStorageClient().storage.from(prepared.bucket);
  for (let index = 0; index < prepared.uploads.length; index += 1) {
    const upload = prepared.uploads[index];
    const { error } = await storage.uploadToSignedUrl(upload.path, upload.token, files[index], { contentType: upload.type });
    if (error) throw new Error(`${upload.name} 원본 전달 실패: ${error.message}`);
  }
  await call(path, { method: "POST", body: JSON.stringify({ action: "queue", jobId: prepared.jobId }) });

  for (let attempt = 0; attempt < 600; attempt += 1) {
    const result = await call<MediaJobStatus>(`${path}?jobId=${encodeURIComponent(prepared.jobId)}`);
    if (result.status === "succeeded" && result.property) return result.property;
    if (result.status === "failed") throw new Error(result.error || "Windows 사진 최적화에 실패했습니다.");
    await new Promise((resolve) => window.setTimeout(resolve, 1000));
  }
  throw new Error("Windows 실행기의 사진 최적화 응답 시간이 초과되었습니다.");
}

function crud<T extends { id: string }>(base: string): CrudRepository<T> {
  return {
    list: () => call<T[]>(base),
    create: (input) => call<T>(base, { method: "POST", body: JSON.stringify(input) }),
    update: (id, patch) => call<T>(`${base}/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) }),
    remove: async (id) => { await call(`${base}/${encodeURIComponent(id)}`, { method: "DELETE" }); },
  };
}

export function createApiRepository(initial?: WorkspaceSnapshot): BarjungRepository {
  let pending = initial;
  return {
    mode: "live",
    properties: crud<Property>("/api/properties"),
    employees: crud<Employee>("/api/employees"),
    customers: crud<Customer>("/api/customers"),
    async loadWorkspace() {
      if (pending) { const snapshot = pending; pending = undefined; return snapshot; }
      return call<WorkspaceSnapshot>("/api/workspace");
    },
    async getProperty(id) {
      try { return await call<Property>(`/api/properties/${encodeURIComponent(id)}`); }
      catch { return null; }
    },
    uploadPropertyMedia: uploadMedia,
    requestDistribution: (propertyId, platforms?: Platform[]) => call<Property>("/api/distribution", { method: "POST", body: JSON.stringify({ propertyId, platforms }) }),
    updateSettings: (patch: Partial<AppSettings>) => call<AppSettings>("/api/settings", { method: "PATCH", body: JSON.stringify(patch) }),
  };
}

export function createDefaultDemoRepository(): BarjungRepository {
  return createDemoRepository({ properties: demoProperties, employees: demoEmployees, customers: demoCustomers });
}

export async function connectRepository(): Promise<BarjungRepository> {
  const response = await fetch("/api/workspace", { cache: "no-store" });
  const payload = await response.json().catch(() => ({})) as WorkspaceSnapshot & { code?: string; message?: string };
  if (response.ok) return createApiRepository(payload);
  if (response.status === 503 && payload.code === "NOT_CONFIGURED") return createDefaultDemoRepository();
  throw new Error(payload.message || `작업 공간 연결 실패 (${response.status})`);
}
