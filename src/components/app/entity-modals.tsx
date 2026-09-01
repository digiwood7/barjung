"use client";

import { Check, X } from "lucide-react";
import { useState } from "react";
import { DEFAULT_INQUIRY_TYPES, PLATFORMS } from "@/lib/domain/types";
import type { Customer, Employee, Property, WorkspaceMode } from "@/lib/domain/types";
import { toKstInputValue } from "@/lib/supabase/mappers";
import { platformName } from "./ui";

export type NewEntityValues = { name: string; phone: string; detail: string; note: string };

function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function isCompletePhone(value: string): boolean {
  return /^\d{3}-\d{4}-\d{4}$/.test(value);
}

function ModalFrame({ eyebrow, title, onClose, children, actions }: { eyebrow: string; title: string; onClose: () => void; children: React.ReactNode; actions: React.ReactNode }) {
  return (
    <div className="modal-backdrop"><div className="simple-modal" role="dialog" aria-modal="true">
      <div className="wizard-head"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div><button aria-label="닫기" className="icon-button" onClick={onClose}><X size={20} /></button></div>
      <div className="simple-form">{children}</div>
      {actions}
    </div></div>
  );
}

export function SimpleFormModal({ type, inquiryTypes = DEFAULT_INQUIRY_TYPES, busy, error, onClose, onSave }: { type: "customer" | "employee"; inquiryTypes?: readonly string[]; busy?: boolean; error?: string; onClose: () => void; onSave: (values: NewEntityValues) => void }) {
  const [values, setValues] = useState<NewEntityValues>({ name: "", phone: "", detail: type === "customer" ? inquiryTypes[0] ?? DEFAULT_INQUIRY_TYPES[0] : "중개보조원", note: "" });
  const set = (key: keyof NewEntityValues, value: string) => setValues((current) => ({ ...current, [key]: value }));
  return (
    <ModalFrame eyebrow={`NEW ${type.toUpperCase()}`} title={type === "customer" ? "고객 등록" : "직원 등록"} onClose={onClose}
      actions={<div className="modal-actions"><span className="form-error">{error}</span><button className="secondary" onClick={onClose}>취소</button><button className="primary" disabled={busy || !values.name.trim() || !isCompletePhone(values.phone)} onClick={() => onSave(values)}><Check size={15} /> {busy ? "저장 중" : "등록"}</button></div>}>
      <label>이름<input value={values.name} onChange={(event) => set("name", event.target.value)} autoFocus /></label>
      <label>전화번호<input value={values.phone} inputMode="tel" maxLength={13} placeholder="010-0000-0000" onChange={(event) => set("phone", formatPhoneNumber(event.target.value))} /></label>
      {type === "customer"
        ? <><label>문의 유형<select value={values.detail} onChange={(event) => set("detail", event.target.value)}>{inquiryTypes.map((inquiryType) => <option key={inquiryType}>{inquiryType}</option>)}</select></label><label>희망 조건<textarea value={values.note} onChange={(event) => set("note", event.target.value)} placeholder="예: 북문, 월 45만원 이하, 채광 우선" /></label></>
        : <label>직책<select value={values.detail} onChange={(event) => set("detail", event.target.value)}><option>중개보조원</option><option>현장 매니저</option><option>공인중개사</option><option>대표 공인중개사</option></select></label>}
    </ModalFrame>
  );
}

interface EditEntityModalProps {
  entity: Customer | Employee;
  mode: WorkspaceMode;
  busy?: boolean;
  error?: string;
  onClose: () => void;
  onSave: (entity: Customer | Employee) => void;
  onDelete: () => void;
}

export function EditEntityModal({ entity, mode, busy, error, onClose, onSave, onDelete }: EditEntityModalProps) {
  const customer = "interest" in entity;
  const [draft, setDraft] = useState(entity);
  const change = (key: string, value: string | null) => setDraft((current) => ({ ...current, [key]: value }));
  const customerDraft = draft as Customer;
  const employeeDraft = draft as Employee;
  const phoneComplete = isCompletePhone(draft.phone);
  return (
    <ModalFrame eyebrow={`EDIT ${customer ? "CUSTOMER" : "EMPLOYEE"}`} title={customer ? "고객 정보 수정" : "직원 정보 수정"} onClose={onClose}
      actions={<div className="modal-actions split-actions"><button className="danger-button" onClick={onDelete} disabled={busy}>삭제</button><span className="form-error">{error}</span><button className="secondary" onClick={onClose}>취소</button><button className="primary" disabled={busy || !draft.name.trim() || !phoneComplete} onClick={() => onSave(draft)}><Check size={15} /> {busy ? "저장 중" : "변경사항 저장"}</button></div>}>
      <label>이름<input value={draft.name} onChange={(event) => change("name", event.target.value)} /></label>
      <label>전화번호<input value={draft.phone} inputMode="tel" maxLength={13} placeholder="010-0000-0000" onChange={(event) => change("phone", formatPhoneNumber(event.target.value))} /></label>
      {customer ? (
        <>
          <label>희망 매물<input value={customerDraft.interest} onChange={(event) => change("interest", event.target.value)} /></label>
          <label>예산<input value={customerDraft.budget} onChange={(event) => change("budget", event.target.value)} /></label>
          {mode === "live"
            ? <label>다음 확인<input type="datetime-local" value={toKstInputValue(customerDraft.followUpAt)} onChange={(event) => change("followUpAt", event.target.value ? new Date(`${event.target.value}:00+09:00`).toISOString() : null)} /></label>
            : <label>다음 확인<input value={customerDraft.followUp} onChange={(event) => change("followUp", event.target.value)} /></label>}
          <label>메모<textarea value={customerDraft.note} onChange={(event) => change("note", event.target.value)} /></label>
        </>
      ) : (
        <>
          <label>직책<input value={employeeDraft.role} onChange={(event) => change("role", event.target.value)} /></label>
          <label>재직상태<select value={employeeDraft.status} onChange={(event) => change("status", event.target.value)}><option>재직</option><option>휴직</option><option>퇴사</option></select></label>
        </>
      )}
    </ModalFrame>
  );
}

interface EditPropertyModalProps {
  property: Property;
  employees: Employee[];
  busy?: boolean;
  error?: string;
  onClose: () => void;
  onSave: (property: Property) => void;
  onDelete: () => void;
}

export function EditPropertyModal({ property, employees, busy, error, onClose, onSave, onDelete }: EditPropertyModalProps) {
  const [draft, setDraft] = useState(property);
  const change = <K extends keyof Property>(key: K, value: Property[K]) => setDraft((current) => ({ ...current, [key]: value }));
  return (
    <div className="modal-backdrop"><div className="simple-modal property-edit-modal" role="dialog" aria-modal="true">
      <div className="wizard-head"><div><span className="eyebrow">EDIT PROPERTY</span><h2>매물 정보 수정</h2></div><button aria-label="닫기" className="icon-button" onClick={onClose}><X size={20} /></button></div>
      <div className="simple-form property-edit-scroll" role="region" aria-label="매물 정보 수정 항목">
        <label>매물 제목<input value={draft.title} onChange={(event) => change("title", event.target.value)} /></label>
        <label>매물 유형<select value={draft.type} onChange={(event) => change("type", event.target.value as Property["type"])}><option>원룸</option><option>투룸</option><option>오피스텔</option></select></label>
        <label>상태<select value={draft.status} onChange={(event) => change("status", event.target.value as Property["status"])}><option>등록 대기</option><option>검토 완료</option><option>광고 중</option><option>계약 진행</option><option>거래 완료</option><option>보류</option><option>종료</option></select></label>
        <label>등록 직원<select value={draft.registeredById ?? ""} onChange={(event) => { const employee = employees.find((item) => item.id === event.target.value); setDraft((current) => ({ ...current, registeredById: employee?.id ?? null, registeredBy: employee?.name ?? current.registeredBy })); }}><option value="">{draft.registeredById ? "미지정" : draft.registeredBy}</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.role}</option>)}</select></label>
        <label>정확한 주소<input value={draft.exactAddress} onChange={(event) => change("exactAddress", event.target.value)} /></label>
        <label>보증금 (만원)<input type="number" value={draft.deposit} onChange={(event) => change("deposit", Number(event.target.value))} /></label>
        <label>월세 (만원)<input type="number" value={draft.rent} onChange={(event) => change("rent", Number(event.target.value))} /></label>
        <label>관리비 (만원)<input type="number" value={draft.maintenance} onChange={(event) => change("maintenance", Number(event.target.value))} /></label>
        <label>방향 (법정 고지)<input value={draft.disclosure.direction} placeholder="예: 남동향 (주실 창 기준)" onChange={(event) => change("disclosure", { ...draft.disclosure, direction: event.target.value })} /></label>
        <label>계약면적 (법정 고지)<input value={draft.disclosure.contractArea} placeholder="예: 26.42㎡" onChange={(event) => change("disclosure", { ...draft.disclosure, contractArea: event.target.value })} /></label>
        {PLATFORMS.map((platform) => (
          <label key={platform}>{platformName[platform]} 원고<textarea value={draft.copies?.[platform] ?? ""} onChange={(event) => {
            const value = event.target.value;
            setDraft((current) => ({
              ...current,
              employeeCopy: platform === "naver" ? value : current.employeeCopy,
              copies: { ...(current.copies ?? {}), [platform]: value },
            }));
          }} /></label>
        ))}
      </div>
      <div className="modal-actions split-actions"><button className="danger-button" onClick={onDelete} disabled={busy}>매물 삭제</button><span className="form-error">{error}</span><button className="secondary" onClick={onClose}>취소</button><button className="primary" disabled={busy || !draft.title.trim() || !draft.exactAddress.trim()} onClick={() => onSave(draft)}><Check size={15} /> {busy ? "저장 중" : "변경사항 저장"}</button></div>
    </div></div>
  );
}
