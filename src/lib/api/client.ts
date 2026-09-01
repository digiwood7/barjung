import { createDemoRepository, type BarjungRepository, type CrudRepository, type MediaUploadProgress } from "@/lib/domain/repository";
import type { AppSettings, Customer, Employee, Platform, Property, WorkspaceSnapshot } from "@/lib/domain/types";
import { customers as demoCustomers, employees as demoEmployees, properties as demoProperties } from "@/lib/mock/data";

async function call<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  const payload = await response.json().catch(() => ({})) as T & { message?: string };
  if (!response.ok) throw new Error(payload.message || `요청 실패 (${response.status})`);
  return payload;
}

interface LocalRunnerHealth { status: "online"; token: string }
interface LocalMediaJob {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  processed: number;
  total: number;
  error?: string | null;
}

const LOCAL_RUNNER_URL = (process.env.NEXT_PUBLIC_BARJUNG_RUNNER_URL || "http://127.0.0.1:43127").replace(/\/$/, "");

async function uploadMedia(propertyId: string, files: File[], onProgress?: (progress: MediaUploadProgress) => void): Promise<Property> {
  let health: LocalRunnerHealth;
  try {
    const response = await fetch(`${LOCAL_RUNNER_URL}/health`, { cache: "no-store" });
    health = await response.json() as LocalRunnerHealth;
    if (!response.ok || health.status !== "online" || !health.token) throw new Error("invalid health response");
  } catch {
    throw new Error("Windows 사진 실행기가 오프라인입니다. 바를정 실행기를 시작한 뒤 다시 저장하세요.");
  }

  const form = new FormData();
  for (const file of files) form.append("photos", file, file.name);
  onProgress?.({ phase: "transferring", processed: 0, total: files.length });
  const queuedResponse = await fetch(`${LOCAL_RUNNER_URL}/media/jobs`, {
    method: "POST",
    headers: { "X-Barjung-Runner-Token": health.token, "X-Barjung-Property-Id": propertyId },
    body: form,
  });
  const queued = await queuedResponse.json().catch(() => ({})) as LocalMediaJob & { error?: string };
  if (!queuedResponse.ok || !queued.id) throw new Error(queued.error || "사진을 Windows 실행기로 전달하지 못했습니다.");
  onProgress?.({ phase: "optimizing", processed: 0, total: queued.total || files.length });

  for (let attempt = 0; attempt < 600; attempt += 1) {
    const response = await fetch(`${LOCAL_RUNNER_URL}/media/jobs/${encodeURIComponent(queued.id)}`, {
      headers: { "X-Barjung-Runner-Token": health.token },
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({})) as LocalMediaJob & { error?: string };
    if (!response.ok) throw new Error(result.error || "사진 최적화 상태를 확인하지 못했습니다.");
    onProgress?.({ phase: result.status === "succeeded" ? "complete" : "optimizing", processed: result.processed, total: result.total });
    if (result.status === "succeeded") return call<Property>(`/api/properties/${encodeURIComponent(propertyId)}`);
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
