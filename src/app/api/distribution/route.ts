import { readJson, withLive } from "@/lib/api/server";
import type { Platform } from "@/lib/domain/types";
import { requestDistribution } from "@/lib/supabase/workspace";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withLive(request, async (ctx) => {
    const { propertyId, platforms } = await readJson<{ propertyId?: string; platforms?: Platform[] }>(request);
    if (!propertyId) throw new Error("propertyId 가 필요합니다.");
    return requestDistribution(ctx, propertyId, platforms);
  });
}
