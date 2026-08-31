import { validateDisclosure } from "./legal-disclosure";
import {
  PLATFORMS,
  defaultSettings,
  type AgentStatus,
  type AppSettings,
  type Customer,
  type DemoSeed,
  type Employee,
  type OfficeInfo,
  type Platform,
  type Property,
  type WorkspaceMode,
  type WorkspaceSnapshot,
} from "./types";

export type NewRecord<T extends { id: string }> = Omit<T, "id">;
export type PatchRecord<T extends { id: string }> = Partial<Omit<T, "id">>;

export interface CrudRepository<T extends { id: string }> {
  list(): Promise<T[]>;
  create(input: NewRecord<T>): Promise<T>;
  update(id: string, patch: PatchRecord<T>): Promise<T>;
  remove(id: string): Promise<void>;
}

/**
 * 화면이 사용하는 유일한 데이터 경계.
 * demo = 브라우저 메모리, live = 고객 PC 로컬 서버(/api/*)를 거쳐 고객 Supabase.
 */
export interface BarjungRepository {
  readonly mode: WorkspaceMode;
  loadWorkspace(): Promise<WorkspaceSnapshot>;
  properties: CrudRepository<Property>;
  employees: CrudRepository<Employee>;
  customers: CrudRepository<Customer>;
  getProperty(id: string): Promise<Property | null>;
  /** 로컬 Python으로 사진을 최적화한 뒤 고객 Storage에 저장한다. */
  uploadPropertyMedia(propertyId: string, files: File[]): Promise<Property>;
  /** 플랫폼 배포 작업을 만든다(생략하면 4개 전부). 라이브 모드에서는 Windows 실행기가 큐를 가져간다. */
  requestDistribution(propertyId: string, platforms?: Platform[]): Promise<Property>;
  updateSettings(patch: Partial<AppSettings>): Promise<AppSettings>;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function nextId(prefix: string): string {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${id}`;
}

function createCrud<T extends { id: string }>(initial: T[], prefix: string): CrudRepository<T> & { snapshot(): T[] } {
  let records = clone(initial);
  return {
    snapshot() { return clone(records); },
    async list() { return clone(records); },
    async create(input) {
      const record = { ...clone(input), id: nextId(prefix) } as T;
      records = [record, ...records];
      return clone(record);
    },
    async update(id, patch) {
      const index = records.findIndex((record) => record.id === id);
      if (index < 0) throw new Error(`${prefix} 레코드를 찾을 수 없습니다.`);
      records[index] = { ...records[index], ...clone(patch), id };
      return clone(records[index]);
    },
    async remove(id) {
      const next = records.filter((record) => record.id !== id);
      if (next.length === records.length) throw new Error(`${prefix} 레코드를 찾을 수 없습니다.`);
      records = next;
    },
  };
}

export const demoOffice: OfficeInfo = { id: "demo-office", name: "바를정공인중개사사무소", regionLabel: "경북대 캠퍼스 권역" };
export const demoAgent: AgentStatus = { id: null, deviceName: "BARJUNG-OFFICE-01", status: "online", lastHeartbeatAt: null, label: "온라인 · 데모" };

export function createDemoRepository(seed: DemoSeed): BarjungRepository {
  const properties = createCrud(seed.properties, "property");
  const employees = createCrud(seed.employees, "employee");
  const customers = createCrud(seed.customers, "customer");
  let settings = clone(seed.settings ?? defaultSettings);
  const office = seed.office ?? demoOffice;
  const agent = seed.agent ?? demoAgent;

  return {
    mode: "demo",
    properties,
    employees,
    customers,
    async loadWorkspace() {
      return {
        mode: "demo",
        readOnly: false,
        office: clone(office),
        agent: clone(agent),
        settings: clone(settings),
        properties: properties.snapshot(),
        employees: employees.snapshot(),
        customers: customers.snapshot(),
      };
    },
    async getProperty(id) {
      return (await properties.list()).find((item) => item.id === id) ?? null;
    },
    async uploadPropertyMedia(propertyId, files) {
      const property = await this.getProperty(propertyId);
      if (!property) throw new Error("매물을 찾을 수 없습니다.");
      return properties.update(propertyId, { photos: files.length });
    },
    async requestDistribution(propertyId, platforms) {
      const property = await this.getProperty(propertyId);
      if (!property) throw new Error("매물을 찾을 수 없습니다.");
      const missing = validateDisclosure(property.disclosure);
      if (missing.length) throw new Error(`법정 고지 필수값 누락: ${missing.join(", ")}`);
      const selected = platforms?.length ? platforms : [...PLATFORMS];
      return properties.update(propertyId, {
        targets: property.targets.map((target) => selected.includes(target.platform) ? { platform: target.platform, status: "queued", progress: 0 } : target),
      });
    },
    async updateSettings(patch) {
      settings = { ...settings, ...clone(patch), publicAddressPolicy: { ...settings.publicAddressPolicy, ...(patch.publicAddressPolicy ?? {}) } };
      return clone(settings);
    },
  };
}
