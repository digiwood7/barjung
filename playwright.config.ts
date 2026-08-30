import { defineConfig, devices } from "@playwright/test";

// 3000 은 다른 개발 서버가 점유할 수 있어 e2e 전용 포트를 쓰고 기존 서버를 재사용하지 않는다.
const port = Number(process.env.BARJUNG_E2E_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "line",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npm run build && npm run start -- --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    // e2e 는 항상 demo 모드로 돈다 (고객 DB 값이 .env.local 에 있어도 무시)
    env: { SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "", NEXT_PUBLIC_SUPABASE_URL: "" },
  },
});
