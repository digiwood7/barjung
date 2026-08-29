import type { Customer, DemoSeed, Employee, Property } from "./types";

type NewRecord<T extends { id: string }> = Omit<T, "id">;
type PatchRecord<T extends { id: string }> = Partial<Omit<T, "id">>;

export interface CrudRepository<T extends { id: string }> {
  list(): Promise<T[]>;
  create(input: NewRecord<T>): Promise<T>;
  update(id: string, patch: PatchRecord<T>): Promise<T>;
  remove(id: string): Promise<void>;
}

export interface BarjungRepository {
  properties: CrudRepository<Property>;
  employees: CrudRepository<Employee>;
  customers: CrudRepository<Customer>;
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

function createCrud<T extends { id: string }>(initial: T[], prefix: string): CrudRepository<T> {
  let records = clone(initial);
  return {
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

export function createDemoRepository(seed: DemoSeed): BarjungRepository {
  return {
    properties: createCrud(seed.properties, "property"),
    employees: createCrud(seed.employees, "employee"),
    customers: createCrud(seed.customers, "customer"),
  };
}
