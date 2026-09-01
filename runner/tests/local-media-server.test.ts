import type { AddressInfo } from "node:net";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createLocalMediaServer } from "../src/local-media-server.js";

const servers: ReturnType<typeof createLocalMediaServer>[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

function fakeClient(): SupabaseClient {
  const maybeSingle = vi.fn(async () => ({ data: { id: "67fc1081-5b0a-4991-8a7f-94942b30f1e7" }, error: null }));
  const secondEq = vi.fn(() => ({ maybeSingle }));
  const firstEq = vi.fn(() => ({ eq: secondEq }));
  const select = vi.fn(() => ({ eq: firstEq }));
  return { from: vi.fn(() => ({ select })) } as unknown as SupabaseClient;
}

async function listen(server: ReturnType<typeof createLocalMediaServer>): Promise<string> {
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

describe("local media server", () => {
  it("receives originals only on loopback and reports per-photo optimization progress", async () => {
    const optimize = vi.fn(async (_client, input, onProgress) => {
      expect(input.files).toHaveLength(2);
      onProgress?.(1, 2);
      onProgress?.(2, 2);
      return 2;
    });
    const base = await listen(createLocalMediaServer({
      client: fakeClient(), officeId: "office-1", port: 0,
      allowedOrigins: ["https://barjeong.vercel.app"], optimize,
    }));
    const healthResponse = await fetch(`${base}/health`, { headers: { Origin: "https://barjeong.vercel.app" } });
    const health = await healthResponse.json() as { token: string };

    const form = new FormData();
    form.append("photos", new Blob(["first"], { type: "image/jpeg" }), "first.jpg");
    form.append("photos", new Blob(["second"], { type: "image/png" }), "second.png");
    const queuedResponse = await fetch(`${base}/media/jobs`, {
      method: "POST",
      headers: {
        Origin: "https://barjeong.vercel.app",
        "X-Barjung-Runner-Token": health.token,
        "X-Barjung-Property-Id": "67fc1081-5b0a-4991-8a7f-94942b30f1e7",
      },
      body: form,
    });
    expect(queuedResponse.status).toBe(202);
    const queued = await queuedResponse.json() as { id: string };

    let completed: { status: string; processed: number; total: number } | undefined;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await fetch(`${base}/media/jobs/${queued.id}`, { headers: { Origin: "https://barjeong.vercel.app", "X-Barjung-Runner-Token": health.token } });
      completed = await response.json() as typeof completed;
      if (completed?.status === "succeeded") break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(completed).toMatchObject({ status: "succeeded", processed: 2, total: 2 });
    expect(optimize).toHaveBeenCalledOnce();
  });

  it("rejects browser origins outside the configured admin sites", async () => {
    const base = await listen(createLocalMediaServer({ client: fakeClient(), officeId: "office-1", port: 0, allowedOrigins: ["https://barjeong.vercel.app"] }));
    const response = await fetch(`${base}/health`, { headers: { Origin: "https://malicious.example" } });
    expect(response.status).toBe(403);
  });
});
