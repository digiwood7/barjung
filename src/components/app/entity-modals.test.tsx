import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditEntityModal, SimpleFormModal } from "./entity-modals";

afterEach(cleanup);

describe("customer and employee phone inputs", () => {
  it("고객 전화번호를 자동 형식화하고 설정 문의 유형을 사용한다", () => {
    const onSave = vi.fn();
    render(<SimpleFormModal type="customer" inquiryTypes={["상가 임대 문의", "토지 문의"]} onClose={() => undefined} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "김고객" } });
    fireEvent.change(screen.getByLabelText("전화번호"), { target: { value: "01012345678" } });

    expect(screen.getByLabelText("전화번호")).toHaveValue("010-1234-5678");
    expect(screen.getByLabelText("문의 유형")).toHaveValue("상가 임대 문의");
    fireEvent.click(screen.getByRole("button", { name: "등록" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ phone: "010-1234-5678", detail: "상가 임대 문의" }));
  });

  it("직원 수정 전화번호도 같은 형식으로 정리한다", () => {
    const onSave = vi.fn();
    render(<EditEntityModal entity={{ id: "e1", name: "정직원", role: "공인중개사", phone: "010-1111-2222", status: "재직" }} mode="demo" onClose={() => undefined} onDelete={() => undefined} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText("전화번호"), { target: { value: "01099998888" } });
    expect(screen.getByLabelText("전화번호")).toHaveValue("010-9999-8888");
    fireEvent.click(screen.getByRole("button", { name: "변경사항 저장" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ phone: "010-9999-8888" }));
  });
});
