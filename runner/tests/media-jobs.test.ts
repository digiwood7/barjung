import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { removeExcessPropertyMedia, validateMediaSourceFiles, type ClaimedMediaJob } from "../src/media-jobs.js";

const job = (path: string): ClaimedMediaJob => ({
  id: "job-1", office_id: "office-1", property_id: "property-1", lease_agent_id: "agent-1",
  source_files: [{ name: "room.jpg", type: "image/jpeg", size: 100, path }],
});

describe("media optimization queue", () => {
  it("accepts only staging paths scoped to the claimed office, property and job", () => {
    expect(validateMediaSourceFiles(job("office-1/property-1/job-1/01-room.jpg"))).toHaveLength(1);
    expect(() => validateMediaSourceFiles(job("office-1/property-2/job-1/01-room.jpg"))).toThrow(/작업 범위/);
    expect(() => validateMediaSourceFiles(job("office-1/property-1/job-1/../secret.jpg"))).toThrow(/작업 범위/);
  });

  it("새 사진 수보다 뒤에 있던 기존 사진 파일과 메타데이터를 제거한다", async () => {
    const remove = vi.fn(async () => ({ error: null }));
    const gte = vi.fn()
      .mockResolvedValueOnce({ data: [{ storage_path: "office-1/property-1/03.jpg" }], error: null })
      .mockResolvedValueOnce({ error: null });
    const eq = vi.fn(() => ({ gte }));
    const from = vi.fn(() => ({
      select: vi.fn(() => ({ eq })),
      delete: vi.fn(() => ({ eq })),
    }));
    const client = {
      from,
      storage: { from: vi.fn(() => ({ remove })) },
    } as unknown as SupabaseClient;

    await removeExcessPropertyMedia(client, job("office-1/property-1/job-1/01-room.jpg"), 2);

    expect(remove).toHaveBeenCalledWith(["office-1/property-1/03.jpg"]);
    expect(gte).toHaveBeenNthCalledWith(1, "sort_order", 2);
    expect(gte).toHaveBeenNthCalledWith(2, "sort_order", 2);
  });
});
