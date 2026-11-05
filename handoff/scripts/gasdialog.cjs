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
  await page.evaluate((h) => { const a = document.createElement("a"); a.href = h; a.textContent = "x"; document.body.appendChild(a); a.click(); a.remove(); }, "/config/energy");
  await page.waitForTimeout(5000);
  await page.getByRole("tab", { name: "Gas" }).first().click().catch(async () => page.getByText("Gas", { exact: true }).first().click());
  await page.waitForTimeout(2500);
  await page.screenshot({ path: out("gasdialog-1-tab.png") });
  await page.locator("ha-energy-gas-settings ha-icon-button").first().click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: out("gasdialog-2-dialog.png") });
  const dialog = page.locator("dialog-energy-gas-settings");
  const input = dialog.locator("ha-input.base-temperature input").first();
  if (await input.count()) { await input.fill("18"); await page.waitForTimeout(500); }
  await page.screenshot({ path: out("gasdialog-3-edited.png") });
  console.log("errors:", JSON.stringify(errors).slice(0, 1500));
  await browser.close();
})();
