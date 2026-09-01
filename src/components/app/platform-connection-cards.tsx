"use client";

import { RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PLATFORMS } from "@/lib/domain/types";
import type { Platform, PlatformConnection, PlatformConnectionStatus } from "@/lib/domain/types";
import { Badge, PlatformLogo, platformName } from "./ui";

type SessionStatus = PlatformConnectionStatus | "checking" | "local_required";

const defaultMessage: Record<Platform, string> = {
  naver: "네이버 블로그 로그인 상태를 확인합니다.",
  instagram: "인스타그램 실행기 연동 후 프로필 화면에서 로그인 상태를 확인합니다.",
  daangn: "당근 게시 자동화 연결을 준비하고 있습니다.",
  tiktok: "세로 영상 게시와 로그인 자동화를 연결할 예정입니다.",
  youtube: "유튜브 쇼츠 채널 로그인 자동화를 연결할 예정입니다.",
};

function statusLabel(status: SessionStatus): string {
  if (status === "connected") return "로그인 유지 중";
  if (status === "checking") return "확인 중";
  if (status === "local_required") return "로컬 PC에서 확인";
  if (status === "expired") return "재로그인 필요";
  if (status === "action_required") return "로그인 필요";
  return "연결 준비 중";
}

function tone(status: SessionStatus): "green" | "amber" | "red" | "slate" {
  if (status === "connected") return "green";
  if (status === "checking" || status === "local_required") return "amber";
  if (status === "expired" || status === "action_required") return "red";
  return "slate";
}

function dot(status: SessionStatus): "online" | "degraded" | "offline" {
  if (status === "connected") return "online";
  if (status === "checking" || status === "local_required") return "degraded";
  return "offline";
}

export function PlatformConnectionCards({ connections, onRefresh }: { connections: PlatformConnection[]; onRefresh?: () => Promise<void> }) {
  const initialNaver = connections.find((connection) => connection.platform === "naver");
  const initialInstagram = connections.find((connection) => connection.platform === "instagram");
  const initialDaangn = connections.find((connection) => connection.platform === "daangn");
  const [naverStatus, setNaverStatus] = useState<SessionStatus>(initialNaver?.status ?? "checking");
  const [naverMessage, setNaverMessage] = useState(defaultMessage.naver);
  const [naverBusy, setNaverBusy] = useState(false);
  const [naverLoginRequested, setNaverLoginRequested] = useState(false);
  const [instagramStatus, setInstagramStatus] = useState<SessionStatus>(initialInstagram?.status ?? "checking");
  const [instagramMessage, setInstagramMessage] = useState(defaultMessage.instagram);
  const [instagramBusy, setInstagramBusy] = useState(false);
  const [instagramLoginRequested, setInstagramLoginRequested] = useState(false);
  const [daangnStatus, setDaangnStatus] = useState<SessionStatus>(initialDaangn?.status ?? "checking");
  const [daangnMessage, setDaangnMessage] = useState(defaultMessage.daangn);
  const [daangnBusy, setDaangnBusy] = useState(false);
  const [daangnLoginRequested, setDaangnLoginRequested] = useState(false);
  const [refreshing, setRefreshing] = useState<Platform | null>(null);

  const byPlatform = useMemo(() => new Map(connections.map((connection) => [connection.platform, connection])), [connections]);

  const checkNaver = useCallback(async () => {
    setNaverStatus("checking");
    try {
      const response = await fetch("/api/naver/session", { cache: "no-store" });
      const payload = await response.json() as { status?: SessionStatus; message?: string };
      setNaverStatus(payload.status || "action_required");
      setNaverMessage(payload.message || "네이버 로그인 상태를 확인하지 못했습니다.");
    } catch {
      setNaverStatus("action_required");
      setNaverMessage("로컬 Windows 실행기와 연결하지 못했습니다.");
    }
  }, []);

  const checkInstagram = useCallback(async () => {
    setInstagramStatus("checking");
    try {
      const response = await fetch("/api/instagram/session", { cache: "no-store" });
      const payload = await response.json() as { status?: SessionStatus; message?: string };
      setInstagramStatus(payload.status || "action_required");
      setInstagramMessage(payload.message || "인스타 로그인 상태를 확인하지 못했습니다.");
    } catch {
      setInstagramStatus("action_required");
      setInstagramMessage("로컬 Windows 실행기와 연결하지 못했습니다.");
    }
  }, []);

  const checkDaangn = useCallback(async () => {
    setDaangnStatus("checking");
    try {
      const response = await fetch("/api/daangn/session", { cache: "no-store" });
      const payload = await response.json() as { status?: SessionStatus; message?: string };
      setDaangnStatus(payload.status || "action_required");
      setDaangnMessage(payload.message || "당근 로그인 상태를 확인하지 못했습니다.");
    } catch {
      setDaangnStatus("action_required");
      setDaangnMessage("로컬 Windows 실행기와 연결하지 못했습니다.");
    }
  }, []);

  useEffect(() => {
    checkNaver().catch(() => undefined);
    checkInstagram().catch(() => undefined);
    checkDaangn().catch(() => undefined);
  }, [checkDaangn, checkInstagram, checkNaver]);
  useEffect(() => {
    if (!naverLoginRequested || naverStatus === "connected") return;
    const timer = window.setInterval(() => { checkNaver().catch(() => undefined); }, 5000);
    return () => window.clearInterval(timer);
  }, [checkNaver, naverLoginRequested, naverStatus]);
  useEffect(() => {
    if (naverStatus === "connected" || naverStatus === "expired") setNaverLoginRequested(false);
  }, [naverStatus]);
  useEffect(() => {
    if (!instagramLoginRequested || instagramStatus === "connected") return;
    const timer = window.setInterval(() => { checkInstagram().catch(() => undefined); }, 5000);
    return () => window.clearInterval(timer);
  }, [checkInstagram, instagramLoginRequested, instagramStatus]);
  useEffect(() => {
    if (instagramStatus === "connected" || instagramStatus === "expired") setInstagramLoginRequested(false);
  }, [instagramStatus]);
  useEffect(() => {
    if (!daangnLoginRequested || daangnStatus === "connected") return;
    const timer = window.setInterval(() => { checkDaangn().catch(() => undefined); }, 5000);
    return () => window.clearInterval(timer);
  }, [checkDaangn, daangnLoginRequested, daangnStatus]);
  useEffect(() => {
    if (daangnStatus === "connected" || daangnStatus === "expired") setDaangnLoginRequested(false);
  }, [daangnStatus]);

  const openNaverLogin = async () => {
    setNaverBusy(true);
    try {
      const response = await fetch("/api/naver/session", { method: "POST" });
      const payload = await response.json() as { status?: SessionStatus; message?: string };
      setNaverStatus(payload.status || "action_required");
      setNaverMessage(payload.message || "네이버 로그인 창을 확인하세요.");
      if (response.ok) setNaverLoginRequested(true);
    } catch {
      setNaverStatus("action_required");
      setNaverMessage("Windows 실행기에 네이버 로그인 요청을 보내지 못했습니다.");
      setNaverLoginRequested(false);
    } finally {
      setNaverBusy(false);
    }
  };

  const openInstagramLogin = async () => {
    setInstagramBusy(true);
    try {
      const response = await fetch("/api/instagram/session", { method: "POST" });
      const payload = await response.json() as { status?: SessionStatus; message?: string };
      setInstagramStatus(payload.status || "action_required");
      setInstagramMessage(payload.message || "인스타 로그인 창을 확인하세요.");
      if (response.ok) setInstagramLoginRequested(true);
    } catch {
      setInstagramStatus("action_required");
      setInstagramMessage("Windows 실행기에 인스타 로그인 요청을 보내지 못했습니다.");
      setInstagramLoginRequested(false);
    } finally {
      setInstagramBusy(false);
    }
  };

  const openDaangnLogin = async () => {
    setDaangnBusy(true);
    try {
      const response = await fetch("/api/daangn/session", { method: "POST" });
      const payload = await response.json() as { status?: SessionStatus; message?: string };
      setDaangnStatus(payload.status || "action_required");
      setDaangnMessage(payload.message || "당근 로그인 창을 확인하세요.");
      if (response.ok) setDaangnLoginRequested(true);
    } catch {
      setDaangnStatus("action_required");
      setDaangnMessage("Windows 실행기에 당근 로그인 요청을 보내지 못했습니다.");
      setDaangnLoginRequested(false);
    } finally {
      setDaangnBusy(false);
    }
  };

  const refreshPlatform = async (platform: Platform) => {
    if (platform === "naver") return checkNaver();
    if (platform === "instagram") return checkInstagram();
    if (platform === "daangn") return checkDaangn();
    setRefreshing(platform);
    try { await onRefresh?.(); }
    finally { setRefreshing(null); }
  };

  return (
    <section className="platform-connections span-2" aria-labelledby="platform-connections-title">
      <div className="panel-head">
        <div><span className="eyebrow">PLATFORM CONNECTIONS</span><h2 id="platform-connections-title">플랫폼 로그인 상태</h2><p>각 플랫폼의 로그인 유지 여부와 실행기 연결 상태를 한곳에서 확인합니다.</p></div>
      </div>
      <div className="platform-channel-guide"><strong>사진 채널</strong><span>네이버 · 당근</span><strong>세로 영상 채널</strong><span>인스타 · 틱톡 · 유튜브 쇼츠</span></div>
      <div className="platform-connection-grid">
        {PLATFORMS.map((platform) => {
          const connection = byPlatform.get(platform);
          const status: SessionStatus = platform === "naver" ? naverStatus : platform === "instagram" ? instagramStatus : platform === "daangn" ? daangnStatus : connection?.status ?? "not_configured";
          const connected = status === "connected";
          const message = platform === "naver" || platform === "instagram" || platform === "daangn"
            ? platform === "naver" ? naverMessage : platform === "instagram" ? instagramMessage : daangnMessage
            : connected
              ? `${platformName[platform]} 로그인 세션이 정상적으로 유지되고 있습니다.`
              : defaultMessage[platform];
          const checkedAt = connection?.lastCheckedAt ? new Date(connection.lastCheckedAt).toLocaleString("ko-KR") : "확인 기록 없음";
          return (
            <article className={`panel platform-connection-card ${connected ? "connected" : ""}`} key={platform}>
              <div className="platform-connection-title">
                <PlatformLogo platform={platform} />
                <div><h3>{platformName[platform]}</h3><Badge tone={tone(status)}><span className={`live-dot ${dot(status)}`} /> {statusLabel(status)}</Badge></div>
              </div>
              <p>{message}</p>
              <small>마지막 확인: {checkedAt}</small>
              <div className="platform-connection-actions">
                <button className="secondary" type="button" onClick={() => refreshPlatform(platform)} disabled={naverBusy || instagramBusy || daangnBusy || refreshing === platform || status === "checking"}><RefreshCcw size={14} /> 상태 확인</button>
                {platform === "naver"
                  ? <button className="primary" type="button" onClick={openNaverLogin} disabled={naverBusy || naverLoginRequested || connected}>{connected ? "로그인 완료" : naverBusy ? "요청 중" : naverLoginRequested ? "로그인 진행 중" : "네이버 로그인"}</button>
                  : platform === "instagram"
                    ? <button className="primary" type="button" onClick={openInstagramLogin} disabled={instagramBusy || instagramLoginRequested || connected}>{connected ? "로그인 완료" : instagramBusy ? "요청 중" : instagramLoginRequested ? "로그인 진행 중" : "인스타 로그인"}</button>
                  : platform === "daangn"
                    ? <button className="primary" type="button" onClick={openDaangnLogin} disabled={daangnBusy || daangnLoginRequested || connected}>{connected ? "로그인 완료" : daangnBusy ? "요청 중" : daangnLoginRequested ? "로그인 진행 중" : "당근 로그인"}</button>
                  : <button className="secondary" type="button" disabled>{connected ? "로그인 완료" : "로그인 준비 중"}</button>}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
