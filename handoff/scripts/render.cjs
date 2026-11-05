const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const echartsPath = path.resolve("/home/user/frontend/node_modules/echarts/dist/echarts.min.js");
const day = 24 * 3600 * 1000;
const cases = {
  week: { // Nov 2026, Sunday weeks: bars at Nov 1, 8, 15, 22, 29
    buckets: [1, 8, 15, 22, 29].map((d) => new Date(2026, 10, d).getTime()),
    min: new Date(2026, 10, 1).getTime() - 1 * day,
    max: new Date(2026, 10, 29).getTime() + 1 * day,
  },
  month: {
    buckets: Array.from({ length: 12 }, (_, i) => new Date(2026, i, 1).getTime()),
    min: new Date(2026, 0, 1).getTime() - 5 * day,
    max: new Date(2026, 11, 1).getTime() + 5 * day,
  },
  year: {
    buckets: [2023, 2024, 2025, 2026].map((y) => new Date(y, 0, 1).getTime()),
    min: new Date(2023, 0, 1).getTime() - 30 * day,
    max: new Date(2026, 0, 1).getTime() + 30 * day,
  },
};
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 700, height: 900 } });
  await page.setContent(`<html><body>${Object.keys(cases).map((k) => `<h4>${k}</h4><div id="${k}" style="width:600px;height:220px;border:1px solid #ccc"></div>`).join("")}</body></html>`);
  await page.addScriptTag({ path: echartsPath });
  await page.evaluate((cases) => {
    for (const [k, c] of Object.entries(cases)) {
      const chart = echarts.init(document.getElementById(k));
      chart.setOption({
        xAxis: { type: "time", min: c.min, max: c.max },
        yAxis: { type: "value" },
        grid: { top: 15, bottom: 0, left: 1, right: 1, containLabel: true },
        series: [{ type: "bar", barMaxWidth: 50, data: c.buckets.map((b, i) => [b, 1 + (i % 3)]) }],
      });
    }
  }, cases);
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(__dirname, "axes.png") });
  await browser.close();
})();
