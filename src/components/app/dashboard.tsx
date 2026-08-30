"use client";

import { ArrowRight, ChevronRight, Home, Plus } from "lucide-react";
import type { Property } from "@/lib/domain/types";
import type { View } from "./shell";
import { Badge, PlatformLogo, money, platformName, propertyStatusTone } from "./ui";

function Metric({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: string }) {
  return <div className={`metric ${tone || ""}`}><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>;
}

export function Dashboard({ properties, onView, onSelect, onNew }: { properties: Property[]; onView: (view: View) => void; onSelect: (property: Property) => void; onNew: () => void }) {
  const active = properties.filter((p) => p.status === "광고 중").length;
  const review = properties.filter((p) => p.status === "등록 대기" || p.status === "검토 완료").length;
  const failedTargets = properties.flatMap((p) => p.targets.filter((t) => t.status === "failed").map((t) => ({ property: p, target: t })));
  const failed = new Set(failedTargets.map((item) => item.property.id)).size;
  const failedNote = failedTargets[0] ? `${platformName[failedTargets[0].target.platform]} · ${failedTargets[0].target.error ?? "확인 필요"}` : "실패 없음";

  return (
    <div className="view-stack">
      <section className="page-intro dashboard-intro">
        <div><span className="eyebrow">TODAY&apos;S PROPERTY DESK</span><h1>매물의 시작부터<br /><em>게시 완료까지.</em></h1><p>경북대 인근 매물과 네 채널의 배포 상태를 한 자리에서 확인하세요.</p></div>
        <div className="intro-actions"><button className="primary" onClick={onNew}><Plus size={17} /> 새 매물 등록</button></div>
      </section>
      <section className="metrics-row">
        <Metric label="전체 매물" value={String(properties.length)} sub="현재 등록 기준" />
        <Metric label="광고 중" value={String(active)} sub="4개 채널 기준" tone="blue" />
        <Metric label="검토 대기" value={String(review)} sub="고지 확인 필요" tone="amber" />
        <Metric label="배포 실패" value={String(failed)} sub={failedNote} tone="red" />
      </section>
      <section className="panel recent-panel">
        <div className="panel-head"><div><span className="eyebrow">RECENT LISTINGS</span><h2>최근 등록 매물</h2></div><button className="text-button" onClick={() => onView("properties")}>매물 전체 보기 <ArrowRight size={14} /></button></div>
        <div className="property-mini-list">
          {properties.length === 0 && <p className="empty-note">아직 등록된 매물이 없습니다. 오른쪽 위 <strong>새 매물 등록</strong>으로 시작하세요.</p>}
          {properties.slice(0, 4).map((p) => (
            <button key={p.id} onClick={() => onSelect(p)}>
              <span className="property-thumb" style={{ background: p.accent }}><Home size={19} /></span>
              <span className="mini-main"><small>{p.number} · {p.area}</small><strong>{p.title}</strong><em>보증금 {money(p.deposit)} / 월 {p.rent} · 관리비 {p.maintenance}</em></span>
              <Badge tone={propertyStatusTone(p.status)}>{p.status}</Badge>
              <span className="platform-brand-row">{p.targets.map((target) => <PlatformLogo key={target.platform} platform={target.platform} compact status={target.status} />)}</span>
              <ChevronRight size={17} />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
