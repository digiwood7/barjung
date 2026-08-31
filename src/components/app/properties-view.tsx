"use client";

import { ChevronRight, ExternalLink, Home, ListFilter, MapPin, Plus, Search, ShieldCheck, X, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { validateDisclosure } from "@/lib/domain/legal-disclosure";
import type { OfficeInfo, Property, WorkspaceMode } from "@/lib/domain/types";
import { filterProperties } from "@/lib/mock/selectors";
import { Badge, PlatformDots, PlatformLogo, disclosureLabel, money, platformName, propertyStatusTone, targetSummary } from "./ui";

interface PropertiesViewProps {
  properties: Property[];
  mode: WorkspaceMode;
  onSelect: (property: Property) => void;
  onNew: () => void;
}

export function PropertiesView({ properties, mode, onSelect, onNew }: PropertiesViewProps) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("전체");
  const [status, setStatus] = useState("전체");
  const [publish, setPublish] = useState<"all" | "done" | "failed" | "unpublished">("all");
  const filtered = useMemo(() => filterProperties(properties, { query, type, status, publish }), [properties, query, type, status, publish]);

  return (
    <div className="view-stack">
      <section className="page-heading"><div><span className="eyebrow">PROPERTY LEDGER</span><h1>매물관리</h1><p>매물 원본과 플랫폼별 배포 결과를 함께 관리합니다.</p></div><button className="primary desktop-create" onClick={onNew}><Plus size={17} /> 새 매물 등록</button></section>
      <section className="panel table-panel">
        <div className="filters">
          <label className="search-field"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="매물번호, 주소, 제목 검색" /></label>
          <select aria-label="매물 유형 필터" value={type} onChange={(e) => setType(e.target.value)}><option>전체</option><option>원룸</option><option>투룸</option><option>오피스텔</option></select>
          <select aria-label="매물 상태 필터" value={status} onChange={(e) => setStatus(e.target.value)}><option>전체</option><option>등록 대기</option><option>검토 완료</option><option>광고 중</option><option>계약 진행</option><option>거래 완료</option><option>보류</option><option>종료</option></select>
          <select aria-label="배포 상태 필터" value={publish} onChange={(e) => setPublish(e.target.value as typeof publish)}><option value="all">전체 배포상태</option><option value="done">배포 완료</option><option value="failed">실패 있음</option><option value="unpublished">미배포</option></select>
          <button className="filter-button" type="button"><ListFilter size={16} /> 상세 필터</button>
        </div>
        <div className="table-meta"><strong>전체 {filtered.length}건</strong><span>{mode === "live" ? "5초마다 고객 DB와 동기화" : "데모 데이터"}</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>매물</th><th>거래조건</th><th>상태</th><th>등록 정보</th><th>플랫폼 배포</th><th /></tr></thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={6} className="empty-cell">조건에 맞는 매물이 없습니다.</td></tr>}
              {filtered.map((p) => (
                <tr key={p.id} onClick={() => onSelect(p)}>
                  <td><div className="property-cell"><span className="property-thumb" style={{ background: p.accent }}><Home size={18} /><i>{p.photos}</i></span><div><small>{p.number} · {p.area}</small><strong>{p.title}</strong><em>{p.type} · {p.publicAddress}</em></div></div></td>
                  <td><strong>보증금 {money(p.deposit)}</strong><small>월 {p.rent} · 관리비 {p.maintenance}</small></td>
                  <td><Badge tone={propertyStatusTone(p.status)}>{p.status}</Badge></td>
                  <td><strong>{p.registeredBy}</strong><small>{p.createdAt}</small></td>
                  <td><PlatformDots targets={p.targets} /></td>
                  <td><ChevronRight size={17} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export function photoUploadCommand(office: OfficeInfo, property: Property): string {
  return [
    ". .\\scripts\\import-project-env.ps1",
    "python\\.venv\\Scripts\\python.exe -m barjung_media.cli \"C:\\매물사진\\*.jpg\" `",
    "  --output \".\\tmp\\optimized\" --manifest \".\\tmp\\manifest.json\" `",
    `  --upload --office-id "${office.id}" --property-id "${property.id}"`,
  ].join("\n");
}

interface PropertyDetailProps {
  property: Property;
  office: OfficeInfo;
  mode: WorkspaceMode;
  onClose: () => void;
  onPublish: () => void;
  onEdit: () => void;
}

export function PropertyDetail({ property, office, mode, onClose, onPublish, onEdit }: PropertyDetailProps) {
  const missing = validateDisclosure(property.disclosure).map((key) => disclosureLabel[key]);
  const thumbs = Math.min(3, property.photos);
  const naver = property.targets.find((target) => target.platform === "naver");
  const naverReady = naver?.status === "succeeded" || (naver?.status === "not_configured" && naver.errorCode === "draft_saved");
  const naverBusy = naver?.status === "queued" || naver?.status === "running";
  return (
    <div className="drawer-backdrop" onMouseDown={onClose}>
      <aside className="detail-drawer" onMouseDown={(e) => e.stopPropagation()}>
        <div className="drawer-head"><div><span className="eyebrow">{property.number}</span><h2>{property.title}</h2></div><button className="icon-button" aria-label="닫기" onClick={onClose}><X size={20} /></button></div>
        <div className="photo-strip">
          {thumbs === 0 && <span className="photo-empty"><Home size={22} /><small>사진 없음</small></span>}
          {Array.from({ length: thumbs }).map((_, n) => <span key={n} style={{ background: property.accent }}><Home size={22} /></span>)}
          {property.photos > 3 && <span className="photo-more">+{property.photos - 3}</span>}
        </div>
        <div className="detail-summary"><div><small>거래조건</small><strong>보증금 {money(property.deposit)} / 월 {property.rent}</strong></div><div><small>매물 상태</small><Badge tone={propertyStatusTone(property.status)}>{property.status}</Badge></div></div>
        <section className="detail-section"><div className="section-title"><h3>주소 정보</h3><Badge tone="blue">내부 전용</Badge></div><p className="address-line"><MapPin size={16} /> {property.exactAddress}</p><small>외부 게시: {property.publicAddress} · 플랫폼별 공개 범위 적용</small></section>
        {mode === "live" && property.photos === 0 && (
          <section className="detail-section"><div className="section-title"><h3>사진 업로드</h3><Badge tone="amber">Windows PC</Badge></div><small>고객 PC PowerShell 에서 아래를 실행하면 원본은 두고 최적화 사진만 고객 Storage 에 올라갑니다.</small><pre className="code-block">{photoUploadCommand(office, property)}</pre></section>
        )}
        <section className="detail-section">
          <div className="section-title"><h3>공인중개사법 고지사항</h3>{missing.length ? <Badge tone="red">{missing.length}개 누락</Badge> : <Badge tone="green"><ShieldCheck size={12} /> 검증 완료</Badge>}</div>
          <div className="legal-grid">{(Object.keys(disclosureLabel) as Array<keyof typeof disclosureLabel>).map((key) => <div key={key}><small>{disclosureLabel[key]}</small><strong className={!property.disclosure[key] ? "missing" : ""}>{property.disclosure[key] || "입력 필요"}</strong></div>)}</div>
        </section>
        <section className="detail-section">
          <div className="section-title"><h3>플랫폼 배포</h3><small>배지를 누르면 결과를 확인합니다.</small></div>
          <div className="platform-detail-list">
            {property.targets.map((t) => (
              <div key={t.platform}>
                <PlatformLogo platform={t.platform} />
                <div><strong>{platformName[t.platform]}</strong><small>{targetSummary(t)}</small></div>
                {t.status === "succeeded" && t.url ? <a href={t.url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> 링크</a> : t.status === "failed" ? <Badge tone="red">실패</Badge> : t.status === "queued" || t.status === "running" ? <Badge tone="blue">진행</Badge> : <Badge>미배포</Badge>}
              </div>
            ))}
          </div>
        </section>
        <div className="drawer-actions"><button className="secondary" onClick={onEdit}>매물 수정</button><button className="primary" disabled={missing.length > 0 || naverBusy} onClick={onPublish}><Zap size={16} /> {naverReady ? "후속 플랫폼 배포" : naverBusy ? "네이버 작업 진행 중" : "네이버 글쓰기 시작"}</button></div>
      </aside>
    </div>
  );
}
