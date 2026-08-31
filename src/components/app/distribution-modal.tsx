"use client";

import { Activity, Check, CheckCircle2, Clock3, ExternalLink, RefreshCcw, ShieldCheck, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  initialPlatforms?: Platform[];
}

function useDemoSimulation(enabled: boolean, platforms: Platform[], setTargets: React.Dispatch<React.SetStateAction<DistributionTarget[]>>) {
  useEffect(() => {
    if (!enabled) return;
    const timers: number[] = [];
    platforms.forEach((platform, index) => {
      timers.push(window.setTimeout(() => setTargets((prev) => prev.map((t) => (t.platform === platform ? { ...t, status: "running" as PublishStatus, progress: 38 } : t))), 500 + index * 450));
      timers.push(window.setTimeout(() => setTargets((prev) => prev.map((t) => (t.platform === platform ? { ...t, status: "not_configured", progress: 100, error: "고객 PC에서 플랫폼 동작을 연결해야 합니다." } : t))), 1700 + index * 550));
    });
    return () => timers.forEach(clearTimeout);
  }, [enabled, platforms, setTargets]);
}

export function DistributionModal({ property, mode, agent, onClose, onUpdate, requestDistribution, getProperty, initialPlatforms }: DistributionModalProps) {
  const live = mode === "live";
  const activePlatforms = useMemo(() => initialPlatforms?.length ? PLATFORMS.filter((platform) => initialPlatforms.includes(platform)) : [...PLATFORMS], [initialPlatforms]);
  const [targets, setTargets] = useState<DistributionTarget[]>(() => PLATFORMS.map((platform) => ({ platform, status: activePlatforms.includes(platform) ? "queued" : "not_requested", progress: 0 })));
  const [error, setError] = useState("");
  const [retrying, setRetrying] = useState<Platform | "all" | null>(null);
  const [completionAcknowledged, setCompletionAcknowledged] = useState(false);
  const requested = useRef(false);

  useDemoSimulation(!live, activePlatforms, setTargets);

  // 라이브: 배포 요청 → 실행기 결과를 2초마다 확인
  useEffect(() => {
    if (!live || requested.current) return;
    requested.current = true;
    let alive = true;
    requestDistribution(property.id, initialPlatforms)
      .then((updated) => { if (alive) setTargets(updated.targets); })
      .catch((cause: unknown) => { if (alive) setError(cause instanceof Error ? cause.message : "배포 요청에 실패했습니다."); });
    return () => { alive = false; };
  }, [live, property.id, requestDistribution, initialPlatforms]);

  const activeTargets = targets.filter((target) => activePlatforms.includes(target.platform));
  const pending = activeTargets.some((target) => !terminalStatuses.has(target.status));
  useEffect(() => {
    if (!pending) return;
    const timer = window.setInterval(() => {
      setTargets((current) => current.map((target) => target.status === "running"
        ? { ...target, progress: Math.min(92, Math.max(8, target.progress) + 3) }
        : target));
    }, 700);
    return () => window.clearInterval(timer);
  }, [pending]);

  useEffect(() => {
    if (!live || !pending) return;
    const timer = window.setInterval(async () => {
      const latest = await getProperty(property.id);
      if (latest) setTargets((current) => latest.targets.map((target) => {
        const previous = current.find((item) => item.platform === target.platform);
        return target.status === "running" && previous?.status === "running"
          ? { ...target, progress: Math.max(target.progress, previous.progress) }
          : target;
      }));
    }, LIVE_TARGET_POLL_MS);
    return () => window.clearInterval(timer);
  }, [live, pending, property.id, getProperty]);

  useEffect(() => onUpdate(targets), [targets, onUpdate]);

  const retry = useCallback(async (platform?: Platform) => {
    setRetrying(platform ?? "all"); setError(""); setCompletionAcknowledged(false);
    if (!live) {
      setTargets((prev) => prev.map((t) => (t.status === "not_configured" || t.status === "failed") && (!platform || t.platform === platform) ? { ...t, status: "running", progress: 72, error: undefined } : t));
      window.setTimeout(() => { setTargets((prev) => prev.map((t) => (t.status === "running" ? { ...t, status: "not_configured", progress: 100, error: "현장 연결 전에는 게시하지 않습니다." } : t))); setRetrying(null); }, 800);
      return;
    }
    try { const updated = await requestDistribution(property.id, platform ? [platform] : undefined); setTargets(updated.targets); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "재시도에 실패했습니다."); }
    finally { setRetrying(null); }
  }, [live, property.id, requestDistribution]);

  const progress = activeTargets.length ? Math.round(activeTargets.reduce((sum, target) => sum + target.progress, 0) / activeTargets.length) : 0;
  const allDone = !pending;
  const allSucceeded = activeTargets.length > 0 && activeTargets.every((target) => target.status === "succeeded");
  const incompleteTargets = activeTargets.filter((target) => target.status !== "succeeded");
  const heading = error ? "전체 발행 요청을 처리하지 못했습니다" : allDone ? "전체 발행 결과" : live ? "플랫폼별 순차 발행 중입니다" : "전체 발행 준비 상태를 확인하고 있습니다";

  return (
    <div className="modal-backdrop"><div className="distribution-modal" role="dialog" aria-modal="true">
      {allDone && !completionAcknowledged && <div className="distribution-complete-overlay" role="alertdialog" aria-modal="true" aria-labelledby="distribution-complete-title"><div className="distribution-complete-box"><CheckCircle2 size={34} /><h3 id="distribution-complete-title">{allSucceeded ? "선택한 플랫폼 발행이 완료되었습니다." : "선택한 플랫폼 발행 처리가 끝났습니다."}</h3><p>{allSucceeded ? `${activePlatforms.length}개 플랫폼에 순서대로 게시했습니다.` : "성공한 플랫폼은 완료됐으며, 아래 실패 항목만 다시 발행할 수 있습니다."}</p>{incompleteTargets.length > 0 && <div className="distribution-failure-list">{incompleteTargets.map((target) => <div key={target.platform}><strong>{platformName[target.platform]}</strong><span>{target.error || "플랫폼 연결 또는 로그인 상태를 확인하세요."}</span></div>)}</div>}<button type="button" className="primary" onClick={() => setCompletionAcknowledged(true)}><Check size={15} /> 결과 확인</button></div></div>}
      <div className="wizard-head"><div><span className="eyebrow">LOCAL PLAYWRIGHT RUNNER</span><h2>{heading}</h2><p>{property.number} · {property.area} {property.type}</p></div><button className="icon-button" aria-label="닫기" onClick={onClose}><X size={20} /></button></div>
      <div className="overall-progress"><div><span>{allDone ? "확인 완료" : "전체 진행률"}</span><strong>{progress}%</strong></div><div className="progress"><i style={{ width: `${progress}%` }} /></div><small><span className={`live-dot ${agent.status}`} /> {agent.deviceName} · {agent.label}</small></div>
      {live && agent.status !== "online" && !allDone && <div className="error-guide"><Activity size={17} /><span>실행기가 오프라인입니다. 고객 PC에서 <strong>.\scripts\start-runner.ps1</strong> 를 실행하면 대기 작업을 이어서 처리합니다.</span></div>}
      {error && <div className="error-guide"><Activity size={17} /><span>{error}</span></div>}
      <div className="distribution-list">
        {targets.map((t) => { const selected = activePlatforms.includes(t.platform); return (
          <div className={`distribution-row ${t.status}`} key={t.platform}>
            <PlatformLogo platform={t.platform} />
            <div className="distribution-copy"><strong>{platformName[t.platform]}</strong><small>{!selected ? "이번 발행에서 선택하지 않음" : t.status === "queued" ? "앞 플랫폼 발행 완료 대기 중" : t.status === "running" ? "사진과 게시글을 업로드하는 중" : t.status === "succeeded" ? "발행 완료" : t.error ?? t.status}</small>{selected && <div className="mini-progress"><i className={t.status === "succeeded" ? "complete" : ""} style={{ width: `${t.progress}%` }} /></div>}</div>
            {t.status === "succeeded" && t.url && <a href={t.url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> 열기</a>}
            {selected && (t.status === "failed" || t.status === "not_configured") && <button className="retry-button" aria-label={`${platformName[t.platform]}만 재발행`} onClick={() => retry(t.platform)} disabled={retrying !== null}><RefreshCcw size={14} /> 이 플랫폼 재발행</button>}
            {t.status === "succeeded" && <CheckCircle2 className="distribution-done" size={19} />}
            {t.status === "running" && <Activity className="spin" size={17} />}
            {t.status === "queued" && <Clock3 size={17} />}
          </div>
        ); })}
      </div>
      <div className="distribution-foot"><span><ShieldCheck size={15} /> 실제 사이트 어댑터 연결 전에는 게시하지 않습니다.</span><button className={allDone ? "primary" : "secondary"} onClick={onClose}>{allDone ? "확인" : "백그라운드에서 계속"}</button></div>
    </div></div>
  );
}
