const echarts = require(process.cwd() + "/node_modules/echarts");
echarts.registerTheme("t", { line: { showSymbol: false, symbolSize: 1, symbol: "circle" } });
const run = (extra) => {
  const c = echarts.init(null, "t", { renderer: "svg", ssr: true, width: 400, height: 200 });
  const data = [[0, null], [1, 5], [2, null], [3, 7], [4, 8], [5, null], [6, 3], [7, null]];
  const isIso = (i) => data[i][1] !== null && (data[i-1]?.[1] ?? null) === null && (data[i+1]?.[1] ?? null) === null;
  c.setOption({ animation: false, xAxis: { type: "value" }, yAxis: {}, series: [{ type: "line", data, symbolSize: 8, ...extra(isIso) }] });
  const svg = c.renderToSVGString(); c.dispose();
  return (svg.match(/<path d="M[^"]*A/g) || []).length; // circle symbols are arcs
};
console.log("old (symbol none, theme hides):", run(() => ({ symbol: "none" })));
console.log("new:", run((isIso) => ({ showSymbol: true, symbol: (_v, p) => isIso(p.dataIndex) ? "circle" : "none" })));
