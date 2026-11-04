import { TZDate } from "@date-fns/tz";
import type { HassConfig } from "home-assistant-js-websocket";
import type { TemplateResult } from "lit";
import { html, nothing } from "lit";
import {
  subHours,
  differenceInDays,
  differenceInMonths,
  differenceInCalendarMonths,
  differenceInCalendarWeeks,
  differenceInCalendarYears,
  differenceInYears,
  startOfYear,
  addMilliseconds,
  startOfMonth,
  startOfWeek,
  addYears,
  addMonths,
  addMinutes,
  addHours,
  addWeeks,
  startOfDay,
  addDays,
  subDays,
} from "date-fns";
import type {
  BarSeriesOption,
  CallbackDataParams,
  LineSeriesOption,
  TopLevelFormatterParams,
} from "echarts/types/dist/shared";
import type { LineDataItemOption } from "echarts/types/src/chart/line/LineSeries";
import type { FrontendLocaleData } from "../../../../../data/translation";
import {
  formatNumber,
  formatNumberWithUnit,
} from "../../../../../common/number/format_number";
import { calcDate } from "../../../../../common/datetime/calc_date";
import { firstWeekdayIndex } from "../../../../../common/datetime/first_weekday";
import type { WeekdayIndex } from "../../../../../common/datetime/weekday";
import {
  formatDateMonthYear,
  formatDateShort,
  formatDateVeryShort,
  formatDateWeekdayShortDate,
  formatDateWeekdayVeryShortDate,
  formatDateYear,
} from "../../../../../common/datetime/format_date";
import { formatTime } from "../../../../../common/datetime/format_time";
import type { HaECOption } from "../../../../../resources/echarts/echarts";
import type { StatisticPeriod } from "../../../../../data/recorder";
import { getPeriodicAxisLabelConfig } from "../../../../../components/chart/axis-label";
import { createYAxisPrecisionBounds } from "../../../../../components/chart/y-axis-fraction-digits";
import "../../../../../components/chart/ha-chart-tooltip-marker";

export { fillDataGapsAndRoundCaps } from "../../../../../components/chart/round-caps";

/**
 * Energy chart data point tuple:
 * [0] displayX  - bar position (midpoint for sub-daily periods, start otherwise)
 * [1] value     - the energy value
 * [2] originalStart - original period start timestamp, used for tooltips
 */
export type EnergyDataPoint = [
  displayX: number,
  value: number,
  originalStart: number,
];

// Bars sit on their bucket start, so coarse axes get padding (in days) on
// both sides to keep the first and last bar inside the chart.
const COARSE_AXIS_PADDING: Record<"week" | "month" | "year", number> = {
  week: 1,
  month: 5,
  year: 30,
};

export function getSuggestedMax(
  period: StatisticPeriod,
  end: Date,
  noRounding: boolean
): Date {
  // Maximum period depends on whether plotting a line chart or discrete bars.
  //  - For line charts use noRounding true as we must always plot all the way
  //    to end of a given period, otherwise we cut off the last period of data.
  //  - For bar charts with 5minute intervals, leave the full time range
  //    to ensure we don't cut off any bars
  //  - For bar charts of hourly intervals, round to half-period to avoid excess
  //    padding but not cut off the final bar if placed mid interval.
  //  - For bar charts with whole numbers of days we need to round down to the
  //    start of the final bars period to avoid unnecessary padding of the chart.
  let suggestedMax = new Date(end);

  if (noRounding || period === "5minute") {
    return suggestedMax;
  }
  if (period === "hour") {
    suggestedMax.setMinutes(30, 0, 0);
    return suggestedMax;
  }
  // Sometimes around DST we get a time of 0:59 instead of 23:59 as expected.
  // Correct for this when showing days/months so we don't get an extra day.
  if (suggestedMax.getHours() === 0) {
    suggestedMax = subHours(suggestedMax, 1);
  }
  suggestedMax.setHours(0, 0, 0, 0);
  if (period === "day" || period === "week") {
    return suggestedMax;
  }
  if (period === "year") {
    suggestedMax.setMonth(0);
  }
  // period === month or year
  suggestedMax.setDate(1);
  return suggestedMax;
}

function createYAxisLabelFormatter(
  locale: FrontendLocaleData,
  getFractionDigits: () => number
) {
  return (value: number): string => {
    const fractionDigits = getFractionDigits();
    return formatNumber(value, locale, {
      minimumFractionDigits: value === 0 ? 0 : fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
  };
}

export function getCommonOptions(
  start: Date,
  end: Date,
  locale: FrontendLocaleData,
  config: HassConfig,
  period: StatisticPeriod,
  unit?: string,
  compareStart?: Date,
  compareEnd?: Date,
  formatTotal?: (total: number) => string,
  noRounding = false,
  yAxisFractionDigits = 1,
  getSeriesArea?: (seriesId: string) => string | undefined
): HaECOption {
  let suggestedMax = getSuggestedMax(period, end, noRounding);

  const compare = compareStart !== undefined && compareEnd !== undefined;
  const showCompareYear =
    compare && start.getFullYear() !== compareStart.getFullYear();

  // Recompute the tick-label precision from the visible axis extent so labels
  // stay distinct when zooming in on a narrow range. Energy axes are anchored
  // at 0, so the extent is unioned with 0 to match the rendered ticks.
  let currentFractionDigits = yAxisFractionDigits;

  // Extend suggestedMax so compare bars that land past the main end
  // (e.g. Feb compared to Jan) stay visible instead of being clipped.
  if (compare) {
    const transformedCompareEnd = getCompareTransform(
      start,
      compareStart,
      period,
      firstWeekdayIndex(locale),
      config.time_zone
    )(compareEnd);
    if (transformedCompareEnd.getTime() > suggestedMax.getTime()) {
      suggestedMax = getSuggestedMax(period, transformedCompareEnd, noRounding);
    }
  }

  const xAxis: HaECOption["xAxis"] =
    period === "week" || period === "month" || period === "year"
      ? getCoarseTimeAxis(period, start, end, suggestedMax, locale, config)
      : { type: "time", min: start, max: suggestedMax };

  const options: HaECOption = {
    xAxis,
    yAxis: {
      type: "value",
      name: unit,
      nameGap: 2,
      nameTextStyle: {
        align: "left",
      },
      ...createYAxisPrecisionBounds({
        includeZero: true,
        onFractionDigits: (digits) => {
          currentFractionDigits = digits;
        },
      }),
      axisLabel: {
        formatter: createYAxisLabelFormatter(
          locale,
          () => currentFractionDigits
        ),
      },
      splitLine: {
        show: true,
      },
    },
    grid: {
      top: 15,
      bottom: 0,
      left: 1,
      right: 1,
      containLabel: true,
    },
    tooltip: {
      trigger: "axis",
      formatter: (params: TopLevelFormatterParams) => {
        // trigger: "axis" gives an array of params, but "item" gives a single param
        if (Array.isArray(params)) {
          const mainItems: CallbackDataParams[] = [];
          const compareItems: CallbackDataParams[] = [];
          params.forEach((param: CallbackDataParams) => {
            if (param.seriesId?.startsWith("compare-")) {
              compareItems.push(param);
            } else {
              mainItems.push(param);
            }
          });
          const sections = [mainItems, compareItems]
            .map((items) =>
              formatTooltip(
                items,
                locale,
                config,
                period,
                compare,
                showCompareYear,
                unit,
                formatTotal,
                getSeriesArea
              )
            )
            .filter((s): s is TemplateResult => s !== nothing);
          if (sections.length === 0) return nothing;
          return html`${sections.map(
            (section, i) =>
              html`${i > 0 ? html`<br /><br />` : nothing}${section}`
          )}`;
        }
        return formatTooltip(
          [params],
          locale,
          config,
          period,
          compare,
          showCompareYear,
          unit,
          formatTotal,
          getSeriesArea
        );
      },
    },
  };
  return options;
}

/**
 * Axis for buckets of whole weeks, months or years. The range is widened to
 * the bucket boundaries so a bucket that starts before the period still shows.
 */
function getCoarseTimeAxis(
  period: "week" | "month" | "year",
  start: Date,
  end: Date,
  suggestedMax: Date,
  locale: FrontendLocaleData,
  config: HassConfig
): HaECOption["xAxis"] {
  const padding = COARSE_AXIS_PADDING[period];
  const weekStartsOn = firstWeekdayIndex(locale);
  const bucketStart = (date: Date) =>
    period === "week"
      ? calcDate(date, startOfWeek, locale, config, { weekStartsOn })
      : period === "month"
        ? calcDate(date, startOfMonth, locale, config)
        : calcDate(date, startOfYear, locale, config);
  // Force splitting for short ranges so ticks land on whole buckets, limited
  // to 6 ticks (so a max difference of 5) to reduce clutter.
  const splitNumber =
    period === "week"
      ? undefined
      : Math.min(
          period === "month"
            ? differenceInCalendarMonths(end, start)
            : differenceInCalendarYears(end, start),
          5
        );
  const firstBucket = bucketStart(start);
  const lastBucket = bucketStart(suggestedMax);
  // ECharts fills an axis of one bucket with daily ticks, which the bucket
  // formatter labels with the same name over and over; place the one tick.
  const singleBucket =
    firstBucket.getTime() === lastBucket.getTime()
      ? [firstBucket.getTime()]
      : undefined;
  return {
    type: "time",
    min: subDays(firstBucket, padding),
    max: addDays(lastBucket, padding),
    axisLabel: {
      ...getPeriodicAxisLabelConfig(period, locale, config),
      customValues: singleBucket,
    },
    axisTick: { customValues: singleBucket },
    splitNumber,
    // One tick per year, or a short year axis repeats the same label.
    minInterval: period === "year" ? 365 * 24 * 60 * 60 * 1000 : undefined,
  };
}

function formatTooltip(
  params: CallbackDataParams[],
  locale: FrontendLocaleData,
  config: HassConfig,
  period: StatisticPeriod,
  compare: boolean | null,
  showCompareYear: boolean,
  unit?: string,
  formatTotal?: (total: number) => string,
  getSeriesArea?: (seriesId: string) => string | undefined
): TemplateResult | typeof nothing {
  if (!params[0]?.value) {
    return nothing;
  }
  // displayX may be shifted from the period start (see EnergyDataPoint);
  // originalStart has the real date for display. Gap-filled entries lack it.
  const origDate = params.find((p) => p.value?.[2] != null)?.value?.[2];
  const date = new Date(origDate ?? params[0].value?.[0]);
  let title: string;

  if (period === "year") {
    title = formatDateYear(date, locale, config);
  } else if (period === "month") {
    title = formatDateMonthYear(date, locale, config);
  } else if (period === "week") {
    const formatDate = showCompareYear ? formatDateShort : formatDateVeryShort;
    title = `${formatDate(date, locale, config)} – ${formatDate(addDays(date, 6), locale, config)}`;
  } else if (period === "day") {
    title = showCompareYear
      ? formatDateWeekdayShortDate(date, locale, config)
      : formatDateWeekdayVeryShortDate(date, locale, config);
  } else {
    title = `${
      compare
        ? `${(showCompareYear ? formatDateShort : formatDateVeryShort)(date, locale, config)}: `
        : ""
    }${formatTime(date, locale, config)}`;
    if (params[0].componentSubType === "bar") {
      title += ` – ${formatTime(addHours(date, 1), locale, config)}`;
    }
  }

  let sumPositive = 0;
  let countPositive = 0;
  const rows: TemplateResult[] = [];
  for (const param of params) {
    const y = param.value?.[1] as number;
    const formatOptions = y < 0.1 ? { maximumFractionDigits: 3 } : undefined;
    if (formatNumber(y, locale, formatOptions) === "0") {
      continue;
    }
    // Only the positive bars (consumption) are summed into a total. Negative
    // bars mix unrelated categories (grid export and battery charge), so they
    // are not totaled.
    if (param.componentSubType === "bar" && y > 0) {
      sumPositive += y;
      countPositive++;
    }
    const area = param.seriesId ? getSeriesArea?.(param.seriesId) : undefined;
    rows.push(
      html`<ha-chart-tooltip-marker
          .color=${String(param.color ?? "")}
        ></ha-chart-tooltip-marker>
        ${param.seriesName}${
          area
            ? html` ·
                <span style="color: var(--secondary-text-color);"
                  >${area}</span
                >`
            : nothing
        }:
        <div style="direction:ltr; display: inline;">
          ${formatNumberWithUnit(y, unit, locale, formatOptions)}
        </div>`
    );
  }
  if (rows.length === 0) {
    return nothing;
  }
  return html`<h4 style="text-align: center; margin: 0;">${title}</h4>
    ${rows.map((row, i) => html`${i > 0 ? html`<br />` : nothing}${row}`)}${
      sumPositive !== 0 && countPositive > 1 && formatTotal
        ? html`<br /><b>${formatTotal(sumPositive)}</b>`
        : nothing
    }`;
}

/**
 * Sum of a series' y values over the displayed period, formatted for the
 * legend (e.g. "1.2 kWh"). Returns undefined when the series has no data.
 */
export function formatSeriesTotal(
  series: BarSeriesOption | LineSeriesOption | undefined,
  locale: FrontendLocaleData,
  unit: string
): string | undefined {
  const data = series?.data as any[] | undefined;
  if (!data?.length) {
    return undefined;
  }
  const total = data.reduce(
    (acc, point) => acc + ((point?.value ?? point)?.[1] ?? 0),
    0
  );
  return formatNumberWithUnit(total, unit, locale, {
    maximumFractionDigits: 2,
  });
}

export function fillLineGaps(datasets: LineSeriesOption[]) {
  // Single pass per datapoint: normalise it to a LineDataItemOption, compute
  // its x once, collect every x into the shared bucket set, and build each
  // dataset's lookup map at the same time. This avoids re-deriving x and
  // re-discriminating the tuple/object shape in a separate pass.
  const bucketSet = new Set<number>();
  const dataMaps: Map<number, LineDataItemOption>[] = [];

  for (const dataset of datasets) {
    const dataMap = new Map<number, LineDataItemOption>();
    for (const datapoint of dataset.data!) {
      const item: LineDataItemOption =
        datapoint && typeof datapoint === "object" && "value" in datapoint
          ? datapoint
          : ({ value: datapoint } as LineDataItemOption);
      const x = Number(item.value?.[0]);
      bucketSet.add(x);
      if (!Number.isNaN(x)) {
        dataMap.set(x, item);
      }
    }
    dataMaps.push(dataMap);
  }

  const buckets = Array.from(bucketSet).sort((a, b) => a - b);

  datasets.forEach((dataset, index) => {
    const dataMap = dataMaps[index];
    dataset.data = buckets.map((bucket) => dataMap.get(bucket) ?? [bucket, 0]);
  });

  return datasets;
}

/**
 * Compute the display x-position for an energy bar chart data point.
 * For sub-daily periods (hour/5minute), returns the midpoint to center bars
 * between ticks. For daily or longer periods, returns the start timestamp.
 */
export function computeStatMidpoint(
  start: number,
  end: number,
  period: string,
  compareTransform?: (ts: Date) => Date
): number {
  const center = period === "hour" || period === "5minute";
  if (!center) {
    if (compareTransform) {
      return compareTransform(new Date(start)).getTime();
    }
    return start;
  }
  if (compareTransform) {
    return (
      (compareTransform(new Date(start)).getTime() +
        compareTransform(new Date(end)).getTime()) /
      2
    );
  }
  return (start + end) / 2;
}

const PERIOD_MS: Record<string, number> = {
  "5minute": 5 * 60 * 1000,
  hour: 60 * 60 * 1000,
};

/**
 * Offset from a period's start to its midpoint, for centering sub-daily bars
 * (and forecast lines) between axis ticks — 0 for daily+ periods, which sit at
 * the start.
 *
 * `measuredGap` is the gap between the first two entries, when available. It
 * adapts the offset to data that is finer-grained than the nominal period
 * (e.g. external forecast data), but is clamped to the nominal period so
 * sparse data (gaps between readings) can't inflate the offset, and a lone
 * bucket (no gap to measure) still centers on the nominal midpoint.
 */
export function getPeriodMidpointOffset(
  period: string,
  measuredGap?: number
): number {
  const nominal = PERIOD_MS[period] ?? 0;
  return (measuredGap ? Math.min(measuredGap, nominal) : nominal) / 2;
}

/**
 * Generate the expected statistics-bucket grid across [start, end) so sparse
 * data can be zero-filled. Without a dense grid, ECharts derives the bar band
 * width from the minimum gap between data points: sparse data yields
 * oversized bars, and a single point makes ECharts expand the time axis by
 * ±40% of its span, ignoring the configured min/max.
 *
 * The grid is anchored on a real data bucket rather than on `start`: recorder
 * buckets are UTC-aligned, so in half-hour timezones they don't sit on local
 * period boundaries. Stepping from a real bucket keeps generated buckets
 * exactly on the data's grid (midpoints for sub-daily periods, period starts
 * otherwise). A non-compare series is preferred so the grid aligns with the
 * main data; a compare series is only used as a fallback so a compare-only
 * view — e.g. today has no data yet but the compare period does — still gets
 * zero-filled instead of leaving a lone bar that expands the axis. Returns an
 * empty array when there is no data to anchor on.
 */
export function generateFillBuckets(
  datasets: BarSeriesOption[],
  start: Date,
  end: Date,
  period: StatisticPeriod
): number[] {
  const firstBucketX = (includeCompare: boolean): number | undefined => {
    for (const dataset of datasets) {
      if (
        dataset.type !== "bar" ||
        !dataset.data?.length ||
        (!includeCompare && String(dataset.id).startsWith("compare-"))
      ) {
        continue;
      }
      const first = dataset.data[0];
      const value =
        first && typeof first === "object" && "value" in first
          ? first.value
          : first;
      const x = Number((value as number[])?.[0]);
      if (!Number.isNaN(x)) {
        return x;
      }
    }
    return undefined;
  };

  // Prefer a non-compare anchor; fall back to any bar series (compare included).
  const anchor = firstBucketX(false) ?? firstBucketX(true);
  if (anchor === undefined) {
    return [];
  }

  const anchorDate = new Date(anchor);
  // Step relative to the anchor (not iteratively) so month-length clamping
  // and DST shifts can't accumulate drift.
  const bucketAt = (n: number): number =>
    (period === "5minute"
      ? addMinutes(anchorDate, 5 * n)
      : period === "hour"
        ? addHours(anchorDate, n)
        : period === "day"
          ? addDays(anchorDate, n)
          : period === "week"
            ? addWeeks(anchorDate, n)
            : period === "month"
              ? addMonths(anchorDate, n)
              : addYears(anchorDate, n)
    ).getTime();

  const startMs = start.getTime();
  const endMs = end.getTime();
  const buckets: number[] = [];
  for (let n = 0; ; n--) {
    const ts = bucketAt(n);
    if (ts < startMs) {
      break;
    }
    buckets.push(ts);
  }
  for (let n = 1; ; n++) {
    const ts = bucketAt(n);
    if (ts >= endMs) {
      break;
    }
    buckets.push(ts);
  }
  return buckets;
}

export interface UntrackedSplit {
  /** Untracked consumption per timestamp, clamped to >= 0. */
  positive: Record<number, number>;
  /** Negative untracked per timestamp — only timestamps where the raw value
   * was below zero (tracked devices reported more than total consumption). */
  negative: Record<number, number>;
}

/**
 * Split untracked energy consumption into positive and negative parts per
 * timestamp.
 *
 * Untracked is `used_total - sum(tracked device consumption)`. It can go
 * negative when meters report at coarser resolution than device sensors
 * (e.g. an integer-kWh grid meter vs fractional device sensors). The positive
 * part is the genuine untracked consumption; the negative part is surfaced as
 * a separate, toggleable series so users can hide it without losing it as a
 * diagnostic signal.
 */
export function splitUntrackedConsumption(
  usedTotal: Record<number, number>,
  totalDeviceConsumption: Record<number, number>
): UntrackedSplit {
  const positive: Record<number, number> = {};
  const negative: Record<number, number> = {};
  for (const time of Object.keys(usedTotal)) {
    const ts = Number(time);
    const raw = usedTotal[ts] - (totalDeviceConsumption[ts] || 0);
    positive[ts] = Math.max(0, raw);
    if (raw < 0) {
      negative[ts] = raw;
    }
  }
  return { positive, negative };
}

export function getCompareTransform(
  start: Date,
  compareStart?: Date,
  period?: StatisticPeriod,
  weekStartsOn: WeekdayIndex = 1,
  timeZone?: string
) {
  if (!compareStart) {
    return (ts: Date) => ts;
  }
  // Buckets are aligned to the server's calendar, so they are shifted there:
  // a week shifted in another zone that changes DST on other dates lands an
  // hour off the main period's buckets.
  const inZone = (ts: Date): Date => {
    if (!timeZone) {
      return ts;
    }
    const zoned = new TZDate(ts.getTime(), timeZone);
    // TZDate is invalid where Intl lacks "longOffset" (Chrome < 95, Safari < 15.4)
    return Number.isNaN(zoned.getTime()) ? ts : zoned;
  };
  const compareDayDiff = differenceInDays(start, compareStart);
  // Coarse buckets line up with the main period's buckets only when shifted
  // by whole buckets: the previous month is 28–31 days, not a number of weeks.
  // Weeks shift by the buckets between both starts, so the compare period's
  // first (often partial) week lands on the main period's first week.
  if (period === "week") {
    const weeks = differenceInCalendarWeeks(start, compareStart, {
      weekStartsOn,
    });
    return (ts: Date) => addWeeks(inZone(ts), weeks);
  }
  if (period === "month") {
    const months = Math.round(compareDayDiff / 30.4);
    return (ts: Date) => addMonths(inZone(ts), months);
  }
  if (period === "year") {
    const years = Math.round(compareDayDiff / 365);
    return (ts: Date) => addYears(inZone(ts), years);
  }
  const compareYearDiff = differenceInYears(start, compareStart);
  if (
    compareYearDiff !== 0 &&
    start.getTime() === startOfYear(start).getTime()
  ) {
    // addYears clamps Feb 29 -> Feb 28 across leap-year boundaries; fall back
    // to a day-shift so each compare day keeps a unique x position.
    return (ts: Date) => {
      const zoned = inZone(ts);
      const shifted = addYears(zoned, compareYearDiff);
      return shifted.getDate() === zoned.getDate()
        ? shifted
        : addDays(zoned, compareDayDiff);
    };
  }
  const compareMonthDiff = differenceInMonths(start, compareStart);
  if (
    compareMonthDiff !== 0 &&
    start.getTime() === startOfMonth(start).getTime()
  ) {
    // addMonths clamps Jan 31 -> Feb 28 when shifting between unequal-length
    // months; fall back to a day-shift so each compare day keeps a unique x.
    return (ts: Date) => {
      const zoned = inZone(ts);
      const shifted = addMonths(zoned, compareMonthDiff);
      return shifted.getDate() === zoned.getDate()
        ? shifted
        : addDays(zoned, compareDayDiff);
    };
  }
  if (compareDayDiff !== 0 && start.getTime() === startOfDay(start).getTime()) {
    return (ts: Date) => addDays(inZone(ts), compareDayDiff);
  }
  const compareOffset = start.getTime() - compareStart.getTime();
  return (ts: Date) => addMilliseconds(ts, compareOffset);
}
