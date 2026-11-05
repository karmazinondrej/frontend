const { chromium } = require("playwright");
const path = require("path");
const out = (n) => path.join(__dirname, n);
(async () => {
  const browser = await chromium.launch();
  for (const tz of ["America/Los_Angeles", "UTC"]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, timezoneId: tz });
    await page.goto("http://localhost:8090/", { waitUntil: "load" });
    await page.waitForTimeout(5000);
    await page.locator("#sidebar-panel-energy").first().click();
    await page.waitForTimeout(6000);
    const selector = page.locator("hui-energy-period-selector").first();
    await selector.locator("ha-date-range-picker").first().click(); await page.waitForTimeout(800);
    await page.getByText("This year", { exact: true }).first().click(); await page.waitForTimeout(5000);
    await page.screenshot({ path: out(`tz-${tz.replace("/", "-")}-year-auto.png`) });
    await page.close();
  }
  await browser.close();
})();
