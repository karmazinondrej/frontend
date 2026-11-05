const { chromium } = require("playwright");
const path = require("path");
const out = (n) => path.join(__dirname, n);
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  page.on("pageerror", (e) => console.log("pageerror", e.message));
  await page.goto("http://localhost:8090/", { waitUntil: "load" });
  await page.waitForTimeout(5000);
  await page.locator("#sidebar-panel-energy").first().click();
  await page.waitForTimeout(6000);
  const selector = page.locator("hui-energy-period-selector").first();
  const pickPreset = async (name) => {
    await selector.locator("ha-date-range-picker").first().click();
    await page.waitForTimeout(800);
    await page.getByText(name, { exact: true }).first().click();
    await page.waitForTimeout(4000);
  };
  const pickGranularity = async (name) => {
    await selector.locator("ha-dropdown ha-button[slot=trigger]").first().click();
    await page.waitForTimeout(500);
    await selector.locator("ha-dropdown ha-dropdown-item", { hasText: name }).first().click();
    await page.waitForTimeout(5000);
  };
  await pickPreset("Last 30 days");
  await page.screenshot({ path: out("d2-30d-daily.png") });
  await pickGranularity("Weekly");
  await page.screenshot({ path: out("d2-30d-weekly.png") });
  await pickPreset("This year");
  await page.screenshot({ path: out("d2-year-weekly.png") });
  await pickGranularity("Monthly");
  await page.screenshot({ path: out("d2-year-monthly.png") });
  await pickGranularity("Yearly");
  await page.screenshot({ path: out("d2-year-yearly.png") });
  await pickGranularity("Automatic");
  await page.screenshot({ path: out("d2-year-auto.png") });
  await browser.close();
})();
