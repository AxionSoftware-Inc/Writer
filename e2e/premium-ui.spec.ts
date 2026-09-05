import { expect, test } from "@playwright/test";

async function ready(page: import("@playwright/test").Page) {
    await page.evaluate(async () => { await document.fonts.ready; });
    await page.waitForTimeout(120);
}

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
    const metrics = await page.evaluate(() => ({ width: window.innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.width + 1);
}

test("Writer landing keeps the shared premium rhythm", async ({ page }, testInfo) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await ready(page);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("header").first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("writer-landing.png"), fullPage: true, animations: "disabled" });
});

test("Writer documents keeps publication workspace geometry", async ({ page }, testInfo) => {
    await page.goto("/documents", { waitUntil: "domcontentloaded" });
    await ready(page);
    await expect(page.getByRole("heading", { level: 1, name: /publication workspace/i })).toBeVisible();
    await expect(page.locator(".ax-workspace-root")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("writer-documents.png"), fullPage: true, animations: "disabled" });
});
