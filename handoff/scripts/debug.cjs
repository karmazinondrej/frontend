const { chromium } = require("playwright");
const path = require("path");
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  page.on("pageerror", (e) => console.log("pageerror", e.message));
  await page.goto("http://localhost:8090/", { waitUntil: "load" });
  await page.waitForTimeout(5000);
  await page.locator("#sidebar-panel-energy").first().click();
  await page.waitForTimeout(6000);
  const selector = page.locator("hui-energy-period-selector").first();
  await selector.locator("ha-date-range-picker").first().click();
  await page.waitForTimeout(800);
  await page.getByText("This month", { exact: true }).first().click();
  await page.waitForTimeout(3000);
  const dump = async (label) => {
    const info = await page.evaluate(() => {
      const all = [];
      const walk = (root) => {
        for (const el of root.querySelectorAll("*")) {
          if (el.tagName === "HUI-ENERGY-GAS-GRAPH-CARD") all.push(el);
          if (el.shadowRoot) walk(el.shadowRoot);
        }
      };
      walk(document);
      const gas = all[0];
      if (!gas) return "no gas card";
      const base = gas.shadowRoot.querySelector("ha-chart-base");
      const chart = base.chart;
      const opt = chart.getOption();
      const x = opt.xAxis[0];
      const series = opt.series.map((s) => ({ id: s.id, n: s.data.length, first: s.data[0], last: s.data[s.data.length - 1] }));
      return { granularity: gas._granularity, start: gas._start, end: gas._end, min: new Date(x.min).toISOString(), max: new Date(x.max).toISOString(), minInterval: x.minInterval, splitNumber: x.splitNumber, dataZoom: opt.dataZoom?.map((z) => [z.start, z.end, z.startValue, z.endValue]), series, width: base.offsetWidth };
    });
    console.log(label, JSON.stringify(info, null, 1));
  };
  await dump("daily");
  await selector.locator("ha-dropdown ha-button[slot=trigger]").first().click();
  await page.waitForTimeout(500);
  await selector.locator("ha-dropdown ha-dropdown-item", { hasText: "Weekly" }).first().click();
  await page.waitForTimeout(3000);
  await dump("weekly");
  await browser.close();
})();
