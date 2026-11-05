const { chromium } = require("playwright");
const path = require("path");
const out = (n) => path.join(__dirname, n);
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const run = async (viewport, tag) => {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    page.on("pageerror", (e) => errors.push(`${tag}: ${e.message}`));
    page.on("console", (m) => { if (m.type() === "error") errors.push(`${tag} console: ${m.text()}`); });
    await page.goto("http://localhost:8090/", { waitUntil: "load" });
    await page.waitForTimeout(6000);
    const nav = page.locator("#sidebar-panel-energy");
    if (await nav.count() === 0) { await page.locator("ha-menu-button, ha-icon-button[slot=navigationIcon]").first().click(); await page.waitForTimeout(500); }
    await page.locator("#sidebar-panel-energy").first().click();
    await page.waitForTimeout(7000);
    await page.screenshot({ path: out(`demo-${tag}-1.png`), fullPage: false });
    return page;
  };
  const page = await run({ width: 1280, height: 1000 }, "desktop");
  // find period selector within shadow DOM
  const selector = page.locator("hui-energy-period-selector").first();
  console.log("selector count", await page.locator("hui-energy-period-selector").count());
  // open date picker preset "This month" via the date range picker: instead use prev button twice? Use the dropdown directly.
  const caretBtn = selector.locator("ha-dropdown ha-button[slot=trigger]").first();
  console.log("caret button text:", (await caretBtn.textContent())?.trim());
  await caretBtn.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: out("demo-desktop-2-dropdown.png") });
  const items = selector.locator("ha-dropdown ha-dropdown-item");
  const n = await items.count();
  for (let i = 0; i < n; i++) {
    console.log("item", i, (await items.nth(i).textContent())?.trim(), "disabled:", await items.nth(i).getAttribute("disabled"), "selected:", await items.nth(i).getAttribute("selected"));
  }
  await page.keyboard.press("Escape");
  // pick "this month" preset through the date range picker
  await selector.locator("ha-date-range-picker").first().click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: out("demo-desktop-3-datepicker.png") });
  const preset = page.getByText("This month", { exact: true }).first();
  if (await preset.count()) { await preset.click(); await page.waitForTimeout(3000); }
  await page.screenshot({ path: out("demo-desktop-4-month.png") });
  await caretBtn.click();
  await page.waitForTimeout(500);
  const weekly = selector.locator("ha-dropdown ha-dropdown-item", { hasText: "Weekly" }).first();
  await weekly.click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: out("demo-desktop-5-weekly.png"), fullPage: true });
  // compare + compare to date via overflow menu
  const overflow = selector.locator("ha-dropdown ha-icon-button[slot=trigger]").first();
  await overflow.click(); await page.waitForTimeout(500);
  await page.screenshot({ path: out("demo-desktop-6-overflow.png") });
  await selector.locator("ha-dropdown-item", { hasText: "Compare data" }).first().click();
  await page.waitForTimeout(3000);
  await overflow.click(); await page.waitForTimeout(500);
  await page.screenshot({ path: out("demo-desktop-7-overflow-compare.png") });
  await selector.locator("ha-dropdown-item", { hasText: "Compare to date" }).first().click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: out("demo-desktop-8-compare-to-date.png"), fullPage: true });
  await page.close();
  const narrow = await run({ width: 400, height: 900 }, "narrow");
  const nsel = narrow.locator("hui-energy-period-selector").first();
  await nsel.locator("ha-dropdown ha-icon-button[slot=trigger]").first().click();
  await narrow.waitForTimeout(500);
  await narrow.screenshot({ path: out("demo-narrow-2-overflow.png") });
  await nsel.locator("ha-dropdown-item", { hasText: "Granularity" }).first().hover();
  await narrow.waitForTimeout(800);
  await narrow.screenshot({ path: out("demo-narrow-3-submenu.png") });
  await narrow.close();
  console.log("errors:", JSON.stringify(errors, null, 1).slice(0, 3000));
  await browser.close();
})();
