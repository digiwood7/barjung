import { createDemoRepository, type BarjungRepository, type CrudRepository } from "@/lib/domain/repository";
import type { AppSettings, Customer, Employee, Platform, Property, WorkspaceSnapshot } from "@/lib/domain/types";
import { customers as demoCustomers, employees as demoEmployees, properties as demoProperties } from "@/lib/mock/data";

/**
 * 브라우저 → 고객 PC 로컬 Next 서버(/api/*) 호출 저장소.
 * 서버가 NOT_CONFIGURED(503) 를 돌려주면 demo 저장소로 내려간다.
 */
async function call<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  const payload = await response.json().catch(() => ({})) as T & { message?: string };
  if (!response.ok) throw new Error(payload.message || `요청 실패 (${response.status})`);
  return payload;
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
