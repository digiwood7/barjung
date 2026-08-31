import { defaultProfileDir, openNaverContext, verifyNaverLogin } from "./adapters/naver/browser.js";

async function main(): Promise<void> {
  const profileDir = defaultProfileDir(process.env);
  const context = await openNaverContext({
    profileDir,
    headless: true,
    channel: process.env.BARJUNG_NAVER_CHANNEL?.trim() || "chrome",
    retries: 1,
    waitMs: 1000,
  });
  try {
    const result = await verifyNaverLogin(context);
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
