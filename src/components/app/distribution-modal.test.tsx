import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { properties } from "@/lib/mock/data";
import type { DistributionTarget } from "@/lib/domain/types";
import { DistributionModal } from "./distribution-modal";

afterEach(cleanup);

describe("DistributionModal 전체 발행", () => {
  it("네 플랫폼 종료 후 완료 알림과 플랫폼별 완료 상태를 표시한다", async () => {
    const targets: DistributionTarget[] = properties[0].targets.map((target) => ({ ...target, status: "succeeded", progress: 100 }));
    const completed = { ...properties[0], targets };
    render(<DistributionModal
      property={properties[0]}
      mode="live"
      agent={{ id: "a1", deviceName: "BARJUNG-PC", status: "online", lastHeartbeatAt: null, label: "온라인" }}
      onClose={() => undefined}
      onUpdate={() => undefined}
      requestDistribution={vi.fn(async () => completed)}
      getProperty={vi.fn(async () => completed)}
    />);

    fireEvent.click(screen.getByRole("button", { name: "선택 플랫폼 발행 시작 (4)" }));
    const completedDialog = await screen.findByRole("alertdialog", { name: "선택한 플랫폼 발행이 완료되었습니다." });
    fireEvent.click(within(completedDialog).getByRole("button", { name: "결과 확인" }));
    expect(screen.getAllByText("발행 완료")).toHaveLength(4);
  });

  it("실패 플랫폼 사유를 남기고 그 플랫폼만 재발행한다", async () => {
    const targets: DistributionTarget[] = properties[0].targets.map((target) => target.platform === "instagram"
      ? { ...target, status: "failed", progress: 100, error: "인스타 로그인 세션이 만료되었습니다." }
      : target.platform === "zigbang"
        ? { ...target, status: "not_requested", progress: 0 }
        : { ...target, status: "succeeded", progress: 100 });
    const completed = { ...properties[0], targets };
    const retryTargets = targets.map((target) => target.platform === "instagram" ? { ...target, status: "queued" as const, progress: 0, error: undefined } : target);
    const requestDistribution = vi.fn().mockResolvedValueOnce(completed).mockResolvedValueOnce({ ...completed, targets: retryTargets });
    render(<DistributionModal
      property={properties[0]}
      mode="live"
      agent={{ id: "a1", deviceName: "BARJUNG-PC", status: "online", lastHeartbeatAt: null, label: "온라인" }}
      onClose={() => undefined}
      onUpdate={() => undefined}
      requestDistribution={requestDistribution}
      getProperty={vi.fn(async () => completed)}
      initialPlatforms={["naver", "instagram", "daangn"]}
    />);

    fireEvent.click(screen.getByRole("button", { name: "선택 플랫폼 발행 시작 (3)" }));
    const resultDialog = await screen.findByRole("alertdialog", { name: "선택한 플랫폼 발행 처리가 끝났습니다." });
    expect(within(resultDialog).getByText("인스타 로그인 세션이 만료되었습니다.")).toBeInTheDocument();
    fireEvent.click(within(resultDialog).getByRole("button", { name: "결과 확인" }));
    fireEvent.click(screen.getByRole("button", { name: "인스타만 재발행" }));
    await waitFor(() => expect(requestDistribution).toHaveBeenLastCalledWith(properties[0].id, ["instagram"]));
    expect(screen.getByText("이번 발행에서 선택하지 않음")).toBeInTheDocument();
  });

  it("기본 전체 선택에서 원하는 플랫폼만 골라 명시적으로 발행을 시작한다", async () => {
    const requestDistribution = vi.fn(async (_propertyId: string, selected?: string[]) => ({
      ...properties[0],
      targets: properties[0].targets.map((target) => selected?.includes(target.platform)
        ? { ...target, status: "queued" as const, progress: 0 }
        : { ...target, status: "not_requested" as const, progress: 0 }),
    }));
    render(<DistributionModal
      property={properties[0]}
      mode="live"
      agent={{ id: "a1", deviceName: "BARJUNG-PC", status: "online", lastHeartbeatAt: null, label: "온라인" }}
      onClose={() => undefined}
      onUpdate={() => undefined}
      requestDistribution={requestDistribution}
      getProperty={vi.fn(async () => properties[0])}
    />);

    for (const name of ["인스타", "당근"]) fireEvent.click(screen.getByRole("checkbox", { name: `${name} 발행 선택` }));
    expect(requestDistribution).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "선택 플랫폼 발행 시작 (2)" }));
    await waitFor(() => expect(requestDistribution).toHaveBeenCalledWith(properties[0].id, ["naver", "zigbang"]));
  });
});
