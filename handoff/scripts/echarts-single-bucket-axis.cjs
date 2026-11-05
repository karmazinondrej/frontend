const echarts = require(process.cwd() + "/node_modules/echarts");
const D = 864e5;
const month = (v) => new Date(v).toLocaleString("en", { month: "short", timeZone: "UTC" });
const year = (v) => String(new Date(v).getUTCFullYear());
const render = (name, xAxis, bar, fmt) => {
  const c = echarts.init(null, null, { renderer: "svg", ssr: true, width: 600, height: 200 });
  c.setOption({ animation: false, xAxis: { type: "time", ...xAxis, axisLabel: { formatter: fmt, ...(xAxis.axisLabel||{}) } }, yAxis: { show: false }, series: [{ type: "bar", data: [[bar, 5]] }] });
  const svg = c.renderToSVGString(); c.dispose();
  console.log(name.padEnd(14), (svg.match(/>(\w{3}|\d{4})</g)||[]).map(x=>x.slice(1,-1)).join(" "));
};
const sep = Date.UTC(2026, 8, 1), aug = Date.UTC(2026, 7, 1), y = Date.UTC(2026,0,1);
render("month 1 sN0", { min: sep-5*D, max: sep+5*D, splitNumber: 0 }, sep, month);
render("month 2 sN1", { min: aug-5*D, max: sep+5*D, splitNumber: 1 }, sep, month);
render("month 6 sN5", { min: Date.UTC(2026,3,1)-5*D, max: sep+5*D, splitNumber: 5 }, sep, month);
render("year 1", { min: y-30*D, max: y+30*D, splitNumber: 0, minInterval: 365*D }, y, year);
render("year 2", { min: y-30*D, max: Date.UTC(2027,0,1)+30*D, splitNumber: 1, minInterval: 365*D }, y, year);
render("month1 custom", { min: sep-5*D, max: sep+5*D, axisLabel: { customValues: [sep] }, axisTick: { customValues: [sep] } }, sep, month);
render("year1 custom", { min: y-30*D, max: y+30*D, axisLabel: { customValues: [y] }, axisTick: { customValues: [y] } }, y, year);
process.exit(0);
