"use client";

import { Activity, Check, CheckCircle2, Clock3, ExternalLink, RefreshCcw, ShieldCheck, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PHOTO_PLATFORMS, PLATFORMS, VIDEO_PLATFORMS } from "@/lib/domain/types";
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
      timers.push(window.setTimeout(() => setTargets((prev) => prev.map((target) => target.platform === platform ? { ...target, status: "running" as PublishStatus, progress: 38 } : target)), 500 + index * 450));
      timers.push(window.setTimeout(() => setTargets((prev) => prev.map((target) => target.platform === platform ? { ...target, status: "not_configured", progress: 100, error: "고객 PC에서 플랫폼 동작을 연결해야 합니다." } : target)), 1700 + index * 550));
    });
    return () => timers.forEach(clearTimeout);
  }, [enabled, platforms, setTargets]);
}

export function DistributionModal({ property, mode, agent, onClose, onUpdate, requestDistribution, getProperty, initialPlatforms }: DistributionModalProps) {
  const live = mode === "live";
  const initialSelection = useMemo(() => initialPlatforms?.length
    ? PLATFORMS.filter((platform) => initialPlatforms.includes(platform))
    : [...PLATFORMS], [initialPlatforms]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(initialSelection);
  const [targets, setTargets] = useState<DistributionTarget[]>(() => PLATFORMS.map((platform) => ({ platform, status: "not_requested", progress: 0 })));
  const [started, setStarted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [retrying, setRetrying] = useState<Platform | "all" | null>(null);
  const [completionAcknowledged, setCompletionAcknowledged] = useState(false);

  const activePlatforms = useMemo(() => PLATFORMS.filter((platform) => selectedPlatforms.includes(platform)), [selectedPlatforms]);
  useDemoSimulation(!live && started, activePlatforms, setTargets);

  const activeTargets = targets.filter((target) => activePlatforms.includes(target.platform));
  const pending = started && activeTargets.some((target) => !terminalStatuses.has(target.status));

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

  useEffect(() => {
    if (started) onUpdate(targets);
  }, [started, targets, onUpdate]);

  const togglePlatform = (platform: Platform) => {
    setSelectedPlatforms((current) => current.includes(platform)
      ? current.filter((item) => item !== platform)
      : [...current, platform]);
  };

  const startDistribution = async () => {
    if (activePlatforms.length === 0) {
      setError("발행할 플랫폼을 한 개 이상 선택하세요.");
      return;
    }
    setError("");
    setStarting(true);
    setTargets(PLATFORMS.map((platform) => ({ platform, status: activePlatforms.includes(platform) ? "queued" : "not_requested", progress: 0 })));
    if (!live) {
      setStarted(true);
      setStarting(false);
      return;
    }
    try {
      const updated = await requestDistribution(property.id, activePlatforms);
      setTargets(updated.targets);
      setStarted(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "발행 요청에 실패했습니다.");
    } finally {
      setStarting(false);
    }
  };

  const retry = useCallback(async (platform?: Platform) => {
    setRetrying(platform ?? "all"); setError(""); setCompletionAcknowledged(false);
    if (!live) {
      setTargets((prev) => prev.map((target) => (target.status === "not_configured" || target.status === "failed") && (!platform || target.platform === platform) ? { ...target, status: "running", progress: 72, error: undefined } : target));
      window.setTimeout(() => { setTargets((prev) => prev.map((target) => target.status === "running" ? { ...target, status: "not_configured", progress: 100, error: "현장 연결 전에는 게시하지 않습니다." } : target)); setRetrying(null); }, 800);
      return;
    }
    try {
      const updated = await requestDistribution(property.id, platform ? [platform] : activePlatforms);
      setTargets(updated.targets);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "재시도에 실패했습니다.");
    } finally {
      setRetrying(null);
    }
  }, [activePlatforms, live, property.id, requestDistribution]);

  const progress = activeTargets.length ? Math.round(activeTargets.reduce((sum, target) => sum + target.progress, 0) / activeTargets.length) : 0;
  const allDone = started && activeTargets.length > 0 && !pending;
  const allSucceeded = allDone && activeTargets.every((target) => target.status === "succeeded");
  const incompleteTargets = activeTargets.filter((target) => target.status !== "succeeded");
  const heading = error ? "전체 발행 요청을 처리하지 못했습니다" : allDone ? "전체 발행 결과" : live ? "플랫폼별 순차 발행 중입니다" : "전체 발행 준비 상태를 확인하고 있습니다";

  if (!started) {
    return (
      <div className="modal-backdrop"><div className="distribution-modal" role="dialog" aria-modal="true" aria-labelledby="distribution-selection-title">
        <div className="wizard-head"><div><span className="eyebrow">PLATFORM PUBLISH</span><h2 id="distribution-selection-title">발행할 플랫폼을 선택하세요</h2><p>{property.number} · {property.area} {property.type}</p></div><button className="icon-button" aria-label="닫기" onClick={onClose}><X size={20} /></button></div>
        <div className="distribution-selection">
          <div className="platform-selection-head"><div><strong>플랫폼 선택</strong><small>기본값은 전체 선택이며 필요한 플랫폼만 남길 수 있습니다.</small></div><label><input type="checkbox" aria-label="전체 플랫폼 선택" checked={selectedPlatforms.length === PLATFORMS.length} onChange={(event) => setSelectedPlatforms(event.target.checked ? [...PLATFORMS] : [])} /> 전체 선택</label></div>
          <div className="distribution-media-summary"><span><strong>사진</strong> {PHOTO_PLATFORMS.map((platform) => platformName[platform]).join(" · ")}</span><span><strong>세로 영상 1개</strong> {VIDEO_PLATFORMS.map((platform) => platformName[platform]).join(" · ")}</span></div>
          <div className="copy-grid">
            {PLATFORMS.map((platform) => <label key={platform} className={`copy-card platform-check ${selectedPlatforms.includes(platform) ? "selected" : "disabled"}`}><input type="checkbox" aria-label={`${platformName[platform]} 발행 선택`} checked={selectedPlatforms.includes(platform)} onChange={() => togglePlatform(platform)} /><PlatformLogo platform={platform} /><span><strong>{platformName[platform]}</strong><small>{selectedPlatforms.includes(platform) ? "이번 발행에 포함" : "이번 발행에서 제외"}</small></span></label>)}
          </div>
          {live && agent.status !== "online" && <div className="error-guide"><Activity size={17} /><span>실행기가 오프라인입니다. 발행 전 고객 PC 실행기 상태를 확인하세요.</span></div>}
          {error && <div className="error-guide"><Activity size={17} /><span>{error}</span></div>}
        </div>
        <div className="distribution-foot"><span><ShieldCheck size={15} /> 사진과 세로 영상을 채널 용도에 맞게 분리해 발행합니다.</span><div><button type="button" className="secondary" onClick={onClose}>취소</button><button type="button" className="primary" onClick={startDistribution} disabled={starting || activePlatforms.length === 0}>{starting ? "발행 요청 중" : `선택 플랫폼 발행 시작 (${activePlatforms.length})`}</button></div></div>
      </div></div>
    );
  }

  return (
    <div className="modal-backdrop"><div className="distribution-modal" role="dialog" aria-modal="true">
      {allDone && !completionAcknowledged && <div className="distribution-complete-overlay" role="alertdialog" aria-modal="true" aria-labelledby="distribution-complete-title"><div className="distribution-complete-box"><CheckCircle2 size={34} /><h3 id="distribution-complete-title">{allSucceeded ? "선택한 플랫폼 발행이 완료되었습니다." : "선택한 플랫폼 발행 처리가 끝났습니다."}</h3><p>{allSucceeded ? `${activePlatforms.length}개 플랫폼에 순서대로 게시했습니다.` : "성공한 플랫폼은 완료됐으며, 아래 실패 항목만 다시 발행할 수 있습니다."}</p>{incompleteTargets.length > 0 && <div className="distribution-failure-list">{incompleteTargets.map((target) => <div key={target.platform}><strong>{platformName[target.platform]}</strong><span>{target.error || "플랫폼 연결 또는 로그인 상태를 확인하세요."}</span></div>)}</div>}<button type="button" className="primary" onClick={() => setCompletionAcknowledged(true)}><Check size={15} /> 결과 확인</button></div></div>}
      <div className="wizard-head"><div><span className="eyebrow">LOCAL PLAYWRIGHT RUNNER</span><h2>{heading}</h2><p>{property.number} · {property.area} {property.type}</p></div><button className="icon-button" aria-label="닫기" onClick={onClose}><X size={20} /></button></div>
      <div className="overall-progress"><div><span>{allDone ? "확인 완료" : "전체 진행률"}</span><strong>{progress}%</strong></div><div className="progress"><i style={{ width: `${progress}%` }} /></div><small><span className={`live-dot ${agent.status}`} /> {agent.deviceName} · {agent.label}</small></div>
      {live && agent.status !== "online" && !allDone && <div className="error-guide"><Activity size={17} /><span>실행기가 오프라인입니다. 고객 PC에서 <strong>.\scripts\start-runner.ps1</strong> 를 실행하면 대기 작업을 이어서 처리합니다.</span></div>}
      {error && <div className="error-guide"><Activity size={17} /><span>{error}</span></div>}
      <div className="distribution-list">
        {targets.map((target) => { const selected = activePlatforms.includes(target.platform); return (
          <div className={`distribution-row ${target.status}`} key={target.platform}>
            <PlatformLogo platform={target.platform} />
            <div className="distribution-copy"><strong>{platformName[target.platform]}</strong><small>{!selected ? "이번 발행에서 선택하지 않음" : target.status === "queued" ? "앞 플랫폼 발행 완료 대기 중" : target.status === "running" ? `${VIDEO_PLATFORMS.includes(target.platform) ? "세로 영상" : "사진"}과 게시글을 업로드하는 중` : target.status === "succeeded" ? "발행 완료" : target.error ?? target.status}</small>{selected && <div className="mini-progress"><i className={target.status === "succeeded" ? "complete" : ""} style={{ width: `${target.progress}%` }} /></div>}</div>
            {target.status === "succeeded" && target.url && <a href={target.url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> 열기</a>}
            {selected && (target.status === "failed" || target.status === "not_configured") && <button className="retry-button" aria-label={`${platformName[target.platform]}만 재발행`} onClick={() => retry(target.platform)} disabled={retrying !== null}><RefreshCcw size={14} /> 이 플랫폼 재발행</button>}
            {target.status === "succeeded" && <CheckCircle2 className="distribution-done" size={19} />}
            {target.status === "running" && <Activity className="spin" size={17} />}
            {target.status === "queued" && <Clock3 size={17} />}
          </div>
        ); })}
      </div>
      <div className="distribution-foot"><span><ShieldCheck size={15} /> 실제 사이트 어댑터 연결 전에는 게시하지 않습니다.</span><button className={allDone ? "primary" : "secondary"} onClick={onClose}>{allDone ? "확인" : "백그라운드에서 계속"}</button></div>
    </div></div>
  );
}
