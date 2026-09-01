import { DAANGN_HOME_URL, defaultDaangnProfileDir, openDaangnContext } from "./adapters/daangn/browser.js";

async function main(): Promise<void> {
  const profileDir = defaultDaangnProfileDir();
  const context = await openDaangnContext({
    profileDir,
    headless: false,
    channel: process.env.BARJUNG_DAANGN_CHANNEL?.trim() || "chrome",
  });
  const page = context.pages()[0] ?? await context.newPage();
  await page.goto(DAANGN_HOME_URL, { waitUntil: "domcontentloaded" });
  console.log(`DAANGN_OPEN 당근부동산 브라우저 유지 중: ${profileDir}`);
  await page.waitForEvent("close");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
