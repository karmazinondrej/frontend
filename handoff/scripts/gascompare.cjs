const { chromium } = require("playwright");
const path = require("path");
const out = (n) => path.join(__dirname, n);
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, timezoneId: "America/Los_Angeles" });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://localhost:8090/", { waitUntil: "load" });
  await page.waitForTimeout(6000);
  await page.locator("#sidebar-panel-energy").first().click();
  await page.waitForTimeout(6000);
  await page.getByRole("tab", { name: "Gas" }).first().click().catch(async () => page.getByText("Gas", { exact: true }).first().click());
  await page.waitForTimeout(4000);
  const selector = page.locator("hui-energy-period-selector").first();
  const pickPreset = async (name) => { await selector.locator("ha-date-range-picker").first().click(); await page.waitForTimeout(800); await page.getByText(name, { exact: true }).first().click(); await page.waitForTimeout(5000); };
  const overflowItem = async (name) => { await selector.locator("ha-dropdown ha-icon-button[slot=trigger]").first().click(); await page.waitForTimeout(500); await selector.locator("ha-dropdown-item", { hasText: name }).first().click(); await page.waitForTimeout(5000); };
  await pickPreset("Last 30 days");
  await overflowItem("Compare data");
  await page.screenshot({ path: out("gascmp-1-30d.png") });
  const chart = page.locator("hui-energy-gas-graph-card ha-chart-base").first();
  const box = await chart.boundingBox();
  if (box) { await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.5); await page.waitForTimeout(1200); }
  await page.screenshot({ path: out("gascmp-2-tooltip.png") });
  const chip = page.locator("hui-energy-gas-graph-card hui-energy-graph-chip").nth(1);
  if (await chip.count()) { await chip.hover(); await page.waitForTimeout(1000); await page.screenshot({ path: out("gascmp-3-chip.png") }); }
  await pickPreset("Today");
  await page.screenshot({ path: out("gascmp-4-today.png") });
  console.log("errors:", JSON.stringify(errors).slice(0, 1500));
  await browser.close();
})();
