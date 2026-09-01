"use client";

import { Bot, Database, Plus, X, Zap } from "lucide-react";
import { useState } from "react";
import { normalizeInquiryTypeLabel, PLATFORMS } from "@/lib/domain/types";
import type { AddressPolicy, AgentStatus, AppSettings, OfficeInfo, PlatformConnection, Property, WorkspaceMode } from "@/lib/domain/types";
import { PlatformConnectionCards } from "./platform-connection-cards";
import { Badge, platformInitial, platformName } from "./ui";

const policyLabel: Record<AddressPolicy, string> = { district: "동까지만 공개", lot: "전체 주소", hidden: "주소 비공개" };

interface SettingsViewProps {
  settings: AppSettings;
  agent: AgentStatus;
  connections?: PlatformConnection[];
  office: OfficeInfo;
  mode: WorkspaceMode;
  properties: Property[];
  onRefresh?: () => Promise<void>;
  onUpdate: (patch: Partial<AppSettings>) => Promise<unknown>;
}

export function SettingsView({ settings, agent, connections = [], office, mode, properties, onRefresh, onUpdate }: SettingsViewProps) {
  const [showConnection, setShowConnection] = useState(false);
  const [inquiryDraft, setInquiryDraft] = useState("");
  const photoCount = properties.reduce((sum, property) => sum + property.photos, 0);
  const videoCount = properties.filter((property) => property.hasVideo).length;
  const auto = settings.publishMode === "automatic";

  const addInquiryType = async (event: React.FormEvent) => {
    event.preventDefault();
    const inquiryType = normalizeInquiryTypeLabel(inquiryDraft);
    if (!inquiryType || settings.inquiryTypes.includes(inquiryType)) return;
    await onUpdate({ inquiryTypes: [...settings.inquiryTypes, inquiryType] });
    setInquiryDraft("");
  };
  const removeInquiryType = async (inquiryType: string) => {
    if (settings.inquiryTypes.length <= 1) return;
    await onUpdate({ inquiryTypes: settings.inquiryTypes.filter((value) => value !== inquiryType) });
  };
  return (
    <div className="view-stack">
      <section className="page-heading"><div><span className="eyebrow">WORKSPACE SETTINGS</span><h1>운영 설정</h1><p>배포 방식과 플랫폼별 주소 공개 범위를 설정합니다.</p></div></section>
      <section className="settings-grid">
        <div className="panel setting-card span-2">
          <div className="setting-icon"><Zap size={20} /></div>
          <div><h3>매물 배포 모드</h3><p>초기 일주일은 검수 후 배포하고, 안정화되면 자동 발행으로 전환합니다.</p></div>
          <button className={`mode-toggle ${auto ? "on" : ""}`} aria-pressed={auto} onClick={() => onUpdate({ publishMode: auto ? "review" : "automatic" })}><span /><strong>{auto ? "자동 발행" : "검수 후 배포"}</strong></button>
        </div>
        <div className="panel setting-card">
          <div className={`setting-icon ${agent.status === "online" ? "green" : ""}`}><Bot size={20} /></div>
          <div><h3>Windows 실행기</h3><p>{agent.deviceName}</p><Badge tone={agent.status === "online" ? "green" : agent.status === "degraded" ? "amber" : "slate"}><span className={`live-dot ${agent.status}`} /> {agent.label}</Badge></div>
          <button className="secondary" onClick={() => setShowConnection((value) => !value)}>{showConnection ? "닫기" : "연결 정보"}</button>
          {showConnection && (
            <dl className="connection-info">
              <dt>모드</dt><dd>{mode === "live" ? "고객 Supabase 연결" : "데모 (브라우저 메모리)"}</dd>
              <dt>사업장 ID</dt><dd><code>{office.id}</code></dd>
              <dt>실행기 ID</dt><dd><code>{agent.id ?? "seed 미적용"}</code></dd>
              <dt>실행 명령</dt><dd><code>.\scripts\start-runner.ps1</code></dd>
            </dl>
          )}
        </div>
        <PlatformConnectionCards connections={connections} onRefresh={onRefresh} />
        <div className="panel setting-card">
          <div className="setting-icon blue"><Database size={20} /></div>
          <div><h3>Supabase 저장공간</h3><p>최적화 사진과 세로 영상 원본을 분리 저장합니다.</p><div className="storage-bar"><i style={{ width: `${Math.min(100, photoCount + videoCount)}%` }} /></div><small>{mode === "live" ? `사진 ${photoCount}장 · 세로 영상 ${videoCount}개 저장됨` : "데모 모드 — 저장공간 집계 없음"}</small></div>
        </div>
        <div className="panel inquiry-settings span-2">
          <div className="panel-head"><div><span className="eyebrow">CUSTOMER INQUIRY</span><h2>고객 문의 유형</h2><p>추가한 항목은 고객 등록 모달의 문의 유형 선택지에 바로 반영됩니다.</p></div></div>
          <form className="inquiry-add-form" onSubmit={addInquiryType}>
            <input aria-label="새 문의 유형" value={inquiryDraft} maxLength={30} placeholder="예: 상가 임대" onChange={(event) => setInquiryDraft(event.target.value)} />
            <button className="primary" type="submit" disabled={!normalizeInquiryTypeLabel(inquiryDraft) || settings.inquiryTypes.includes(normalizeInquiryTypeLabel(inquiryDraft))}><Plus size={15} /> 추가</button>
          </form>
          <div className="inquiry-type-list">
            {settings.inquiryTypes.map((inquiryType) => (
              <span key={inquiryType}>{inquiryType}<button type="button" aria-label={`${inquiryType} 삭제`} title={settings.inquiryTypes.length <= 1 ? "문의 유형은 하나 이상 필요합니다." : `${inquiryType} 삭제`} disabled={settings.inquiryTypes.length <= 1} onClick={() => removeInquiryType(inquiryType)}><X size={13} /></button></span>
            ))}
          </div>
        </div>
        <div className="panel address-settings span-2">
          <div className="panel-head"><div><span className="eyebrow">ADDRESS PRIVACY</span><h2>플랫폼별 주소 공개</h2></div></div>
          {PLATFORMS.map((platform) => (
            <div key={platform}>
              <span className={`platform-logo ${platform}`}>{platformInitial[platform]}</span><strong>{platformName[platform]}</strong><small>외부 게시물 주소</small>
              <select aria-label={`${platformName[platform]} 주소 공개 범위`} value={settings.publicAddressPolicy[platform]} onChange={(event) => onUpdate({ publicAddressPolicy: { ...settings.publicAddressPolicy, [platform]: event.target.value as AddressPolicy } })}>
                {(Object.keys(policyLabel) as AddressPolicy[]).map((policy) => <option key={policy} value={policy}>{policyLabel[policy]}</option>)}
              </select>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
