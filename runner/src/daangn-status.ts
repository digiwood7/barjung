import { defaultDaangnProfileDir, openDaangnContext, verifyDaangnLogin } from "./adapters/daangn/browser.js";

async function main(): Promise<void> {
  const context = await openDaangnContext({ profileDir: defaultDaangnProfileDir(), headless: true, channel: process.env.BARJUNG_DAANGN_CHANNEL?.trim() || "chrome", retries: 1 });
  try {
    const result = await verifyDaangnLogin(context);
    process.stdout.write(JSON.stringify({ status: result.ok ? "connected" : "expired", message: result.reason }));
  } finally {
    await context.close().catch(() => undefined);
  }
}

main().catch((error) => { process.stdout.write(JSON.stringify({ status: "action_required", message: error instanceof Error ? error.message : String(error) })); process.exitCode = 1; });
