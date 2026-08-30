"use client";

import { Activity, Clock3, ExternalLink, RefreshCcw, ShieldCheck, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { PLATFORMS } from "@/lib/domain/types";
import type { AgentStatus, DistributionTarget, Platform, Property, PublishStatus, WorkspaceMode } from "@/lib/domain/types";
import { PlatformLogo, platformName, terminalStatuses } from "./ui";

export const LIVE_TARGET_POLL_MS = 2000;

interface DistributionModalProps {
  property: Property;
  mode: WorkspaceMode;
  agent: AgentStatus;
  onClose: () => void;
  onUpdate: (targets: DistributionTarget[]) => void;
  requestDistribution: (propertyId: string, platforms?: Platform[]) => Promise<Property>;
  getProperty: (propertyId: string) => Promise<Property | null>;
}

function useDemoSimulation(enabled: boolean, setTargets: React.Dispatch<React.SetStateAction<DistributionTarget[]>>) {
  useEffect(() => {
    if (!enabled) return;
    const timers: number[] = [];
    PLATFORMS.forEach((platform, index) => {
      timers.push(window.setTimeout(() => setTargets((prev) => prev.map((t) => (t.platform === platform ? { ...t, status: "running" as PublishStatus, progress: 38 } : t))), 500 + index * 450));
      timers.push(window.setTimeout(() => setTargets((prev) => prev.map((t) => (t.platform === platform ? { ...t, status: "not_configured", progress: 100, error: "고객 PC에서 플랫폼 동작을 연결해야 합니다." } : t))), 1700 + index * 550));
    });
    return () => timers.forEach(clearTimeout);
  }, [enabled, setTargets]);
}

export function DistributionModal({ property, mode, agent, onClose, onUpdate, requestDistribution, getProperty }: DistributionModalProps) {
  const live = mode === "live";
  const [targets, setTargets] = useState<DistributionTarget[]>(() => PLATFORMS.map((platform) => ({ platform, status: "queued", progress: 0 })));
  const [error, setError] = useState("");
  const [retrying, setRetrying] = useState<Platform | "all" | null>(null);
  const requested = useRef(false);

  useDemoSimulation(!live, setTargets);

  // 라이브: 배포 요청 → 실행기 결과를 2초마다 확인
  useEffect(() => {
    if (!live || requested.current) return;
    requested.current = true;
    let alive = true;
    requestDistribution(property.id)
      .then((updated) => { if (alive) setTargets(updated.targets); })
      .catch((cause: unknown) => { if (alive) setError(cause instanceof Error ? cause.message : "배포 요청에 실패했습니다."); });
    return () => { alive = false; };
  }, [live, property.id, requestDistribution]);

  const pending = targets.some((t) => !terminalStatuses.has(t.status));
  useEffect(() => {
    if (!live || !pending) return;
    const timer = window.setInterval(async () => {
      const latest = await getProperty(property.id);
      if (latest) setTargets(latest.targets);
    }, LIVE_TARGET_POLL_MS);
    return () => window.clearInterval(timer);
  }, [live, pending, property.id, getProperty]);

  useEffect(() => onUpdate(targets), [targets, onUpdate]);

  const retry = useCallback(async (platform?: Platform) => {
    setRetrying(platform ?? "all"); setError("");
    if (!live) {
      setTargets((prev) => prev.map((t) => (t.status === "not_configured" || t.status === "failed") && (!platform || t.platform === platform) ? { ...t, status: "running", progress: 72, error: undefined } : t));
      window.setTimeout(() => { setTargets((prev) => prev.map((t) => (t.status === "running" ? { ...t, status: "not_configured", progress: 100, error: "현장 연결 전에는 게시하지 않습니다." } : t))); setRetrying(null); }, 800);
      return;
    }
    try { const updated = await requestDistribution(property.id, platform ? [platform] : undefined); setTargets(updated.targets); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "재시도에 실패했습니다."); }
    finally { setRetrying(null); }
  }, [live, property.id, requestDistribution]);

  const progress = Math.round(targets.reduce((sum, t) => sum + t.progress, 0) / targets.length);
  const allDone = !pending;
  const heading = error ? "배포 요청을 처리하지 못했습니다" : allDone ? (live ? "실행기 처리 결과입니다" : "플랫폼 연결 상태를 확인했습니다") : live ? "Windows 실행기가 큐를 처리하는 중입니다" : "배포 준비 상태를 확인하고 있습니다";

  return (
    <div className="modal-backdrop"><div className="distribution-modal" role="dialog" aria-modal="true">
      <div className="wizard-head"><div><span className="eyebrow">LOCAL PLAYWRIGHT RUNNER</span><h2>{heading}</h2><p>{property.number} · {property.area} {property.type}</p></div><button className="icon-button" aria-label="닫기" onClick={onClose}><X size={20} /></button></div>
      <div className="overall-progress"><div><span>{allDone ? "확인 완료" : "전체 진행률"}</span><strong>{progress}%</strong></div><div className="progress"><i style={{ width: `${progress}%` }} /></div><small><span className={`live-dot ${agent.status}`} /> {agent.deviceName} · {agent.label}</small></div>
      {live && agent.status !== "online" && !allDone && <div className="error-guide"><Activity size={17} /><span>실행기가 오프라인입니다. 고객 PC에서 <strong>.\scripts\start-local.ps1 -WithRunner</strong> 를 실행하면 대기 작업을 이어서 처리합니다.</span></div>}
      {error && <div className="error-guide"><Activity size={17} /><span>{error}</span></div>}
      <div className="distribution-list">
        {targets.map((t) => (
          <div className={`distribution-row ${t.status}`} key={t.platform}>
            <PlatformLogo platform={t.platform} />
            <div className="distribution-copy"><strong>{platformName[t.platform]}</strong><small>{t.status === "queued" ? "작업 대기 중" : t.status === "running" ? "로그인과 어댑터 상태 확인 중" : t.status === "succeeded" ? "게시 완료 · 링크 확인 가능" : t.error ?? t.status}</small>{t.status === "running" && <div className="mini-progress"><i style={{ width: `${t.progress}%` }} /></div>}</div>
            {t.status === "succeeded" && t.url && <a href={t.url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> 열기</a>}
            {(t.status === "failed" || t.status === "not_configured") && <button className="retry-button" onClick={() => retry(t.platform)} disabled={retrying !== null}><RefreshCcw size={14} /> 다시 확인</button>}
            {t.status === "running" && <Activity className="spin" size={17} />}
            {t.status === "queued" && <Clock3 size={17} />}
          </div>
        ))}
      </div>
      <div className="distribution-foot"><span><ShieldCheck size={15} /> 실제 사이트 어댑터 연결 전에는 게시하지 않습니다.</span><button className={allDone ? "primary" : "secondary"} onClick={onClose}>{allDone ? "확인" : "백그라운드에서 계속"}</button></div>
    </div></div>
  );
}
