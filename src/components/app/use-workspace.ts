"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { connectRepository } from "@/lib/api/client";
import type { BarjungRepository, MediaUploadProgress, NewRecord, PatchRecord } from "@/lib/domain/repository";
import type { AppSettings, Customer, Employee, Platform, Property, WorkspaceSnapshot } from "@/lib/domain/types";

export const LIVE_POLL_MS = 5000;

export interface WorkspaceActions {
  createProperty(input: NewRecord<Property>): Promise<Property>;
  uploadPropertyMedia(propertyId: string, files: File[], onProgress?: (progress: MediaUploadProgress) => void): Promise<Property>;
  uploadPropertyVideo(propertyId: string, file: File): Promise<Property>;
  updateProperty(id: string, patch: PatchRecord<Property>): Promise<Property>;
  removeProperty(id: string): Promise<void>;
  replaceProperty(property: Property): void;
  createCustomer(input: NewRecord<Customer>): Promise<Customer>;
  updateCustomer(id: string, patch: PatchRecord<Customer>): Promise<Customer>;
  removeCustomer(id: string): Promise<void>;
  createEmployee(input: NewRecord<Employee>): Promise<Employee>;
  updateEmployee(id: string, patch: PatchRecord<Employee>): Promise<Employee>;
  removeEmployee(id: string): Promise<void>;
  requestDistribution(propertyId: string, platforms?: Platform[]): Promise<Property>;
  getProperty(propertyId: string): Promise<Property | null>;
  updateSettings(patch: Partial<AppSettings>): Promise<AppSettings>;
  refresh(): Promise<void>;
}

export interface WorkspaceState {
  status: "loading" | "ready" | "error";
  error: string;
  repository: BarjungRepository | null;
  snapshot: WorkspaceSnapshot | null;
  actions: WorkspaceActions;
}

/** 저장소 연결 + 화면 상태. 라이브 모드는 5초마다 서버 스냅샷으로 갱신한다(실행기 결과 반영). */
export function useWorkspace(provided?: BarjungRepository): WorkspaceState {
  const [repository, setRepository] = useState<BarjungRepository | null>(provided ?? null);
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [error, setError] = useState("");
  const busy = useRef(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const repo = provided ?? await connectRepository();
      const initial = await repo.loadWorkspace();
      if (!alive) return;
      setRepository(repo);
      setSnapshot(initial);
    })().catch((cause: unknown) => { if (alive) setError(cause instanceof Error ? cause.message : "작업 공간을 불러오지 못했습니다."); });
    return () => { alive = false; };
  }, [provided]);

  const refresh = useCallback(async () => {
    if (!repository || busy.current) return;
    busy.current = true;
    try { setSnapshot(await repository.loadWorkspace()); }
    finally { busy.current = false; }
  }, [repository]);

  useEffect(() => {
    if (repository?.mode !== "live") return;
    const timer = window.setInterval(() => { refresh().catch(() => undefined); }, LIVE_POLL_MS);
    return () => window.clearInterval(timer);
  }, [repository, refresh]);

  const actions = useMemo<WorkspaceActions>(() => {
    const need = (): BarjungRepository => { if (!repository) throw new Error("아직 저장소에 연결되지 않았습니다."); return repository; };
    const patch = (update: (current: WorkspaceSnapshot) => WorkspaceSnapshot) => setSnapshot((current) => (current ? update(current) : current));
    return {
      async createProperty(input) { const created = await need().properties.create(input); patch((s) => ({ ...s, properties: [created, ...s.properties] })); return created; },
      async uploadPropertyMedia(propertyId, files, onProgress) { const updated = await need().uploadPropertyMedia(propertyId, files, onProgress); patch((s) => ({ ...s, properties: s.properties.map((p) => (p.id === propertyId ? updated : p)) })); return updated; },
      async uploadPropertyVideo(propertyId, file) { const updated = await need().uploadPropertyVideo(propertyId, file); patch((s) => ({ ...s, properties: s.properties.map((p) => (p.id === propertyId ? updated : p)) })); return updated; },
      async updateProperty(id, input) { const updated = await need().properties.update(id, input); patch((s) => ({ ...s, properties: s.properties.map((p) => (p.id === id ? updated : p)) })); return updated; },
      async removeProperty(id) { await need().properties.remove(id); patch((s) => ({ ...s, properties: s.properties.filter((p) => p.id !== id) })); },
      replaceProperty(property) { patch((s) => ({ ...s, properties: s.properties.map((p) => (p.id === property.id ? property : p)) })); },
      async createCustomer(input) { const created = await need().customers.create(input); patch((s) => ({ ...s, customers: [created, ...s.customers] })); return created; },
      async updateCustomer(id, input) { const updated = await need().customers.update(id, input); patch((s) => ({ ...s, customers: s.customers.map((c) => (c.id === id ? updated : c)) })); return updated; },
      async removeCustomer(id) { await need().customers.remove(id); patch((s) => ({ ...s, customers: s.customers.filter((c) => c.id !== id) })); },
      async createEmployee(input) { const created = await need().employees.create(input); patch((s) => ({ ...s, employees: [created, ...s.employees] })); return created; },
      async updateEmployee(id, input) { const updated = await need().employees.update(id, input); patch((s) => ({ ...s, employees: s.employees.map((e) => (e.id === id ? updated : e)) })); return updated; },
      async removeEmployee(id) { await need().employees.remove(id); patch((s) => ({ ...s, employees: s.employees.filter((e) => e.id !== id) })); },
      async requestDistribution(propertyId, platforms) { const updated = await need().requestDistribution(propertyId, platforms); patch((s) => ({ ...s, properties: s.properties.map((p) => (p.id === propertyId ? updated : p)) })); return updated; },
      getProperty(propertyId) { return need().getProperty(propertyId); },
      async updateSettings(input) { const settings = await need().updateSettings(input); patch((s) => ({ ...s, settings })); return settings; },
      refresh,
    };
  }, [repository, refresh]);

  const status: WorkspaceState["status"] = error ? "error" : snapshot ? "ready" : "loading";
  return { status, error, repository, snapshot, actions };
}
