import { classifyError } from "../errors.js";
import type { AdapterMap, Platform, PublishInput, PublishResult } from "../types.js";

export async function runTargets(inputs: PublishInput[], adapters: AdapterMap): Promise<Partial<Record<Platform, PublishResult>>> {
  const entries = await Promise.all(inputs.map(async (input): Promise<[Platform, PublishResult]> => {
    const adapter = adapters[input.platform];
    if (!adapter) return [input.platform, { status: "not_configured", errorCode: "adapter_not_configured", errorSummary: `${input.platform} 어댑터가 없습니다.` }];
    try {
      return [input.platform, await adapter.publish(input)];
    } catch (error) {
      const classified = classifyError(error);
      return [input.platform, { status: "failed", errorCode: classified.code, errorSummary: classified.summary }];
    }
  }));
  return Object.fromEntries(entries);
}
