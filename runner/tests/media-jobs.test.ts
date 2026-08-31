import { describe, expect, it } from "vitest";
import { validateMediaSourceFiles, type ClaimedMediaJob } from "../src/media-jobs.js";

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
});
