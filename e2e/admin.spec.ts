import { expect, test } from "@playwright/test";

test("approved dashboard omits removed features and shows platform icons", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /매물의 시작부터/ })).toBeVisible();
  await expect(page.getByText("오늘의 배포 레일")).toHaveCount(0);
  await expect(page.getByText("통화기록")).toHaveCount(0);
  const firstProperty = page.locator(".property-mini-list > button").first();
  await expect(firstProperty.locator(".platform-brand")).toHaveCount(4);
});

test("customer CRUD opens from the main navigation", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Desktop CRUD layout is covered here; mobile navigation has a separate test.");
  await page.goto("/");
  await page.getByRole("button", { name: "고객관리" }).click();
  await page.getByRole("button", { name: /고객 등록/ }).click();
  await page.getByLabel("이름").fill("김고객");
  await page.getByLabel("전화번호").fill("010-1111-2222");
  await page.getByLabel("희망 조건").fill("북문, 월 45만원 이하");
  await page.getByRole("button", { name: "등록", exact: true }).click();
  await expect(page.getByRole("button", { name: /김고객.*010-1111-2222/ })).toBeVisible();
});

test("property editor keeps actions visible and scrolls long fields", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Desktop modal viewport regression coverage.");
  await page.goto("/");
  await page.getByRole("button", { name: /매물관리/ }).click();
  await page.locator("tbody tr").first().click();
  await page.getByRole("button", { name: "매물 수정" }).click();

  const dialog = page.getByRole("dialog");
  const scrollRegion = page.getByRole("region", { name: "매물 등록·수정 항목" });
  await expect(dialog).toBeVisible();
  await page.getByRole("button", { name: /고지사항 입력/ }).click();

  const layout = await scrollRegion.evaluate((element) => ({
    overflowY: getComputedStyle(element).overflowY,
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }));
  expect(layout.overflowY).toBe("auto");
  expect(layout.scrollHeight).toBeGreaterThan(layout.clientHeight);

  await page.getByRole("button", { name: /등록 확인/ }).click();
  await expect(page.getByRole("button", { name: "변경사항 저장" })).toBeInViewport();
});

test("mobile navigation exposes the approved menu", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile-only navigation coverage.");
  await page.goto("/");
  await page.locator(".mobile-menu").click();
  await expect(page.getByRole("button", { name: /매물관리/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "고객관리" })).toBeVisible();
  await expect(page.getByRole("button", { name: "직원관리" })).toBeVisible();
});
