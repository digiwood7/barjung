import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { properties } from "@/lib/mock/data";
import { EditPropertyModal } from "./entity-modals";

afterEach(cleanup);

describe("EditPropertyModal", () => {
  it("플랫폼별 원고를 수정해 저장 payload에 반영한다", () => {
    const onSave = vi.fn();
    const property = structuredClone(properties[0]);
    property.copies = { ...property.copies, instagram: "기존 인스타 원고" };
    render(<EditPropertyModal property={property} employees={[]} onClose={() => undefined} onDelete={() => undefined} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText("네이버 원고"), { target: { value: "수정한 네이버 원고" } });
    fireEvent.click(screen.getByRole("button", { name: "변경사항 저장" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      copies: expect.objectContaining({
        naver: "수정한 네이버 원고",
        instagram: "기존 인스타 원고",
      }),
    }));
  });
});
