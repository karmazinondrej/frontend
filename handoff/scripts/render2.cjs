const { chromium } = require("playwright");
const path = require("path");
const echartsPath = path.resolve("/home/user/frontend/node_modules/echarts/dist/echarts.min.js");
const day = 24 * 3600 * 1000;
const yearFmt = `(v) => String(new Date(v).getFullYear())`;
const cases = {
  year1: { buckets: [new Date(2026, 0, 1).getTime()], min: new Date(2026, 0, 1).getTime() - 30 * day, max: new Date(2026, 0, 1).getTime() + 30 * day, minInterval: 365 * day },
  year1_noMin: { buckets: [new Date(2026, 0, 1).getTime()], min: new Date(2026, 0, 1).getTime() - 30 * day, max: new Date(2026, 0, 1).getTime() + 30 * day },
  year4: { buckets: [2023, 2024, 2025, 2026].map((y) => new Date(y, 0, 1).getTime()), min: new Date(2023, 0, 1).getTime() - 30 * day, max: new Date(2026, 0, 1).getTime() + 30 * day, minInterval: 365 * day },
  week5: { buckets: [4, 11, 18, 25].map((d) => new Date(2026, 9, d).getTime()).concat([new Date(2026, 10, 1).getTime()]), min: new Date(2026, 9, 4).getTime() - day, max: new Date(2026, 10, 1).getTime() + day, minInterval: 7 * day },
};
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 700, height: 1000 } });
  await page.setContent(`<html><body>${Object.keys(cases).map((k) => `<h4>${k}</h4><div id="${k}" style="width:600px;height:200px;border:1px solid #ccc"></div>`).join("")}</body></html>`);
  await page.addScriptTag({ path: echartsPath });
  await page.evaluate(([cases, yearFmt]) => {
    for (const [k, c] of Object.entries(cases)) {
      const chart = echarts.init(document.getElementById(k));
      chart.setOption({
        xAxis: { type: "time", min: c.min, max: c.max, minInterval: c.minInterval, axisLabel: k.startsWith("year") ? { formatter: eval(yearFmt) } : {} },
        yAxis: { type: "value" },
        grid: { top: 15, bottom: 0, left: 1, right: 1, containLabel: true },
        series: [{ type: "bar", barMaxWidth: 50, data: c.buckets.map((b, i) => [b, 1 + (i % 3)]) }],
      });
    }
  }, [cases, yearFmt]);
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(__dirname, "axes2.png") });
  await browser.close();
})();
