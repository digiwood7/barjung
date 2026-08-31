import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PropertyWizard } from "./property-wizard";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  delete window.kakao;
  delete window.daum;
});

describe("PropertyWizard 사진 최적화 단계", () => {
  it("닫은 미완료 입력을 Y/N 확인 후 복원한다", async () => {
    const onClose = vi.fn();
    const first = render(<PropertyWizard mode="live" employees={[]} onClose={onClose} onFinish={() => undefined} />);
    fireEvent.change(screen.getByLabelText("매물 제목"), { target: { value: "복원할 원룸" } });
    fireEvent.change(screen.getByLabelText("정확한 주소"), { target: { value: "대구 북구 복현동 100" } });
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(onClose).toHaveBeenCalledOnce();
    first.unmount();

    render(<PropertyWizard mode="live" employees={[]} onClose={() => undefined} onFinish={() => undefined} />);
    expect(screen.getByRole("alertdialog", { name: "작성 중인 값을 불러올까요?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "예, 이전 값 불러오기" }));
    expect(screen.getByLabelText("매물 제목")).toHaveValue("복원할 원룸");
    expect(screen.getByLabelText("정확한 주소")).toHaveValue("대구 북구 복현동 100");
  });

  it("라이브 모드에서 선택한 사진을 등록 완료 콜백까지 유지한다", async () => {
    const onFinish = vi.fn();
    render(<PropertyWizard mode="live" employees={[{ id: "e1", name: "정다혜", role: "대표", phone: "010", status: "재직" }]} onClose={() => undefined} onFinish={onFinish} />);
    fireEvent.change(screen.getByLabelText("매물 제목"), { target: { value: "사진 테스트" } });
    fireEvent.change(screen.getByLabelText("정확한 주소"), { target: { value: "대구 북구 산격동" } });
    fireEvent.click(screen.getByRole("button", { name: /다음/ }));
    expect(screen.getByRole("button", { name: "← 이전 단계" })).toBeInTheDocument();
    const files = [new File(["one"], "01.jpg", { type: "image/jpeg" }), new File(["two"], "02.png", { type: "image/png" })];
    fireEvent.change(screen.getByLabelText("매물 사진 선택"), { target: { files } });

    expect(screen.getByText("현장 사진 2장을 선택했습니다")).toBeInTheDocument();
    expect(screen.getByText(/01.jpg · 02.png/)).toBeInTheDocument();
    expect(onFinish).not.toHaveBeenCalled();
  });

  it("건축물대장 조회가 성공하면 확인 버튼을 초록 완료 상태로 바꾼다", async () => {
    class FakePostcode {
      constructor(private readonly options: { oncomplete(data: object): void }) {}
      embed() {
        this.options.oncomplete({
          address: "대구 북구 산격동 1240-1", roadAddress: "대구 북구 대동로1길 12", jibunAddress: "대구 북구 산격동 1240-1",
          zonecode: "41535", buildingCode: "", buildingName: "", bcode: "2723011100", userSelectedType: "J",
        });
      }
    }
    window.kakao = { Postcode: FakePostcode as never };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      source: "MOLIT_BUILDING_HUB", queriedAt: "2026-09-01T00:00:00.000Z", managementId: "PK-1",
      address: "대구광역시 북구 산격동 1240-1", roadAddress: "", buildingName: "", buildingArea: "100㎡",
      disclosure: { location: "대구광역시 북구 산격동 1240-1", propertyCategory: "다가구주택", floor: "지상 4층", approvalDate: "2017. 05. 02.", parking: "총 7대" }, raw: {},
    }), { status: 200 })));
    render(<PropertyWizard mode="live" employees={[]} onClose={() => undefined} onFinish={() => undefined} />);

    fireEvent.click(screen.getByRole("button", { name: "주소 검색" }));
    fireEvent.click(screen.getByRole("button", { name: "건축물대장 확인" }));

    const completed = await screen.findByRole("button", { name: "확인 완료" });
    expect(completed.closest(".address-confirm")).toHaveClass("confirmed");
    expect(screen.getByText(/건축물대장 확인 완료/)).toBeInTheDocument();
  });

  it("주소를 바꾸면 이전 대장 주소와 자동 고지값을 모두 초기화한다", async () => {
    class FakePostcode {
      constructor(private readonly options: { oncomplete(data: object): void }) {}
      embed() {
        this.options.oncomplete({
          address: "대구 북구 산격동 1240-1", roadAddress: "대구 북구 대동로1길 12", jibunAddress: "대구 북구 산격동 1240-1",
          zonecode: "41535", buildingCode: "", buildingName: "", bcode: "2723011100", userSelectedType: "J",
        });
      }
    }
    window.kakao = { Postcode: FakePostcode as never };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      source: "MOLIT_BUILDING_HUB", queriedAt: "2026-09-01T00:00:00.000Z", managementId: "OLD",
      address: "대구 북구 산격동 1240-1", roadAddress: "", buildingName: "", buildingArea: "100㎡",
      disclosure: { location: "대구 북구 산격동 1240-1", propertyCategory: "다가구주택", floor: "지상 4층", approvalDate: "2017. 05. 02.", parking: "총 7대" }, raw: {},
    }), { status: 200 })));
    render(<PropertyWizard mode="live" employees={[]} onClose={() => undefined} onFinish={() => undefined} />);
    fireEvent.change(screen.getByLabelText("매물 제목"), { target: { value: "주소 변경 테스트" } });
    fireEvent.click(screen.getByRole("button", { name: "주소 검색" }));
    fireEvent.click(screen.getByRole("button", { name: "건축물대장 확인" }));
    await screen.findByRole("button", { name: "확인 완료" });

    fireEvent.change(screen.getByLabelText("정확한 주소"), { target: { value: "대구 북구 복현동 100" } });
    fireEvent.click(screen.getByRole("button", { name: /다음/ }));
    fireEvent.click(screen.getByRole("button", { name: /다음/ }));
    expect(screen.getByText("대구 북구 복현동 100")).toBeInTheDocument();
    expect(screen.queryByText("대구 북구 산격동 1240-1")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "고지사항 직접 입력" }));
    expect(screen.getByRole("textbox", { name: "주차대장" })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "대상물 종류대장" })).toHaveValue("");
  });

  it("주소 검색창은 바깥 영역을 눌러도 닫히지 않고 닫기 버튼으로만 닫힌다", () => {
    class FakePostcode {
      embed() {}
    }
    window.kakao = { Postcode: FakePostcode as never };
    render(<PropertyWizard mode="live" employees={[]} onClose={() => undefined} onFinish={() => undefined} />);

    fireEvent.click(screen.getByRole("button", { name: "주소 검색" }));
    const dialog = screen.getByRole("dialog", { name: "주소 검색창" });
    fireEvent.click(dialog.parentElement as HTMLElement);
    expect(screen.getByRole("dialog", { name: "주소 검색창" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "주소 검색 닫기" }));
    expect(screen.queryByRole("dialog", { name: "주소 검색창" })).not.toBeInTheDocument();
  });

  it("1단계 관리비를 4단계의 같은 관리비 입력값으로 유지한다", () => {
    render(<PropertyWizard mode="live" employees={[]} onClose={() => undefined} onFinish={() => undefined} />);
    fireEvent.change(screen.getByLabelText("매물 제목"), { target: { value: "관리비 테스트" } });
    fireEvent.change(screen.getByLabelText("정확한 주소"), { target: { value: "대구 북구 산격동" } });
    fireEvent.change(screen.getByLabelText("관리비 (만원)"), { target: { value: "10" } });

    fireEvent.click(screen.getByRole("button", { name: /다음/ }));
    fireEvent.click(screen.getByRole("button", { name: /다음/ }));
    fireEvent.click(screen.getByRole("button", { name: "고지사항 직접 입력" }));
    expect(screen.getByRole("textbox", { name: "관리비현장" })).toHaveValue("10");
  });

  it("계약면적은 숫자만 입력받고 제곱미터 단위를 자동 저장한다", () => {
    render(<PropertyWizard mode="live" employees={[]} onClose={() => undefined} onFinish={() => undefined} />);
    fireEvent.change(screen.getByLabelText("매물 제목"), { target: { value: "면적 테스트" } });
    fireEvent.change(screen.getByLabelText("정확한 주소"), { target: { value: "대구 북구 산격동" } });
    fireEvent.click(screen.getByRole("button", { name: /다음/ }));
    fireEvent.click(screen.getByRole("button", { name: /다음/ }));
    fireEvent.click(screen.getByRole("button", { name: "고지사항 직접 입력" }));

    fireEvent.change(screen.getByRole("textbox", { name: "계약면적 값" }), { target: { value: "79.62㎡" } });
    expect(screen.getByRole("textbox", { name: "계약면적 값" })).toHaveValue("79.62");
    expect(screen.getByText("㎡")).toBeInTheDocument();
  });

  it("5단계는 자동 원고에 추가할 내용만 안내한다", () => {
    render(<PropertyWizard mode="live" employees={[]} onClose={() => undefined} onFinish={() => undefined} />);
    fireEvent.change(screen.getByLabelText("매물 제목"), { target: { value: "원고 테스트" } });
    fireEvent.change(screen.getByLabelText("정확한 주소"), { target: { value: "대구 북구 산격동" } });
    fireEvent.click(screen.getByRole("button", { name: /다음/ }));
    fireEvent.click(screen.getByRole("button", { name: /다음/ }));
    fireEvent.click(screen.getByRole("button", { name: "고지사항 직접 입력" }));
    const requiredFields = ["계약면적 값", "대상물 종류대장", "해당 층/총 층수현장", "입주가능일현장", "방/욕실현장", "사용승인일대장", "주차대장", "관리비현장", "방향현장"];
    for (const name of requiredFields) {
      const field = screen.getByRole("textbox", { name });
      if (!field.hasAttribute("readonly")) fireEvent.change(field, { target: { value: name === "계약면적 값" ? "20" : name === "관리비현장" ? "5" : "확인" } });
    }
    fireEvent.click(screen.getByRole("button", { name: /다음/ }));
    expect(screen.getAllByPlaceholderText("자동 작성될 게시글에 직접 추가할 내용이 있으면 적어 주세요.")).toHaveLength(4);
    expect(screen.queryByText("직접 작성")).not.toBeInTheDocument();
  });
});
