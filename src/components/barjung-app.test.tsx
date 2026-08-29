import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BarjungApp } from "./barjung-app";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("BarjungApp administrator workflows", () => {
  it("creates a customer with the entered CRM fields and edits the memo", () => {
    render(<BarjungApp />);
    fireEvent.click(screen.getByRole("button", { name: "고객관리" }));
    fireEvent.click(screen.getByRole("button", { name: /고객 등록/ }));

    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "김고객" } });
    fireEvent.change(screen.getByLabelText("전화번호"), { target: { value: "010-1111-2222" } });
    fireEvent.change(screen.getByLabelText("희망 조건"), { target: { value: "북문, 월 45만원 이하" } });
    fireEvent.click(screen.getByRole("button", { name: /^등록$/ }));

    const row = screen.getByRole("button", { name: /김고객.*010-1111-2222/ });
    expect(row).toBeInTheDocument();
    fireEvent.click(row);
    expect(screen.getByRole("heading", { name: "고객 정보 수정" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("메모"), { target: { value: "주차 가능 매물 우선" } });
    fireEvent.click(screen.getByRole("button", { name: "변경사항 저장" }));
    fireEvent.click(screen.getByRole("button", { name: /김고객.*010-1111-2222/ }));
    expect(screen.getByLabelText("메모")).toHaveValue("주차 가능 매물 우선");
  });

  it("changes an employee employment status", () => {
    render(<BarjungApp />);
    fireEvent.click(screen.getByRole("button", { name: "직원관리" }));
    const card = screen.getByText("김민지").closest(".employee-card");
    expect(card).not.toBeNull();
    fireEvent.click(within(card as HTMLElement).getByRole("button", { name: "직원 정보 수정" }));
    fireEvent.change(screen.getByLabelText("재직상태"), { target: { value: "휴직" } });
    fireEvent.click(screen.getByRole("button", { name: "변경사항 저장" }));
    expect(within(card as HTMLElement).getByText("휴직")).toBeInTheDocument();
  });

  it("does not render removed call features", () => {
    render(<BarjungApp />);
    expect(screen.queryByText("통화기록")).not.toBeInTheDocument();
    expect(screen.queryByText("오늘의 배포 레일")).not.toBeInTheDocument();
  });

  it("marks building-register values as demo when the customer API key is not configured", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ code: "NOT_CONFIGURED", message: "고객 공공데이터 API 키를 연결해야 합니다." }), { status: 503 })));
    render(<BarjungApp />);
    fireEvent.click(screen.getByRole("button", { name: /매물관리/ }));
    fireEvent.click(screen.getByRole("button", { name: /새 매물 등록/ }));
    fireEvent.click(screen.getByRole("button", { name: "주소 확인" }));
    await waitFor(() => expect(screen.getByText(/시안 데이터입니다/)).toBeInTheDocument());
  });

  it("edits and deletes a property from its detail", () => {
    render(<BarjungApp />);
    fireEvent.click(screen.getByRole("button", { name: /260829-01.*북문 3분/ }));
    fireEvent.click(screen.getByRole("button", { name: "매물 수정" }));
    fireEvent.change(screen.getByLabelText("매물 제목"), { target: { value: "수정한 매물 제목" } });
    fireEvent.click(screen.getByRole("button", { name: "변경사항 저장" }));
    expect(screen.getByText("수정한 매물 제목")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /260829-01.*수정한 매물 제목/ }));
    fireEvent.click(screen.getByRole("button", { name: "매물 수정" }));
    fireEvent.click(screen.getByRole("button", { name: "매물 삭제" }));
    expect(screen.queryByText("수정한 매물 제목")).not.toBeInTheDocument();
  });
});
