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
  const navigate = async (href) => {
    await page.evaluate((h) => { const a = document.createElement("a"); a.href = h; a.textContent = "x"; document.body.appendChild(a); a.click(); a.remove(); }, href);
    await page.waitForTimeout(5000);
  };
  // settings dialog
  await navigate("/config/energy");
  await page.screenshot({ path: out("gas-1-config.png"), fullPage: true });
  const gasSettings = page.locator("ha-energy-gas-settings").first();
  const edit = gasSettings.locator("ha-icon-button").first();
  if (await edit.count()) { await edit.click(); await page.waitForTimeout(2500); }
  await page.screenshot({ path: out("gas-2-dialog.png") });
  await page.keyboard.press("Escape"); await page.waitForTimeout(800);
  // gas view
  await page.locator("#sidebar-panel-energy").first().click();
  await page.waitForTimeout(6000);
  const gasTab = page.getByRole("tab", { name: "Gas" }).first();
  if (await gasTab.count()) { await gasTab.click(); } else { await page.getByText("Gas", { exact: true }).first().click(); }
  await page.waitForTimeout(5000);
  const selector = page.locator("hui-energy-period-selector").first();
  const pickPreset = async (name) => { await selector.locator("ha-date-range-picker").first().click(); await page.waitForTimeout(800); await page.getByText(name, { exact: true }).first().click(); await page.waitForTimeout(5000); };
  await pickPreset("Last 30 days");
  await page.screenshot({ path: out("gas-3-30d.png") });
  const chart = page.locator("hui-energy-gas-graph-card ha-chart-base").first();
  const box = await chart.boundingBox();
  if (box) { await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.5); await page.waitForTimeout(1200); }
  await page.screenshot({ path: out("gas-4-tooltip.png") });
  await pickPreset("This year");
  await page.screenshot({ path: out("gas-5-year.png") });
  await pickPreset("Today");
  await page.screenshot({ path: out("gas-6-today.png") });
  console.log("errors:", JSON.stringify(errors).slice(0, 1500));
  await browser.close();
})();
