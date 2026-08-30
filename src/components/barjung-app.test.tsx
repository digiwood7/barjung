import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApiRepository } from "@/lib/api/client";
import type { WorkspaceSnapshot } from "@/lib/domain/types";
import { defaultSettings } from "@/lib/domain/types";
import { BarjungApp } from "./barjung-app";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function openApp() {
  render(<BarjungApp />);
  await screen.findByRole("button", { name: "고객관리" });
}

describe("BarjungApp administrator workflows (demo mode)", () => {
  it("creates a customer with the entered CRM fields and edits the memo", async () => {
    await openApp();
    fireEvent.click(screen.getByRole("button", { name: "고객관리" }));
    fireEvent.click(screen.getByRole("button", { name: /고객 등록/ }));

    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "김고객" } });
    fireEvent.change(screen.getByLabelText("전화번호"), { target: { value: "010-1111-2222" } });
    fireEvent.change(screen.getByLabelText("희망 조건"), { target: { value: "북문, 월 45만원 이하" } });
    fireEvent.click(screen.getByRole("button", { name: /^등록$/ }));

    const row = await screen.findByRole("button", { name: /김고객.*010-1111-2222/ });
    fireEvent.click(row);
    expect(screen.getByRole("heading", { name: "고객 정보 수정" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("메모"), { target: { value: "주차 가능 매물 우선" } });
    fireEvent.click(screen.getByRole("button", { name: "변경사항 저장" }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "고객 정보 수정" })).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /김고객.*010-1111-2222/ }));
    expect(screen.getByLabelText("메모")).toHaveValue("주차 가능 매물 우선");
  });

  it("changes an employee employment status", async () => {
    await openApp();
    fireEvent.click(screen.getByRole("button", { name: "직원관리" }));
    const card = screen.getByText("김민지").closest(".employee-card");
    expect(card).not.toBeNull();
    fireEvent.click(within(card as HTMLElement).getByRole("button", { name: "직원 정보 수정" }));
    fireEvent.change(screen.getByLabelText("재직상태"), { target: { value: "휴직" } });
    fireEvent.click(screen.getByRole("button", { name: "변경사항 저장" }));
    await waitFor(() => expect(within(card as HTMLElement).getByText("휴직")).toBeInTheDocument());
  });

  it("does not render removed call features and shows the demo badge", async () => {
    await openApp();
    expect(screen.queryByText("통화기록")).not.toBeInTheDocument();
    expect(screen.queryByText("오늘의 배포 레일")).not.toBeInTheDocument();
    expect(screen.getByText("데모 데이터")).toBeInTheDocument();
  });

  it("marks building-register values as demo when the customer API key is not configured", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ code: "NOT_CONFIGURED", message: "고객 공공데이터 API 키를 연결해야 합니다." }), { status: 503 })));
    await openApp();
    fireEvent.click(screen.getByRole("button", { name: /매물관리/ }));
    fireEvent.click(screen.getByRole("button", { name: /새 매물 등록/ }));
    fireEvent.click(screen.getByRole("button", { name: "주소 확인" }));
    await waitFor(() => expect(screen.getByText(/시안 데이터입니다/)).toBeInTheDocument());
  });

  it("registers a property from the wizard with the typed title", async () => {
    await openApp();
    fireEvent.click(screen.getByRole("button", { name: /매물관리/ }));
    fireEvent.click(screen.getByRole("button", { name: /새 매물 등록/ }));
    fireEvent.change(screen.getByLabelText("매물 제목"), { target: { value: "테스트용 신규 원룸" } });
    fireEvent.change(screen.getByLabelText("보증금 (만원)"), { target: { value: "700" } });
    // 1단계 → 2단계(사진 데모 애니메이션은 100% 될 때까지 대기) → … → 등록
    fireEvent.click(screen.getByRole("button", { name: /다음/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: /다음/ })).not.toBeDisabled(), { timeout: 5000 });
    fireEvent.click(screen.getByRole("button", { name: /다음/ }));
    fireEvent.click(screen.getByRole("button", { name: /다음/ }));
    fireEvent.click(screen.getByRole("button", { name: "방향 예시값 입력" }));
    fireEvent.click(screen.getByRole("button", { name: /다음/ }));
    fireEvent.click(screen.getByRole("button", { name: /다음/ }));
    fireEvent.click(screen.getByRole("button", { name: /^매물 등록$/ }));
    expect(await screen.findByRole("heading", { name: "테스트용 신규 원룸" })).toBeInTheDocument();
    expect(screen.getAllByText(/보증금 700/).length).toBeGreaterThan(0);
  });

  it("edits and deletes a property from its detail", async () => {
    await openApp();
    fireEvent.click(await screen.findByRole("button", { name: /260829-01.*북문 3분/ }));
    fireEvent.click(screen.getByRole("button", { name: "매물 수정" }));
    fireEvent.change(screen.getByLabelText("매물 제목"), { target: { value: "수정한 매물 제목" } });
    fireEvent.click(screen.getByRole("button", { name: "변경사항 저장" }));
    expect(await screen.findByText("수정한 매물 제목")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /260829-01.*수정한 매물 제목/ }));
    fireEvent.click(screen.getByRole("button", { name: "매물 수정" }));
    fireEvent.click(screen.getByRole("button", { name: "매물 삭제" }));
    await waitFor(() => expect(screen.queryByText("수정한 매물 제목")).not.toBeInTheDocument());
  });
});

describe("BarjungApp live mode (customer Supabase via /api)", () => {
  const liveSnapshot: WorkspaceSnapshot = {
    mode: "live", readOnly: false,
    office: { id: "office-1", name: "바를정공인중개사사무소", regionLabel: "경북대 캠퍼스 권역" },
    agent: { id: "agent-1", deviceName: "BARJUNG-OFFICE-01", status: "offline", lastHeartbeatAt: null, label: "오프라인 · 마지막 기록 없음" },
    settings: defaultSettings,
    properties: [], employees: [{ id: "e1", name: "정다혜", role: "대표 공인중개사", phone: "010", status: "재직" }], customers: [],
  };

  it("renders the server snapshot, posts new customers to the API and shows API errors", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/customers" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { name: string; phone: string };
        if (body.phone === "010-9999-9999") return new Response(JSON.stringify({ code: "REQUEST_FAILED", message: "같은 전화번호의 고객이 이미 있습니다." }), { status: 400 });
        return new Response(JSON.stringify({ id: "c-live", name: body.name, phone: body.phone, interest: "원룸", budget: "", followUp: "일정 미정", followUpAt: null, note: "" }), { status: 200 });
      }
      return new Response(JSON.stringify({ code: "NOT_FOUND", message: `unexpected ${url}` }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<BarjungApp repository={createApiRepository(liveSnapshot)} />);
    expect(await screen.findByText("고객 DB 연결")).toBeInTheDocument();
    expect(screen.getByText(/아직 등록된 매물이 없습니다/)).toBeInTheDocument();
    expect(screen.getByText(/오프라인 · 마지막 기록 없음/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "고객관리" }));
    fireEvent.click(screen.getByRole("button", { name: /고객 등록/ }));
    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "라이브고객" } });
    fireEvent.change(screen.getByLabelText("전화번호"), { target: { value: "010-9999-9999" } });
    fireEvent.click(screen.getByRole("button", { name: /^등록$/ }));
    expect(await screen.findAllByText("같은 전화번호의 고객이 이미 있습니다.")).not.toHaveLength(0);

    fireEvent.change(screen.getByLabelText("전화번호"), { target: { value: "010-5555-5555" } });
    fireEvent.click(screen.getByRole("button", { name: /^등록$/ }));
    expect(await screen.findByRole("button", { name: /라이브고객.*010-5555-5555/ })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/customers", expect.objectContaining({ method: "POST" }));
  });
});
