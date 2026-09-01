import { defaultInstagramProfileDir, openInstagramContext, verifyInstagramLogin } from "./adapters/instagram/browser.js";

async function main(): Promise<void> {
  const context = await openInstagramContext({
    profileDir: defaultInstagramProfileDir(process.env),
    headless: true,
    channel: process.env.BARJUNG_INSTAGRAM_CHANNEL?.trim() || "chrome",
    retries: 1,
    waitMs: 1000,
  });
  try {
    const username = process.env.BARJUNG_INSTAGRAM_USERNAME?.trim().replace(/^@/, "") || undefined;
    const result = await verifyInstagramLogin(context, username);
    process.stdout.write(JSON.stringify({ status: result.ok ? "connected" : "expired", message: result.reason }));
  } finally {
    await context.close().catch(() => undefined);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stdout.write(JSON.stringify({ status: "action_required", message }));
  process.exitCode = 1;
});
