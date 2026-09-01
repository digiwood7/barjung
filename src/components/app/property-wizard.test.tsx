import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { properties } from "@/lib/mock/data";
import { PropertyWizard } from "./property-wizard";

const noopSave = async () => properties[0];
const noopPublish = () => undefined;

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
    const first = render(<PropertyWizard mode="live" employees={[]} onClose={onClose} onSave={noopSave} onPublish={noopPublish} />);
    fireEvent.change(screen.getByLabelText("매물 제목"), { target: { value: "복원할 원룸" } });
    fireEvent.change(screen.getByLabelText("정확한 주소"), { target: { value: "대구 북구 복현동 100" } });
    fireEvent.click(screen.getAllByRole("button", { name: "닫기" })[0]);
    expect(onClose).toHaveBeenCalledOnce();
    first.unmount();

    render(<PropertyWizard mode="live" employees={[]} onClose={() => undefined} onSave={noopSave} onPublish={noopPublish} />);
    expect(screen.getByRole("alertdialog", { name: "작성 중인 값을 불러올까요?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "예, 이전 값 불러오기" }));
    expect(screen.getByLabelText("매물 제목")).toHaveValue("복원할 원룸");
    expect(screen.getByLabelText("정확한 주소")).toHaveValue("대구 북구 복현동 100");
  });

  it("라이브 모드에서 선택한 사진을 등록 완료 콜백까지 유지한다", async () => {
    const onSave = vi.fn(noopSave);
    render(<PropertyWizard mode="live" employees={[{ id: "e1", name: "정다혜", role: "대표", phone: "010", status: "재직" }]} onClose={() => undefined} onSave={onSave} onPublish={noopPublish} />);
    fireEvent.change(screen.getByLabelText("매물 제목"), { target: { value: "사진 테스트" } });
    fireEvent.change(screen.getByLabelText("정확한 주소"), { target: { value: "대구 북구 산격동" } });
    fireEvent.click(screen.getByRole("button", { name: /다음/ }));
    expect(screen.getByRole("button", { name: "← 이전 단계" })).toBeInTheDocument();
    const files = [new File(["one"], "01.jpg", { type: "image/jpeg" }), new File(["two"], "02.png", { type: "image/png" })];
    fireEvent.change(screen.getByLabelText("매물 사진 선택"), { target: { files } });

    expect(screen.getByText("교체할 사진 2장을 선택했습니다")).toBeInTheDocument();
    expect(screen.getByText(/01.jpg · 02.png/)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
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
    render(<PropertyWizard mode="live" employees={[]} onClose={() => undefined} onSave={noopSave} onPublish={noopPublish} />);

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
    render(<PropertyWizard mode="live" employees={[]} onClose={() => undefined} onSave={noopSave} onPublish={noopPublish} />);
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
    render(<PropertyWizard mode="live" employees={[]} onClose={() => undefined} onSave={noopSave} onPublish={noopPublish} />);

    fireEvent.click(screen.getByRole("button", { name: "주소 검색" }));
    const dialog = screen.getByRole("dialog", { name: "주소 검색창" });
    fireEvent.click(dialog.parentElement as HTMLElement);
    expect(screen.getByRole("dialog", { name: "주소 검색창" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "주소 검색 닫기" }));
    expect(screen.queryByRole("dialog", { name: "주소 검색창" })).not.toBeInTheDocument();
  });

  it("1단계 관리비를 4단계의 같은 관리비 입력값으로 유지한다", () => {
    render(<PropertyWizard mode="live" employees={[]} onClose={() => undefined} onSave={noopSave} onPublish={noopPublish} />);
    fireEvent.change(screen.getByLabelText("매물 제목"), { target: { value: "관리비 테스트" } });
    fireEvent.change(screen.getByLabelText("정확한 주소"), { target: { value: "대구 북구 산격동" } });
    fireEvent.change(screen.getByLabelText("관리비 (만원)"), { target: { value: "10" } });

    fireEvent.click(screen.getByRole("button", { name: /다음/ }));
    fireEvent.click(screen.getByRole("button", { name: /다음/ }));
    fireEvent.click(screen.getByRole("button", { name: "고지사항 직접 입력" }));
    expect(screen.getByRole("textbox", { name: "관리비현장" })).toHaveValue("10");
  });

  it("계약면적은 숫자만 입력받고 제곱미터 단위를 자동 저장한다", () => {
    render(<PropertyWizard mode="live" employees={[]} onClose={() => undefined} onSave={noopSave} onPublish={noopPublish} />);
    fireEvent.change(screen.getByLabelText("매물 제목"), { target: { value: "면적 테스트" } });
    fireEvent.change(screen.getByLabelText("정확한 주소"), { target: { value: "대구 북구 산격동" } });
    fireEvent.click(screen.getByRole("button", { name: /다음/ }));
    fireEvent.click(screen.getByRole("button", { name: /다음/ }));
    fireEvent.click(screen.getByRole("button", { name: "고지사항 직접 입력" }));

    fireEvent.change(screen.getByRole("textbox", { name: "계약면적 값" }), { target: { value: "79.62㎡" } });
    expect(screen.getByRole("textbox", { name: "계약면적 값" })).toHaveValue("79.62");
    expect(screen.getByText("㎡")).toBeInTheDocument();
  });

  it("등록과 수정에 같은 단계 모달을 쓰고 저장과 플랫폼 발행을 분리한다", async () => {
    const onSave = vi.fn(async () => ({ ...properties[0], title: "수정한 매물", photos: 2 }));
    const onPublish = vi.fn();
    render(<PropertyWizard mode="live" employees={[]} property={{ ...properties[0], photos: 3 }} onClose={() => undefined} onSave={onSave} onPublish={onPublish} />);

    expect(screen.getByRole("heading", { name: "매물 등록·수정" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /사진 최적화/ }));
    expect(screen.getByText("저장된 최적화 사진 3장")).toBeInTheDocument();
    const files = [new File(["one"], "new-01.jpg", { type: "image/jpeg" }), new File(["two"], "new-02.jpg", { type: "image/jpeg" })];
    fireEvent.change(screen.getByLabelText("매물 사진 선택"), { target: { files } });
    expect(screen.getByText("교체할 사진 2장을 선택했습니다")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /등록 확인/ }));
    expect(screen.getByRole("button", { name: "플랫폼 발행" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /변경사항 저장/ }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.any(Object), files, properties[0].id));
    expect(screen.getByText("매물과 최적화 사진 2장을 저장했습니다.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "플랫폼 발행" }));
    expect(onPublish).toHaveBeenCalledWith(properties[0].id);
  });

  it("새 매물은 저장하기 전에는 플랫폼 발행할 수 없고 저장 후 모달을 유지한다", async () => {
    const saved = { ...properties[0], id: "saved-property", title: "새 매물" };
    const onSave = vi.fn(async () => saved);
    render(<PropertyWizard mode="demo" employees={[]} onClose={() => undefined} onSave={onSave} onPublish={noopPublish} />);
    fireEvent.change(screen.getByLabelText("매물 제목"), { target: { value: "새 매물" } });
    fireEvent.click(screen.getByRole("button", { name: /고지사항 입력/ }));
    fireEvent.click(screen.getByRole("button", { name: "방향 예시값 입력" }));
    fireEvent.click(screen.getByRole("button", { name: /등록 확인/ }));
    expect(screen.getByRole("button", { name: "플랫폼 발행" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "매물 등록" }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "플랫폼 발행" })).toBeEnabled();
  });
});
