import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultSettings } from "@/lib/domain/types";
import { SettingsView } from "./settings-view";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const props = {
  settings: defaultSettings,
  agent: { id: "agent-1", deviceName: "BARJUNG-PC", status: "online" as const, lastHeartbeatAt: new Date().toISOString(), label: "온라인 · 방금 전" },
  office: { id: "office-1", name: "바를정", regionLabel: "대구" },
  mode: "live" as const,
  properties: [],
  onUpdate: vi.fn(async () => undefined),
};

describe("SettingsView Naver login", () => {
  it("플랫폼별 로그인 상태를 네 개의 카드로 표시한다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: "connected", message: "정상 연결" }), { status: 200 })));
    render(<SettingsView {...props} connections={[
      { platform: "naver", status: "connected", lastCheckedAt: "2026-09-01T04:00:00.000Z" },
      { platform: "instagram", status: "not_configured", lastCheckedAt: null },
      { platform: "daangn", status: "not_configured", lastCheckedAt: null },
      { platform: "zigbang", status: "not_configured", lastCheckedAt: null },
    ]} />);

    const section = await screen.findByRole("region", { name: "플랫폼 로그인 상태" });
    expect(within(section).getAllByRole("article")).toHaveLength(4);
    expect(within(section).getAllByRole("button", { name: /상태 확인/ })).toHaveLength(4);
  });

  it("로컬 확인 필요 상태에서도 로그인 버튼으로 갱신을 요청한다", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => new Response(JSON.stringify(
      init?.method === "POST"
        ? { status: "action_required", message: "Windows 실행기에 로그인 요청을 보냈습니다." }
        : { status: "local_required", message: "로컬 PC에서 확인합니다." },
    ), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<SettingsView {...props} />);

    const loginButton = await screen.findByRole("button", { name: "네이버 로그인" });
    fireEvent.click(loginButton);

    expect(await screen.findByRole("button", { name: "로그인 진행 중" })).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledWith("/api/naver/session", { method: "POST" });
  });

  it("로그인 연결 상태에서는 완료 버튼을 비활성화한다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: "connected", message: "정상 연결" }), { status: 200 })));
    render(<SettingsView {...props} />);

    expect(await screen.findByRole("button", { name: "로그인 완료" })).toBeDisabled();
  });
});
