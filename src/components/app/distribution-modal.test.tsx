import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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

    const completedDialog = await screen.findByRole("alertdialog", { name: "전체 발행이 완료되었습니다." });
    fireEvent.click(within(completedDialog).getByRole("button", { name: "확인" }));
    expect(screen.getAllByText("발행 완료")).toHaveLength(4);
  });
});
