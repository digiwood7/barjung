"use client";

import { Building2, ChevronRight, CircleAlert, LayoutDashboard, MapPin, Menu, Search, Settings, UserRound, UsersRound, Wifi } from "lucide-react";
import { useEffect, useState } from "react";
import type { AgentStatus, Employee, OfficeInfo, WorkspaceMode } from "@/lib/domain/types";

export type View = "dashboard" | "properties" | "customers" | "employees" | "settings";

export const nav: Array<{ id: View; label: string; icon: typeof LayoutDashboard }> = [
  { id: "dashboard", label: "대시보드", icon: LayoutDashboard },
  { id: "properties", label: "매물관리", icon: Building2 },
  { id: "customers", label: "고객관리", icon: UsersRound },
  { id: "employees", label: "직원관리", icon: UserRound },
  { id: "settings", label: "설정", icon: Settings },
];

export function pickProfile(employees: Employee[]): Employee | null {
  return employees.find((employee) => employee.status === "재직" && employee.role.includes("대표")) ?? employees.find((employee) => employee.status === "재직") ?? employees[0] ?? null;
}

interface SidebarProps {
  view: View;
  onView: (view: View) => void;
  office: OfficeInfo;
  agent: AgentStatus;
  employees: Employee[];
  propertyCount: number;
}

export function Sidebar({ view, onView, office, agent, employees, propertyCount }: SidebarProps) {
  const profile = pickProfile(employees);
  return (
    <aside className="sidebar">
      <button className="brand" onClick={() => onView("dashboard")}>
        <span className="brand-mark"><span>ㅂ</span><span>ㅈ</span></span>
        <span><strong>바를정</strong><small>PROPERTY OFFICE</small></span>
      </button>
      <div className="office-tag"><MapPin size={14} /><span>{office.regionLabel}</span></div>
      <nav>
        <p className="nav-label">WORKSPACE</p>
        {nav.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => onView(id)} className={view === id ? "active" : ""}>
            <Icon size={18} /><span>{label}</span>{id === "properties" && propertyCount > 0 && <em>{propertyCount}</em>}
          </button>
        ))}
      </nav>
      <div className={`agent-card ${agent.status}`}>
        <div className="agent-title"><span className={`live-dot ${agent.status}`} /><strong>Windows 실행기</strong></div>
        <p>{agent.deviceName}</p>
        <div><Wifi size={13} /><span>{agent.label}</span></div>
      </div>
      <div className="profile">
        <span className="avatar">{profile?.name[0] ?? "바"}</span>
        <span><strong>{profile ? `${profile.name} ${profile.role.includes("대표") ? "대표" : ""}`.trim() : "직원 미등록"}</strong><small>{office.name}</small></span>
        <ChevronRight size={15} />
      </div>
    </aside>
  );
}

function todayLabel(now: Date): string {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).format(now);
}

export function Topbar({ view, mode, readOnly, onMenu }: { view: View; mode: WorkspaceMode; readOnly: boolean; onMenu: () => void }) {
  const label = nav.find((item) => item.id === view)?.label;
  const [today, setToday] = useState("");
  useEffect(() => { setToday(todayLabel(new Date())); }, []);
  return (
    <header className="topbar">
      <div><button className="mobile-menu" onClick={onMenu}><Menu size={20} /></button><span>바를정 오피스</span><ChevronRight size={13} /><strong>{label}</strong></div>
      <div className="top-actions">
        <span className={`mode-pill ${mode}`} title={mode === "live" ? "고객 Supabase 에 저장됩니다" : "브라우저 메모리 데모 — 새로고침하면 사라집니다"}>
          {mode === "live" ? (readOnly ? "조회 전용" : "고객 DB 연결") : "데모 데이터"}
        </span>
        <span className="date">{today}</span>
        <button className="icon-button" aria-label="검색"><Search size={18} /></button>
        <button className="icon-button notification" aria-label="알림"><CircleAlert size={18} /><i /></button>
      </div>
    </header>
  );
}
