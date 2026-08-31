import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PropertyWizard } from "./property-wizard";

afterEach(cleanup);

describe("PropertyWizard 사진 최적화 단계", () => {
  it("라이브 모드에서 선택한 사진을 등록 완료 콜백까지 유지한다", async () => {
    const onFinish = vi.fn();
    render(<PropertyWizard mode="live" employees={[{ id: "e1", name: "정다혜", role: "대표", phone: "010", status: "재직" }]} onClose={() => undefined} onFinish={onFinish} />);
    fireEvent.change(screen.getByLabelText("매물 제목"), { target: { value: "사진 테스트" } });
    fireEvent.change(screen.getByLabelText("정확한 주소"), { target: { value: "대구 북구 산격동" } });
    fireEvent.click(screen.getByRole("button", { name: /다음/ }));
    const files = [new File(["one"], "01.jpg", { type: "image/jpeg" }), new File(["two"], "02.png", { type: "image/png" })];
    fireEvent.change(screen.getByLabelText("매물 사진 선택"), { target: { files } });

    expect(screen.getByText("현장 사진 2장을 선택했습니다")).toBeInTheDocument();
    expect(screen.getByText(/01.jpg · 02.png/)).toBeInTheDocument();
    expect(onFinish).not.toHaveBeenCalled();
  });
});
