"use client";

import {
  Activity, ArrowRight, Bot, Building2, Check, ChevronDown, ChevronRight, CircleAlert, Clock3,
  Database, ExternalLink, FileCheck2, Filter, Home, ImageIcon, LayoutDashboard, ListFilter, MapPin,
  Menu, MessageSquareText, Plus, RefreshCcw, Search, Settings, ShieldCheck, Sparkles, Upload,
  UserRound, UsersRound, Wifi, X, Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { customers as seedCustomers, employees as seedEmployees, properties as seedProperties } from "@/lib/mock/data";
import { filterProperties, validateLegalDisclosure } from "@/lib/mock/selectors";
import type { Customer, DistributionTarget, Employee, LegalDisclosure, Platform, Property, PublishStatus } from "@/lib/mock/types";
import type { BuildingRegisterLookupResult } from "@/lib/building-register/types";

type View = "dashboard" | "properties" | "customers" | "employees" | "settings";
const platformName: Record<Platform, string> = { naver: "네이버", instagram: "인스타", daangn: "당근", zigbang: "직방" };
const platformInitial: Record<Platform, string> = { naver: "N", instagram: "I", daangn: "D", zigbang: "Z" };
const nav = [
  { id: "dashboard" as View, label: "대시보드", icon: LayoutDashboard },
  { id: "properties" as View, label: "매물관리", icon: Building2, badge: "24" },
  { id: "customers" as View, label: "고객관리", icon: UsersRound },
  { id: "employees" as View, label: "직원관리", icon: UserRound },
  { id: "settings" as View, label: "설정", icon: Settings },
];

function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "green" | "blue" | "amber" | "red" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function PlatformLogo({ platform, compact = false, status }: { platform: Platform; compact?: boolean; status?: PublishStatus }) {
  return (
    <span className={`platform-logo platform-brand ${platform} ${compact ? "compact" : ""} ${status ? `status-${status}` : ""}`} aria-label={platformName[platform]} title={`${platformName[platform]}${status ? ` · ${status}` : ""}`}>
      {platform === "naver" && <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3h6.1l4.7 7.1V3H20v18h-6.1l-4.7-7.1V21H4V3Z" /></svg>}
      {platform === "instagram" && <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5.2" /><circle cx="12" cy="12" r="4.1" /><circle className="solid" cx="17.4" cy="6.7" r="1.15" /></svg>}
      {platform === "daangn" && <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.4 7.9c-3.4.9-5 3.2-4 6.3 1.1 3.5 4.8 7.4 7.1 6.6 2.3-.8 5.5-5.4 6.2-8.8.6-3.1-2.5-5.1-9.3-4.1Z" /><path d="M10.1 8.1C8.7 5.4 9.4 3.2 11.7 2c1.4 2.1 1.2 4.2-.6 6.2m1.1-.4c.6-2.5 2.4-3.8 5-3.5-.1 2.6-1.6 4.1-4.5 4.2" /></svg>}
      {platform === "zigbang" && <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 10.2 12 3l8.5 7.2v9.5c0 .7-.6 1.3-1.3 1.3H4.8c-.7 0-1.3-.6-1.3-1.3v-9.5Z" /><path className="cutout" d="m8 9.1 8-.1-5.8 6H16v2H7.9v-1.7l5.7-6.1H8V9.1Z" /></svg>}
    </span>
  );
}

function PlatformDots({ targets, compact = false }: { targets: DistributionTarget[]; compact?: boolean }) {
  return (
    <div className={`platform-dots ${compact ? "compact" : ""}`}>
      {targets.map((target) => (
        <div className={`platform-dot ${target.status}`} title={`${platformName[target.platform]} · ${target.status}`} key={target.platform}>
          {target.status === "succeeded" ? <Check size={11} strokeWidth={3} /> : platformInitial[target.platform]}
        </div>
      ))}
    </div>
  );
}

function Sidebar({ view, onView }: { view: View; onView: (view: View) => void }) {
  return (
    <aside className="sidebar">
      <button className="brand" onClick={() => onView("dashboard")}>
        <span className="brand-mark"><span>ㅂ</span><span>ㅈ</span></span>
        <span><strong>바를정</strong><small>PROPERTY OFFICE</small></span>
      </button>
      <div className="office-tag"><MapPin size={14} /><span>경북대 캠퍼스 권역</span></div>
      <nav>
        <p className="nav-label">WORKSPACE</p>
        {nav.map(({ id, label, icon: Icon, badge }) => (
          <button key={id} onClick={() => onView(id)} className={view === id ? "active" : ""}>
            <Icon size={18} /><span>{label}</span>{badge && <em>{badge}</em>}
          </button>
        ))}
      </nav>
      <div className="agent-card">
        <div className="agent-title"><span className="live-dot" /><strong>Windows 실행기</strong></div>
        <p>BARJUNG-OFFICE-01</p>
        <div><Wifi size={13} /><span>온라인 · 방금 전</span></div>
      </div>
      <div className="profile"><span className="avatar">정</span><span><strong>정다혜 대표</strong><small>바를정공인중개사</small></span><ChevronRight size={15} /></div>
    </aside>
  );
}

function Topbar({ view, onMenu }: { view: View; onMenu: () => void }) {
  const label = nav.find((item) => item.id === view)?.label;
  return (
    <header className="topbar">
      <div><button className="mobile-menu" onClick={onMenu}><Menu size={20} /></button><span>바를정 오피스</span><ChevronRight size={13} /><strong>{label}</strong></div>
      <div className="top-actions"><span className="date">2026. 08. 30. 일</span><button className="icon-button"><Search size={18} /></button><button className="icon-button notification"><CircleAlert size={18} /><i /></button></div>
    </header>
  );
}

function Metric({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: string }) {
  return <div className={`metric ${tone || ""}`}><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>;
}

function Dashboard({ properties, onView, onSelect }: { properties: Property[]; onView: (v: View) => void; onSelect: (p: Property) => void }) {
  const active = properties.filter((p) => p.status === "광고 중").length;
  const review = properties.filter((p) => p.status === "등록 대기" || p.status === "검토 완료").length;
  const failed = properties.filter((p) => p.targets.some((t) => t.status === "failed")).length;
  return (
    <div className="view-stack">
      <section className="page-intro dashboard-intro">
        <div><span className="eyebrow">TODAY'S PROPERTY DESK</span><h1>매물의 시작부터<br /><em>게시 완료까지.</em></h1><p>경북대 인근 매물과 네 채널의 배포 상태를 한 자리에서 확인하세요.</p></div>
        <div className="intro-actions"><button className="primary" onClick={() => onView("properties")}><Plus size={17} /> 새 매물 등록</button></div>
      </section>
      <section className="metrics-row">
        <Metric label="전체 매물" value={String(properties.length)} sub="현재 등록 기준" />
        <Metric label="광고 중" value={String(active)} sub="4개 채널 기준" tone="blue" />
        <Metric label="검토 대기" value={String(review)} sub="고지 확인 필요" tone="amber" />
        <Metric label="배포 실패" value={String(failed)} sub="직방 재로그인 필요" tone="red" />
      </section>
      <section className="panel recent-panel">
        <div className="panel-head"><div><span className="eyebrow">RECENT LISTINGS</span><h2>최근 등록 매물</h2></div><button className="text-button" onClick={() => onView("properties")}>매물 전체 보기 <ArrowRight size={14} /></button></div>
        <div className="property-mini-list">{properties.slice(0, 4).map((p) => <button key={p.id} onClick={() => onSelect(p)}><span className="property-thumb" style={{ background: p.accent }}><Home size={19} /></span><span className="mini-main"><small>{p.number} · {p.area}</small><strong>{p.title}</strong><em>보증금 {p.deposit.toLocaleString()} / 월 {p.rent} · 관리비 {p.maintenance}</em></span><Badge tone={p.status === "광고 중" ? "green" : p.status === "검토 완료" ? "blue" : "amber"}>{p.status}</Badge><span className="platform-brand-row">{p.targets.map((target) => <PlatformLogo key={target.platform} platform={target.platform} compact status={target.status} />)}</span><ChevronRight size={17} /></button>)}</div>
      </section>
    </div>
  );
}

function PropertiesView({ properties, onSelect, onNew }: { properties: Property[]; onSelect: (p: Property) => void; onNew: () => void }) {
  const [query, setQuery] = useState(""); const [type, setType] = useState("전체"); const [status, setStatus] = useState("전체"); const [publish, setPublish] = useState<"all" | "done" | "failed" | "unpublished">("all");
  const filtered = useMemo(() => filterProperties(properties, { query, type, status, publish }), [properties, query, type, status, publish]);
  return <div className="view-stack">
    <section className="page-heading"><div><span className="eyebrow">PROPERTY LEDGER</span><h1>매물관리</h1><p>매물 원본과 플랫폼별 배포 결과를 함께 관리합니다.</p></div><button className="primary desktop-create" onClick={onNew}><Plus size={17} /> 새 매물 등록</button></section>
    <section className="panel table-panel">
      <div className="filters"><label className="search-field"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="매물번호, 주소, 제목 검색" /></label>
        <select value={type} onChange={(e) => setType(e.target.value)}><option>전체</option><option>원룸</option><option>투룸</option><option>오피스텔</option></select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}><option>전체</option><option>등록 대기</option><option>검토 완료</option><option>광고 중</option><option>계약 진행</option></select>
        <select value={publish} onChange={(e) => setPublish(e.target.value as typeof publish)}><option value="all">전체 배포상태</option><option value="done">배포 완료</option><option value="failed">실패 있음</option><option value="unpublished">미배포</option></select>
        <button className="filter-button"><ListFilter size={16} /> 상세 필터</button></div>
      <div className="table-meta"><strong>전체 {filtered.length}건</strong><span>마지막 동기화 방금 전</span></div>
      <div className="table-wrap"><table><thead><tr><th>매물</th><th>거래조건</th><th>상태</th><th>등록 정보</th><th>플랫폼 배포</th><th /></tr></thead><tbody>{filtered.map((p) => <tr key={p.id} onClick={() => onSelect(p)}><td><div className="property-cell"><span className="property-thumb" style={{ background: p.accent }}><Home size={18} /><i>{p.photos}</i></span><div><small>{p.number} · {p.area}</small><strong>{p.title}</strong><em>{p.type} · {p.publicAddress}</em></div></div></td><td><strong>보증금 {p.deposit.toLocaleString()}</strong><small>월 {p.rent} · 관리비 {p.maintenance}</small></td><td><Badge tone={p.status === "광고 중" ? "green" : p.status === "검토 완료" ? "blue" : p.status === "등록 대기" ? "amber" : "slate"}>{p.status}</Badge></td><td><strong>{p.registeredBy}</strong><small>{p.createdAt}</small></td><td><PlatformDots targets={p.targets} /></td><td><ChevronRight size={17} /></td></tr>)}</tbody></table></div>
    </section>
  </div>;
}

function PropertyDetail({ property, onClose, onPublish, onEdit }: { property: Property; onClose: () => void; onPublish: () => void; onEdit: () => void }) {
  const missing = validateLegalDisclosure(property.disclosure);
  return <div className="drawer-backdrop" onMouseDown={onClose}><aside className="detail-drawer" onMouseDown={(e) => e.stopPropagation()}><div className="drawer-head"><div><span className="eyebrow">{property.number}</span><h2>{property.title}</h2></div><button className="icon-button" onClick={onClose}><X size={20} /></button></div>
    <div className="photo-strip">{[0,1,2].map((n) => <span key={n} style={{ background: property.accent }}><Home size={22} /></span>)}<span className="photo-more">+{property.photos - 3}</span></div>
    <div className="detail-summary"><div><small>거래조건</small><strong>보증금 {property.deposit.toLocaleString()} / 월 {property.rent}</strong></div><div><small>매물 상태</small><Badge tone="green">{property.status}</Badge></div></div>
    <section className="detail-section"><div className="section-title"><h3>주소 정보</h3><Badge tone="blue">내부 전용</Badge></div><p className="address-line"><MapPin size={16} /> {property.exactAddress}</p><small>외부 게시: {property.publicAddress} · 플랫폼별 공개 범위 적용</small></section>
    <section className="detail-section"><div className="section-title"><h3>공인중개사법 고지사항</h3>{missing.length ? <Badge tone="red">{missing.length}개 누락</Badge> : <Badge tone="green"><ShieldCheck size={12} /> 검증 완료</Badge>}</div><div className="legal-grid">{Object.entries(property.disclosure).map(([key, value]) => <div key={key}><small>{({location:"소재지",contractArea:"계약면적",propertyCategory:"대상물 종류",transactionType:"거래형태",floor:"층수",availableFrom:"입주가능일",rooms:"방/욕실",approvalDate:"사용승인일",parking:"주차",maintenance:"관리비",direction:"방향",lotNumberNotice:"지번 공개 안내",measurementNotice:"면적 안내"} as Record<string,string>)[key]}</small><strong className={!value ? "missing" : ""}>{value || "입력 필요"}</strong></div>)}</div></section>
    <section className="detail-section"><div className="section-title"><h3>플랫폼 배포</h3><small>배지를 누르면 결과를 확인합니다.</small></div><div className="platform-detail-list">{property.targets.map((t) => <div key={t.platform}><PlatformLogo platform={t.platform} /><div><strong>{platformName[t.platform]}</strong><small>{t.status === "succeeded" ? "게시 완료" : t.status === "failed" ? t.error : t.status === "not_configured" ? "현장 연결 전" : "아직 배포하지 않음"}</small></div>{t.status === "succeeded" && t.url ? <a href={t.url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> 링크</a> : t.status === "failed" ? <Badge tone="red">실패</Badge> : <Badge>미배포</Badge>}</div>)}</div></section>
    <div className="drawer-actions"><button className="secondary" onClick={onEdit}>매물 수정</button><button className="primary" disabled={missing.length > 0} onClick={onPublish}><Zap size={16} /> 전체 배포</button></div>
  </aside></div>;
}

const blankDisclosure: LegalDisclosure = { location: "대구광역시 북구 산격동 481-5", contractArea: "79.62㎡", propertyCategory: "다가구주택", transactionType: "월세", floor: "4층 중 2층", availableFrom: "즉시 입주", rooms: "방 1, 욕실 1", approvalDate: "2020. 11. 06.", parking: "총 6대", maintenance: "월 7만원 (수도·인터넷 포함)", direction: "", lotNumberNotice: "중개의뢰인 요청으로 상세 지번 비공개", measurementNotice: "면적은 공부상 면적이며 현장 실측과 차이가 있을 수 있습니다." };

function PropertyWizard({ onClose, onFinish }: { onClose: () => void; onFinish: (property: Property) => void }) {
  const [step, setStep] = useState(0); const [optimize, setOptimize] = useState(0); const [address, setAddress] = useState("대구광역시 북구 산격동 481-5");
  const [disclosure, setDisclosure] = useState<LegalDisclosure>(blankDisclosure);
  const [registryStatus, setRegistryStatus] = useState<"idle" | "loading" | "live" | "demo" | "failed">("idle");
  const [registryMessage, setRegistryMessage] = useState("주소 확인 버튼을 누르면 공공데이터 API로 조회합니다.");
  const [registry, setRegistry] = useState<BuildingRegisterLookupResult | null>(null);
  const [copies, setCopies] = useState<Record<Platform, string>>({ naver: "경북대 북문 도보 3분, 채광 좋은 분리형 원룸입니다. 보증금 500만원 / 월 42만원, 관리비 7만원입니다.", instagram: "북문 3분 분리형 원룸. 채광 좋고 생활권이 편리합니다. 500/42, 관리비 7.", daangn: "산격동 북문 가까운 깔끔한 원룸입니다. 직접 촬영한 사진이며 즉시 입주 가능합니다.", zigbang: "경북대 북문 인근 / 분리형 원룸 / 풀옵션 / 즉시입주" });
  const steps = ["기본정보", "사진 최적화", "건축물대장", "고지사항", "채널 원고", "등록 확인"];
  useEffect(() => { if (step !== 1 || optimize >= 100) return; const timer = window.setInterval(() => setOptimize((v) => Math.min(100, v + 4)), 70); return () => window.clearInterval(timer); }, [step, optimize]);
  const missing = validateLegalDisclosure(disclosure);
  const lookupRegistry = async () => {
    setRegistryStatus("loading"); setRegistryMessage("건축물대장을 조회하고 있습니다.");
    try {
      const response = await fetch("/api/building-register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address }) });
      const payload = await response.json() as BuildingRegisterLookupResult & { message?: string };
      if (!response.ok) throw new Error(payload.message || "조회 실패");
      setRegistry(payload);
      setDisclosure((current) => ({ ...current, ...payload.disclosure }));
      setRegistryStatus("live"); setRegistryMessage("국토교통부 건축HUB에서 최신 값을 조회했습니다.");
    } catch (error) {
      setRegistry(null);
      const message = error instanceof Error ? error.message : "조회 실패";
      if (message.includes("API 키") || message.includes("연결")) {
        setRegistryStatus("demo"); setRegistryMessage("시안 데이터입니다. 고객 API 키 연결 후 실제 값으로 교체됩니다.");
      } else {
        setRegistryStatus("failed"); setRegistryMessage(message);
      }
    }
  };
  const finish = () => onFinish({ ...seedProperties[0], id: `p${Date.now()}`, number: `260830-${String(Date.now()).slice(-2)}`, title: "북문 도보 3분, 깔끔한 분리형 원룸", status: "검토 완료", createdAt: "방금 전", disclosure, employeeCopy: copies.naver, targets: (["naver","instagram","daangn","zigbang"] as Platform[]).map((platform) => ({ platform, status: "not_requested", progress: 0 })) });
  return <div className="modal-backdrop"><div className="wizard-modal"><div className="wizard-head"><div><span className="eyebrow">NEW PROPERTY</span><h2>새 매물 등록</h2></div><button className="icon-button" onClick={onClose}><X size={20} /></button></div>
    <div className="wizard-steps">{steps.map((label, index) => <div key={label} className={index === step ? "active" : index < step ? "done" : ""}><span>{index < step ? <Check size={13} /> : index + 1}</span><small>{label}</small></div>)}</div>
    <div className="wizard-body">
      {step === 0 && <div className="form-grid"><label className="span-2">매물 제목<input defaultValue="북문 도보 3분, 깔끔한 분리형 원룸" /></label><label>매물 유형<select defaultValue="원룸"><option>원룸</option><option>투룸</option><option>오피스텔</option></select></label><label>거래 형태<select><option>월세</option><option>전세</option></select></label><label>보증금<input defaultValue="500" /></label><label>월세<input defaultValue="42" /></label><label className="span-2">정확한 주소<div className="input-action"><input aria-label="정확한 주소" value={address} onChange={(event) => { setAddress(event.target.value); setRegistryStatus("idle"); }} /><button type="button" onClick={lookupRegistry} disabled={registryStatus === "loading"}><Search size={15} /> {registryStatus === "loading" ? "조회 중" : "주소 확인"}</button></div></label><div className="notice span-2"><MapPin size={16} /><div><strong>외부 주소는 플랫폼마다 다르게 공개됩니다.</strong><small>{registryMessage}</small></div></div></div>}
      {step === 1 && <div><div className="drop-zone"><Upload size={28} /><strong>현장 사진 10장을 불러왔습니다</strong><small>Windows 로컬 Python이 원본을 압축한 뒤 Supabase로 전송합니다.</small></div><div className="optimization-box"><div className="optimization-head"><span><Sparkles size={17} /> 로컬 최적화</span><strong>{optimize}%</strong></div><div className="progress"><i style={{ width: `${optimize}%` }} /></div><div className="photo-jobs">{["IMG_4821.HEIC","IMG_4822.HEIC","IMG_4823.HEIC"].map((name,index) => <div key={name}><span className="file-thumb"><ImageIcon size={15} /></span><div><strong>{name}</strong><small>10.4MB → {index === 1 ? "648KB" : "712KB"} · EXIF 제거</small></div>{optimize > (index + 1) * 25 ? <Check size={16} /> : <Activity size={16} />}</div>)}</div></div></div>}
      {step === 2 && <div className="registry-view"><div className="registry-search"><Database size={20} /><div><strong>{registryStatus === "live" ? "건축물대장 실조회 완료" : registryStatus === "failed" ? "건축물대장 조회 실패" : "건축물대장 시안 데이터"}</strong><small>{registryMessage}</small></div><Badge tone={registryStatus === "live" ? "green" : registryStatus === "failed" ? "red" : "amber"}>{registryStatus === "live" ? "실데이터" : registryStatus === "failed" ? "실패" : "DEMO"}</Badge></div><div className="building-choice selected"><span><Building2 size={20} /></span><div><strong>{registry?.address || address}</strong><small>{disclosure.propertyCategory} · {disclosure.floor} · 사용승인 {disclosure.approvalDate}</small></div><Check size={18} /></div><div className="auto-fill-note"><Sparkles size={17} /><span>대상물 종류, 건물 층수, 사용승인일, 주차대수를 자동으로 채웁니다. 계약면적·해당 층·방향·관리비는 직원이 확인합니다.</span></div></div>}
      {step === 3 && <div><div className="legal-banner"><FileCheck2 size={21} /><div><strong>공인중개사법 고지사항</strong><small>자동 조회값과 현장 입력값을 모두 확인해야 배포할 수 있습니다.</small></div><Badge tone={missing.length ? "amber" : "green"}>{missing.length ? `${missing.length}개 확인 필요` : "13/13 확인"}</Badge></div><div className="legal-form">{Object.entries(disclosure).map(([key,value]) => { const automatic = ["location","propertyCategory","approvalDate","parking"].includes(key); return <label key={key}><span>{({location:"소재지",contractArea:"계약면적",propertyCategory:"대상물 종류",transactionType:"거래형태",floor:"해당 층/총 층수",availableFrom:"입주가능일",rooms:"방/욕실",approvalDate:"사용승인일",parking:"주차",maintenance:"관리비",direction:"방향",lotNumberNotice:"지번 공개 안내",measurementNotice:"면적 안내"} as Record<string,string>)[key]}<em>{automatic ? "대장" : "현장"}</em></span><input value={value} readOnly={automatic} placeholder={key === "direction" ? "예: 남동향 (주실 창 기준)" : ""} onChange={automatic ? undefined : (event) => setDisclosure((current) => ({ ...current, [key]: event.target.value }))} /></label>; })}</div>{missing.length > 0 && <div className="error-guide"><CircleAlert size={17} /><span><strong>{missing.join(", ")}</strong> 항목을 입력하면 배포 준비가 완료됩니다.</span><button onClick={() => setDisclosure((current) => ({ ...current, direction: "남동향 (주실 창 기준)" }))}>방향 예시값 입력</button></div>}</div>}
      {step === 4 && <div className="copy-grid">{(["naver","instagram","daangn","zigbang"] as Platform[]).map((platform) => <div className="copy-card" key={platform}><div><PlatformLogo platform={platform} compact /><strong>{platformName[platform]}</strong><Badge tone="blue">직접 작성</Badge></div><textarea aria-label={`${platformName[platform]} 게시 원고`} value={copies[platform]} onChange={(event) => setCopies((current) => ({ ...current, [platform]: event.target.value }))} /><small><ShieldCheck size={12} /> 검증된 법정 고지는 게시 시 수정 불가 영역으로 자동 첨부</small></div>)}</div>}
      {step === 5 && <div className="review-card"><div className="review-icon"><Check size={28} /></div><h3>매물 등록 준비가 끝났습니다</h3><p>최적화 사진 10장, 건축물대장 조회값, 직원 작성 원고 4개를 저장합니다.</p><div className="review-summary"><span><ImageIcon size={16} /> 사진 <strong>6.8MB</strong></span><span><FileCheck2 size={16} /> 고지사항 <strong>13/13</strong></span><span><MessageSquareText size={16} /> 채널 원고 <strong>4개</strong></span></div><div className="notice"><FileCheck2 size={17} /><div><strong>현재 검수 후 배포 모드입니다.</strong><small>등록 후 매물 상세에서 원고를 확인하고 전체 배포를 실행합니다.</small></div></div></div>}
    </div>
    <div className="wizard-footer"><button className="secondary" onClick={() => step === 0 ? onClose() : setStep(step - 1)}>{step === 0 ? "취소" : "이전"}</button><div><span>{step + 1} / {steps.length}</span>{step < steps.length - 1 ? <button className="primary" disabled={(step === 1 && optimize < 100) || (step === 3 && missing.length > 0)} onClick={() => setStep(step + 1)}>다음 <ArrowRight size={16} /></button> : <button className="primary" onClick={finish}><Check size={16} /> 매물 등록</button>}</div></div>
  </div></div>;
}

function DistributionModal({ property, onClose, onUpdate }: { property: Property; onClose: () => void; onUpdate: (targets: DistributionTarget[]) => void }) {
  const [targets, setTargets] = useState<DistributionTarget[]>((["naver","instagram","daangn","zigbang"] as Platform[]).map((platform) => ({ platform, status: "queued", progress: 0 })));
  const [retrying, setRetrying] = useState(false);
  useEffect(() => { const timers: number[] = []; (["naver","instagram","daangn","zigbang"] as Platform[]).forEach((platform,index) => { timers.push(window.setTimeout(() => setTargets((prev) => prev.map((t) => t.platform === platform ? { ...t, status: "running" as PublishStatus, progress: 38 } : t)), 500 + index * 450)); timers.push(window.setTimeout(() => setTargets((prev) => prev.map((t) => t.platform === platform ? { ...t, status: "not_configured", progress: 100, error: "고객 PC에서 플랫폼 동작을 연결해야 합니다." } : t)), 1700 + index * 550)); }); return () => timers.forEach(clearTimeout); }, []);
  useEffect(() => onUpdate(targets), [targets, onUpdate]);
  const progress = Math.round(targets.reduce((sum,t) => sum + t.progress,0) / targets.length);
  const retry = () => { setRetrying(true); setTargets((prev) => prev.map((t) => t.status === "not_configured" ? { ...t, status: "running", progress: 72, error: undefined } : t)); window.setTimeout(() => { setTargets((prev) => prev.map((t) => t.status === "running" ? { ...t, status: "not_configured", progress: 100, error: "현장 연결 전에는 게시하지 않습니다." } : t)); setRetrying(false); }, 800); };
  const allDone = targets.every((t) => ["succeeded", "failed", "not_configured"].includes(t.status));
  return <div className="modal-backdrop"><div className="distribution-modal"><div className="wizard-head"><div><span className="eyebrow">LOCAL PLAYWRIGHT RUNNER</span><h2>{allDone ? "플랫폼 연결 상태를 확인했습니다" : "배포 준비 상태를 확인하고 있습니다"}</h2><p>{property.number} · {property.area} {property.type}</p></div><button className="icon-button" onClick={onClose}><X size={20} /></button></div><div className="overall-progress"><div><span>{allDone ? "확인 완료" : "전체 진행률"}</span><strong>{progress}%</strong></div><div className="progress"><i style={{ width: `${progress}%` }} /></div><small><span className="live-dot" /> BARJUNG-OFFICE-01의 Playwright 실행기</small></div><div className="distribution-list">{targets.map((t) => <div className={`distribution-row ${t.status}`} key={t.platform}><PlatformLogo platform={t.platform} /><div className="distribution-copy"><strong>{platformName[t.platform]}</strong><small>{t.status === "queued" ? "작업 대기 중" : t.status === "running" ? "로그인과 어댑터 상태 확인 중" : t.status === "succeeded" ? "게시 완료 · 링크 확인 가능" : t.error}</small>{t.status === "running" && <div className="mini-progress"><i style={{ width: `${t.progress}%` }} /></div>}</div>{t.status === "succeeded" && t.url && <a href={t.url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> 열기</a>}{(t.status === "failed" || t.status === "not_configured") && <button className="retry-button" onClick={retry} disabled={retrying}><RefreshCcw size={14} /> 다시 확인</button>}{t.status === "running" && <Activity className="spin" size={17} />}{t.status === "queued" && <Clock3 size={17} />}</div>)}</div><div className="distribution-foot"><span><ShieldCheck size={15} /> 실제 사이트 어댑터 연결 전에는 게시하지 않습니다.</span><button className={allDone ? "primary" : "secondary"} onClick={onClose}>{allDone ? "확인" : "백그라운드에서 계속"}</button></div></div></div>;
}

function CustomersView({ customers, onAdd, onEdit }: { customers: Customer[]; onAdd: () => void; onEdit: (customer: Customer) => void }) {
  const [query, setQuery] = useState("");
  const visible = customers.filter((customer) => `${customer.name} ${customer.phone} ${customer.interest}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <div className="view-stack"><section className="page-heading"><div><span className="eyebrow">CUSTOMER RELATIONSHIP</span><h1>고객관리</h1><p>희망 조건과 상담 메모, 다음 확인 일정을 관리합니다.</p></div><button className="primary" onClick={onAdd}><Plus size={17} /> 고객 등록</button></section><section className="crm-layout"><div className="panel customer-list"><div className="filters"><label className="search-field"><Search size={16} /><input aria-label="고객 검색" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름 또는 전화번호 검색" /></label><button className="filter-button"><Filter size={15} /> 조건</button></div>{visible.map((customer,index) => <button className="customer-row" key={customer.id} onClick={() => onEdit(customer)}><span className={`mini-avatar av-${index}`}>{customer.name[0]}</span><div className="customer-main"><strong>{customer.name}</strong><small>{customer.phone}</small></div><div><small>희망 매물</small><strong>{customer.interest}</strong></div><div><small>다음 확인</small><strong>{customer.followUp}</strong></div><Badge tone={index === 0 ? "amber" : "slate"}>{index === 0 ? "확인 예정" : "상담 중"}</Badge><ChevronRight size={17} /></button>)}</div><aside className="panel crm-insight"><span className="eyebrow">SCHEDULE</span><h2>다음 확인 {customers.length}건</h2><p>고객별 다음 확인일을 놓치지 않도록 관리합니다.</p><div className="insight-rail"><i />{customers.slice(0,2).map((customer) => <div key={customer.id}><time>{customer.followUp}</time><strong>{customer.name} 고객</strong><small>{customer.note}</small></div>)}</div><button className="secondary" onClick={() => setQuery("")}>전체 고객 보기</button></aside></section></div>;
}

function EmployeesView({ employees, onAdd, onEdit }: { employees: Employee[]; onAdd: () => void; onEdit: (employee: Employee) => void }) { return <div className="view-stack"><section className="page-heading"><div><span className="eyebrow">TEAM DIRECTORY</span><h1>직원관리</h1><p>매물 등록자와 담당 직원을 관리합니다.</p></div><button className="primary" onClick={onAdd}><Plus size={17} /> 직원 등록</button></section><section className="employee-grid">{employees.map((employee,index) => <div className="panel employee-card" key={employee.id}><div className={`employee-avatar av-${index}`}>{employee.name[0]}</div><Badge tone={employee.status === "재직" ? "green" : "slate"}>{employee.status}</Badge><h3>{employee.name}</h3><p>{employee.role}</p><small>{employee.phone}</small><div><span>등록 매물</span><strong>{index === 0 ? 16 : index === 1 ? 8 : 0}건</strong></div><button className="secondary" onClick={() => onEdit(employee)}>직원 정보 수정</button></div>)}</section></div>; }

function SettingsView() { const [auto,setAuto] = useState(false); return <div className="view-stack"><section className="page-heading"><div><span className="eyebrow">WORKSPACE SETTINGS</span><h1>운영 설정</h1><p>배포 방식과 플랫폼별 주소 공개 범위를 설정합니다.</p></div></section><section className="settings-grid"><div className="panel setting-card span-2"><div className="setting-icon"><Zap size={20} /></div><div><h3>매물 배포 모드</h3><p>초기 일주일은 검수 후 배포하고, 안정화되면 자동 발행으로 전환합니다.</p></div><button className={`mode-toggle ${auto ? "on" : ""}`} onClick={() => setAuto(!auto)}><span /><strong>{auto ? "자동 발행" : "검수 후 배포"}</strong></button></div><div className="panel setting-card"><div className="setting-icon green"><Bot size={20} /></div><div><h3>Windows 실행기</h3><p>BARJUNG-OFFICE-01</p><Badge tone="green"><span className="live-dot" /> 온라인</Badge></div><button className="secondary">연결 정보</button></div><div className="panel setting-card"><div className="setting-icon blue"><Database size={20} /></div><div><h3>Supabase 저장공간</h3><p>최적화 사진만 저장합니다.</p><div className="storage-bar"><i /></div><small>1GB 중 286MB 사용</small></div></div><div className="panel address-settings span-2"><div className="panel-head"><div><span className="eyebrow">ADDRESS PRIVACY</span><h2>플랫폼별 주소 공개</h2></div></div>{(["naver","instagram","daangn","zigbang"] as Platform[]).map((p,index) => <div key={p}><span className={`platform-logo ${p}`}>{platformInitial[p]}</span><strong>{platformName[p]}</strong><small>외부 게시물 주소</small><select defaultValue={index === 3 ? "전체 주소" : "동까지만 공개"}><option>동까지만 공개</option><option>전체 주소</option><option>주소 비공개</option></select></div>)}</div></section></div>; }

type NewEntityValues = { name: string; phone: string; detail: string; note: string };

function SimpleFormModal({ type, onClose, onSave }: { type: "customer" | "employee"; onClose: () => void; onSave: (values: NewEntityValues) => void }) {
  const [values, setValues] = useState<NewEntityValues>({ name: "", phone: "010-", detail: type === "customer" ? "원룸 문의" : "중개보조원", note: "" });
  const set = (key: keyof NewEntityValues, value: string) => setValues((current) => ({ ...current, [key]: value }));
  return <div className="modal-backdrop"><div className="simple-modal" role="dialog" aria-modal="true"><div className="wizard-head"><div><span className="eyebrow">NEW {type.toUpperCase()}</span><h2>{type === "customer" ? "고객 등록" : "직원 등록"}</h2></div><button aria-label="닫기" className="icon-button" onClick={onClose}><X size={20} /></button></div><div className="simple-form"><label>이름<input value={values.name} onChange={(event) => set("name", event.target.value)} autoFocus /></label><label>전화번호<input value={values.phone} onChange={(event) => set("phone", event.target.value)} /></label>{type === "customer" ? <><label>문의 유형<select value={values.detail} onChange={(event) => set("detail", event.target.value)}><option>원룸 문의</option><option>투룸 문의</option><option>오피스텔 문의</option></select></label><label>희망 조건<textarea value={values.note} onChange={(event) => set("note", event.target.value)} placeholder="예: 북문, 월 45만원 이하, 채광 우선" /></label></> : <label>직책<select value={values.detail} onChange={(event) => set("detail", event.target.value)}><option>중개보조원</option><option>현장 매니저</option><option>공인중개사</option></select></label>}</div><div className="modal-actions"><button className="secondary" onClick={onClose}>취소</button><button className="primary" disabled={!values.name.trim() || !values.phone.trim()} onClick={() => onSave(values)}><Check size={15} /> 등록</button></div></div></div>;
}

function EditEntityModal({ entity, onClose, onSave, onDelete }: { entity: Customer | Employee; onClose: () => void; onSave: (entity: Customer | Employee) => void; onDelete: () => void }) {
  const customer = "interest" in entity;
  const [draft, setDraft] = useState(entity);
  const change = (key: string, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  return <div className="modal-backdrop"><div className="simple-modal" role="dialog" aria-modal="true"><div className="wizard-head"><div><span className="eyebrow">EDIT {customer ? "CUSTOMER" : "EMPLOYEE"}</span><h2>{customer ? "고객 정보 수정" : "직원 정보 수정"}</h2></div><button aria-label="닫기" className="icon-button" onClick={onClose}><X size={20} /></button></div><div className="simple-form"><label>이름<input value={draft.name} onChange={(event) => change("name", event.target.value)} /></label><label>전화번호<input value={draft.phone} onChange={(event) => change("phone", event.target.value)} /></label>{customer ? <><label>희망 매물<input value={(draft as Customer).interest} onChange={(event) => change("interest", event.target.value)} /></label><label>예산<input value={(draft as Customer).budget} onChange={(event) => change("budget", event.target.value)} /></label><label>다음 확인<input value={(draft as Customer).followUp} onChange={(event) => change("followUp", event.target.value)} /></label><label>메모<textarea value={(draft as Customer).note} onChange={(event) => change("note", event.target.value)} /></label></> : <><label>직책<input value={(draft as Employee).role} onChange={(event) => change("role", event.target.value)} /></label><label>재직상태<select value={(draft as Employee).status} onChange={(event) => change("status", event.target.value)}><option>재직</option><option>휴직</option></select></label></>}</div><div className="modal-actions split-actions"><button className="danger-button" onClick={onDelete}>삭제</button><span /><button className="secondary" onClick={onClose}>취소</button><button className="primary" onClick={() => onSave(draft)}><Check size={15} /> 변경사항 저장</button></div></div></div>;
}

function EditPropertyModal({ property, onClose, onSave, onDelete }: { property: Property; onClose: () => void; onSave: (property: Property) => void; onDelete: () => void }) {
  const [draft, setDraft] = useState(property);
  const change = <K extends keyof Property>(key: K, value: Property[K]) => setDraft((current) => ({ ...current, [key]: value }));
  return <div className="modal-backdrop"><div className="simple-modal property-edit-modal" role="dialog" aria-modal="true"><div className="wizard-head"><div><span className="eyebrow">EDIT PROPERTY</span><h2>매물 정보 수정</h2></div><button aria-label="닫기" className="icon-button" onClick={onClose}><X size={20} /></button></div><div className="simple-form"><label>매물 제목<input value={draft.title} onChange={(event) => change("title", event.target.value)} /></label><label>매물 유형<select value={draft.type} onChange={(event) => change("type", event.target.value as Property["type"])}><option>원룸</option><option>투룸</option><option>오피스텔</option></select></label><label>상태<select value={draft.status} onChange={(event) => change("status", event.target.value as Property["status"])}><option>등록 대기</option><option>검토 완료</option><option>광고 중</option><option>계약 진행</option><option>거래 완료</option><option>보류</option><option>종료</option></select></label><label>정확한 주소<input value={draft.exactAddress} onChange={(event) => change("exactAddress", event.target.value)} /></label><label>보증금<input type="number" value={draft.deposit} onChange={(event) => change("deposit", Number(event.target.value))} /></label><label>월세<input type="number" value={draft.rent} onChange={(event) => change("rent", Number(event.target.value))} /></label><label>관리비<input type="number" value={draft.maintenance} onChange={(event) => change("maintenance", Number(event.target.value))} /></label><label>플랫폼 원고<textarea value={draft.employeeCopy || ""} onChange={(event) => change("employeeCopy", event.target.value)} /></label></div><div className="modal-actions split-actions"><button className="danger-button" onClick={onDelete}>매물 삭제</button><span /><button className="secondary" onClick={onClose}>취소</button><button className="primary" disabled={!draft.title.trim() || !draft.exactAddress.trim()} onClick={() => onSave(draft)}><Check size={15} /> 변경사항 저장</button></div></div></div>;
}

export function BarjungApp() {
  const [view,setView] = useState<View>("dashboard"); const [properties,setProperties] = useState(seedProperties); const [selected,setSelected] = useState<Property | null>(null); const [editingProperty,setEditingProperty] = useState<Property | null>(null); const [wizard,setWizard] = useState(false); const [distribution,setDistribution] = useState<Property | null>(null); const [mobileNav,setMobileNav] = useState(false); const [form,setForm] = useState<{type:"customer"|"employee"}|null>(null); const [editing,setEditing] = useState<Customer | Employee | null>(null); const [customers,setCustomers] = useState(seedCustomers); const [employees,setEmployees] = useState(seedEmployees); const [toast,setToast] = useState("");
  const distributionId = distribution?.id;
  const updateTargets = useCallback((targets: DistributionTarget[]) => {
    if (!distributionId) return;
    setProperties((items) => items.map((p) => p.id === distributionId ? { ...p, targets } : p));
  }, [distributionId]);
  const showToast = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2500); };
  return <div className="app-shell"><div className={mobileNav ? "mobile-scrim show" : "mobile-scrim"} onClick={() => setMobileNav(false)} /><div className={mobileNav ? "sidebar-wrap open" : "sidebar-wrap"}><Sidebar view={view} onView={(v) => { setView(v); setMobileNav(false); }} /></div><main><Topbar view={view} onMenu={() => setMobileNav(true)} /><div className="content">
    {view === "dashboard" && <Dashboard properties={properties} onView={setView} onSelect={setSelected} />}
    {view === "properties" && <PropertiesView properties={properties} onSelect={setSelected} onNew={() => setWizard(true)} />}
    {view === "customers" && <CustomersView customers={customers} onAdd={() => setForm({type:"customer"})} onEdit={setEditing} />}
    {view === "employees" && <EmployeesView employees={employees} onAdd={() => setForm({type:"employee"})} onEdit={setEditing} />}
    {view === "settings" && <SettingsView />}
  </div></main>
  {selected && <PropertyDetail property={properties.find((p) => p.id === selected.id) || selected} onClose={() => setSelected(null)} onPublish={() => { setDistribution(selected); setSelected(null); }} onEdit={() => { setEditingProperty(properties.find((property) => property.id === selected.id) || selected); setSelected(null); }} />}
  {wizard && <PropertyWizard onClose={() => setWizard(false)} onFinish={(property) => { setProperties((p) => [property,...p]); setWizard(false); setSelected(property); showToast("새 매물을 등록했습니다."); }} />}
  {distribution && <DistributionModal property={distribution} onClose={() => setDistribution(null)} onUpdate={updateTargets} />}
  {form && <SimpleFormModal type={form.type} onClose={() => setForm(null)} onSave={(values) => { if (form.type === "customer") setCustomers((items) => [{ id:`c${Date.now()}`, name:values.name, phone:values.phone, interest:values.detail.replace(" 문의", ""), budget:values.note || "조건 확인 중", followUp:"일정 미정", note:values.note || "메모 없음" },...items]); else setEmployees((items) => [{ id:`e${Date.now()}`, name:values.name, phone:values.phone, role:values.detail, status:"재직" },...items]); showToast(`${values.name} ${form.type === "customer" ? "고객을" : "직원을"} 등록했습니다.`); setForm(null); }} />}
  {editing && <EditEntityModal entity={editing} onClose={() => setEditing(null)} onSave={(updated) => { if ("interest" in updated) setCustomers((items) => items.map((item) => item.id === updated.id ? updated : item)); else setEmployees((items) => items.map((item) => item.id === updated.id ? updated : item)); setEditing(null); showToast("변경사항을 저장했습니다."); }} onDelete={() => { if ("interest" in editing) setCustomers((items) => items.filter((item) => item.id !== editing.id)); else setEmployees((items) => items.filter((item) => item.id !== editing.id)); showToast(`${editing.name} 정보를 삭제했습니다.`); setEditing(null); }} />}
  {editingProperty && <EditPropertyModal property={editingProperty} onClose={() => setEditingProperty(null)} onSave={(updated) => { setProperties((items) => items.map((item) => item.id === updated.id ? { ...updated, updatedAt: "방금 전" } : item)); setEditingProperty(null); showToast("매물 정보를 저장했습니다."); }} onDelete={() => { setProperties((items) => items.filter((item) => item.id !== editingProperty.id)); showToast(`${editingProperty.number} 매물을 삭제했습니다.`); setEditingProperty(null); }} />}
  {toast && <div className="toast"><Check size={16} /> {toast}</div>}
  </div>;
}
