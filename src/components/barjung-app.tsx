"use client";

import { Check, CircleAlert } from "lucide-react";
import { useCallback, useState } from "react";
import type { BarjungRepository } from "@/lib/domain/repository";
import type { Customer, DistributionTarget, Employee, Property } from "@/lib/domain/types";
import { CustomersView } from "./app/customers-view";
import { Dashboard } from "./app/dashboard";
import { DistributionModal } from "./app/distribution-modal";
import { EmployeesView } from "./app/employees-view";
import { EditEntityModal, SimpleFormModal } from "./app/entity-modals";
import { PropertiesView, PropertyDetail } from "./app/properties-view";
import { PropertyWizard } from "./app/property-wizard";
import { SettingsView } from "./app/settings-view";
import { Sidebar, Topbar, type View } from "./app/shell";
import { useWorkspace } from "./app/use-workspace";

type Toast = { message: string; tone: "ok" | "error" };

export function BarjungApp({ repository }: { repository?: BarjungRepository } = {}) {
  const { status, error, snapshot, actions } = useWorkspace(repository);
  const [view, setView] = useState<View>("dashboard");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  const [wizard, setWizard] = useState(false);
  const [distributionRequest, setDistributionRequest] = useState<{ id: string } | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [form, setForm] = useState<{ type: "customer" | "employee" } | null>(null);
  const [editing, setEditing] = useState<Customer | Employee | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = useCallback((message: string, tone: Toast["tone"] = "ok") => { setToast({ message, tone }); window.setTimeout(() => setToast(null), tone === "ok" ? 2500 : 5000); }, []);

  /** 저장 작업 공통: 진행 표시 → 성공 토스트 / 실패는 모달에 남김 */
  const run = useCallback(async (work: () => Promise<void>, success: string) => {
    setBusy(true); setFormError("");
    try { await work(); showToast(success); return true; }
    catch (cause) { const message = cause instanceof Error ? cause.message : "저장하지 못했습니다."; setFormError(message); showToast(message, "error"); return false; }
    finally { setBusy(false); }
  }, [showToast]);

  const updateTargets = useCallback((targets: DistributionTarget[]) => {
    if (!distributionRequest || !snapshot) return;
    const current = snapshot.properties.find((property) => property.id === distributionRequest.id);
    if (current) actions.replaceProperty({ ...current, targets });
  }, [distributionRequest, snapshot, actions]);

  if (status === "error") {
    return <div className="app-loading error"><CircleAlert size={22} /><strong>작업 공간을 불러오지 못했습니다</strong><small>{error}</small></div>;
  }
  if (status === "loading" || !snapshot) {
    return <div className="app-loading"><span className="live-dot" /><strong>작업 공간을 불러오는 중입니다</strong><small>고객 Supabase 연결을 확인합니다.</small></div>;
  }

  const { mode, readOnly, office, agent, settings, properties, employees, customers } = snapshot;
  const selected = selectedId ? properties.find((property) => property.id === selectedId) ?? null : null;
  const editingProperty = editingPropertyId ? properties.find((property) => property.id === editingPropertyId) ?? null : null;
  const distribution = distributionRequest ? properties.find((property) => property.id === distributionRequest.id) ?? null : null;

  return (
    <div className="app-shell">
      <div className={mobileNav ? "mobile-scrim show" : "mobile-scrim"} onClick={() => setMobileNav(false)} />
      <div className={mobileNav ? "sidebar-wrap open" : "sidebar-wrap"}>
        <Sidebar view={view} onView={(next) => { setView(next); setMobileNav(false); }} office={office} agent={agent} employees={employees} propertyCount={properties.length} />
      </div>
      <main>
        <Topbar view={view} mode={mode} readOnly={readOnly} onMenu={() => setMobileNav(true)} />
        <div className="content">
          {view === "dashboard" && <Dashboard properties={properties} onView={setView} onSelect={(property) => setSelectedId(property.id)} onNew={() => { setEditingPropertyId(null); setWizard(true); }} />}
          {view === "properties" && <PropertiesView properties={properties} mode={mode} onSelect={(property) => setSelectedId(property.id)} onNew={() => { setEditingPropertyId(null); setWizard(true); }} />}
          {view === "customers" && <CustomersView customers={customers} onAdd={() => { setFormError(""); setForm({ type: "customer" }); }} onEdit={(customer) => { setFormError(""); setEditing(customer); }} />}
          {view === "employees" && <EmployeesView employees={employees} properties={properties} onAdd={() => { setFormError(""); setForm({ type: "employee" }); }} onEdit={(employee) => { setFormError(""); setEditing(employee); }} />}
          {view === "settings" && <SettingsView settings={settings} agent={agent} office={office} mode={mode} properties={properties} onUpdate={(patch) => run(async () => { await actions.updateSettings(patch); }, "설정을 저장했습니다.")} />}
        </div>
      </main>

      {selected && <PropertyDetail property={selected} office={office} mode={mode} onClose={() => setSelectedId(null)} onPublish={() => { setDistributionRequest({ id: selected.id }); setSelectedId(null); }} onEdit={() => { setFormError(""); setEditingPropertyId(selected.id); setSelectedId(null); setWizard(true); }} />}
      {wizard && <PropertyWizard mode={mode} employees={employees} property={editingProperty ?? undefined} onClose={() => { setWizard(false); if (editingPropertyId) setSelectedId(editingPropertyId); setEditingPropertyId(null); }} onSave={async (input, photos, propertyId) => {
        const creating = !propertyId;
        let saved = propertyId
          ? await actions.updateProperty(propertyId, { ...input, updatedAt: "방금 전" })
          : await actions.createProperty(input);
        try {
          if (mode === "live" && photos.length) saved = await actions.uploadPropertyMedia(saved.id, photos);
        } catch (error) {
          if (creating) await actions.removeProperty(saved.id).catch(() => undefined);
          throw error;
        }
        setEditingPropertyId(saved.id);
        showToast(photos.length ? `매물 저장 완료 · 사진 ${saved.photos}장 최적화` : creating ? "매물 등록을 완료했습니다." : "매물 정보를 저장했습니다.");
        return saved;
      }} onDelete={async (propertyId) => {
        const target = properties.find((item) => item.id === propertyId);
        await actions.removeProperty(propertyId);
        setWizard(false); setEditingPropertyId(null);
        showToast(`${target?.number ?? "매물"} 정보를 삭제했습니다.`);
      }} onPublish={(propertyId) => { setWizard(false); setEditingPropertyId(null); setDistributionRequest({ id: propertyId }); }} />}
      {distribution && <DistributionModal property={distribution} mode={mode} agent={agent} onClose={() => setDistributionRequest(null)} onUpdate={updateTargets} requestDistribution={actions.requestDistribution} getProperty={actions.getProperty} />}
      {form && (
        <SimpleFormModal type={form.type} inquiryTypes={settings.inquiryTypes} busy={busy} error={formError} onClose={() => setForm(null)} onSave={async (values) => {
          const ok = form.type === "customer"
            ? await run(async () => { await actions.createCustomer({ name: values.name, phone: values.phone, interest: values.detail.replace(/\s*문의$/, ""), budget: values.note || "조건 확인 중", followUp: "일정 미정", followUpAt: null, note: values.note || "메모 없음" }); }, `${values.name} 고객을 등록했습니다.`)
            : await run(async () => { await actions.createEmployee({ name: values.name, phone: values.phone, role: values.detail, status: "재직" }); }, `${values.name} 직원을 등록했습니다.`);
          if (ok) setForm(null);
        }} />
      )}
      {editing && (
        <EditEntityModal entity={editing} mode={mode} busy={busy} error={formError} onClose={() => setEditing(null)}
          onSave={async (updated) => {
            const ok = "interest" in updated
              ? await run(async () => { const { id, ...patch } = updated; await actions.updateCustomer(id, patch); }, "변경사항을 저장했습니다.")
              : await run(async () => { const { id, ...patch } = updated; await actions.updateEmployee(id, patch); }, "변경사항을 저장했습니다.");
            if (ok) setEditing(null);
          }}
          onDelete={async () => {
            const ok = "interest" in editing
              ? await run(async () => { await actions.removeCustomer(editing.id); }, `${editing.name} 정보를 삭제했습니다.`)
              : await run(async () => { await actions.removeEmployee(editing.id); }, `${editing.name} 정보를 삭제했습니다.`);
            if (ok) setEditing(null);
          }} />
      )}
      {toast && <div className={`toast ${toast.tone}`}>{toast.tone === "ok" ? <Check size={16} /> : <CircleAlert size={16} />} {toast.message}</div>}
    </div>
  );
}
