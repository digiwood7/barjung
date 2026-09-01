import { afterEach, describe, expect, it, vi } from "vitest";
import { properties } from "@/lib/mock/data";
import { createApiRepository } from "./client";

afterEach(() => { vi.unstubAllGlobals(); });

describe("direct local media optimization", () => {
  it("sends originals to the Windows runner and never uses the Supabase staging route", async () => {
    const property = properties[0];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/health")) return new Response(JSON.stringify({ status: "online", token: "runner-token" }), { status: 200 });
      if (url.endsWith("/media/jobs")) return new Response(JSON.stringify({ id: "job-1", status: "queued", processed: 0, total: 1 }), { status: 202 });
      if (url.endsWith("/media/jobs/job-1")) return new Response(JSON.stringify({ id: "job-1", status: "succeeded", processed: 1, total: 1 }), { status: 200 });
      if (url === `/api/properties/${property.id}`) return new Response(JSON.stringify({ ...property, photos: 1 }), { status: 200 });
      return new Response(JSON.stringify({ error: `unexpected ${url}` }), { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const progress = vi.fn();
    const result = await createApiRepository().uploadPropertyMedia(property.id, [new File(["photo"], "room.jpg", { type: "image/jpeg" })], progress);

    expect(result.photos).toBe(1);
    expect(fetchMock.mock.calls.map(([input]) => String(input))).not.toContain(`/api/properties/${property.id}/media`);
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("property-media-staging"))).toBe(false);
    expect(progress).toHaveBeenLastCalledWith({ phase: "complete", processed: 1, total: 1 });
  });
});
