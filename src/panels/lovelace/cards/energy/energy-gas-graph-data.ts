import type { BarSeriesOption, LineSeriesOption } from "echarts/charts";
import type { HassEntities } from "home-assistant-js-websocket";
import { computeYAxisFractionDigits } from "../../../../components/chart/y-axis-fraction-digits";
import { fillDataGapsAndRoundCaps } from "../../../../components/chart/round-caps";
import type {
  EnergyData,
  GasSourceTypeEnergyPreference,
} from "../../../../data/energy";
import { getSuggestedPeriod } from "../../../../data/energy";
import {
  convertCelsius,
  DEFAULT_HEATING_BASE_TEMPERATURE,
  degreeDaysByBucket,
  meanTemperatureByBucket,
  mergeBuckets,
  totalDegreeDays,
} from "../../../../data/energy-heating";
import type { LocalizeFunc } from "../../../../common/translations/localize";
import type { Statistics, StatisticsMetaData } from "../../../../data/recorder";
import { getStatisticLabel } from "../../../../data/recorder";
import type { HomeAssistant } from "../../../../types";
import { getEnergyColor } from "./common/color";
import { sumEnergyStatistics } from "./common/sum-statistics";
import {
  type EnergyDataPoint,
  generateFillBuckets,
  getCompareTransform,
} from "./common/energy-chart-options";

export interface EnergyGasGraphDataParams {
  localize: LocalizeFunc;
  states: HassEntities;
  formatEntityName: HomeAssistant["formatEntityName"];
  darkMode: boolean;
  energyData: EnergyData;
  computedStyles: CSSStyleDeclaration;
  /** Current time, injected so the transform is deterministic. */
  now: Date;
  /** Unit the outdoor temperature statistics were fetched in. */
  temperatureUnit: string;
  /** Sums all gas sources into one series with this name. */
  combinedName?: string;
}

type GasChartSource = Pick<
  GasSourceTypeEnergyPreference,
  "stat_energy_from" | "name"
>;

export interface EnergyGasGraphData {
  chartData: (BarSeriesOption | LineSeriesOption)[];
  start: Date;
  end: Date;
  compareStart?: Date;
  compareEnd?: Date;
  unit?: string;
  total?: number;
  yAxisFractionDigits: number;
  /** Set when an outdoor temperature line is drawn on the second y-axis. */
  temperatureUnit?: string;
  /** Heating degree days over the period, from the outdoor temperature. */
  heatingDegreeDays?: number;
  heatingDegreeDaysCompare?: number;
  /** Degree day base in `temperatureUnit`. */
  heatingBaseTemperature?: number;
}

/**
 * Transforms an energy collection update (`EnergyData` + config + environment)
 * into the gas graph card's chart series and derived state. Pure data
 * processing: every environment read (current time, theme style, entity
 * states and names) is injected so the transform is deterministic and
 * benchmarkable.
 */
export function generateEnergyGasGraphData(
  params: EnergyGasGraphDataParams
): EnergyGasGraphData {
  const { energyData, computedStyles, now, combinedName } = params;

  const start = energyData.start;
  const end = energyData.end || now;

  const compareStart = energyData.startCompare;
  const compareEnd = energyData.endCompare;

  const gasSources: GasSourceTypeEnergyPreference[] =
    energyData.prefs.energy_sources.filter(
      (source) => source.type === "gas"
    ) as GasSourceTypeEnergyPreference[];

  const combine = combinedName !== undefined && gasSources.length > 1;
  const statIds = gasSources.map((source) => source.stat_energy_from);
  const chartSources: GasChartSource[] = combine
    ? [{ stat_energy_from: "gas", name: combinedName }]
    : gasSources;
  const chartStats = (statistics: Statistics): Statistics =>
    combine ? { gas: sumEnergyStatistics(statistics, statIds) } : statistics;

  const unit = energyData.gasUnit;

  const datasets: BarSeriesOption[] = [];

  let yMin = Infinity;
  let yMax = -Infinity;
  const trackY = (v: number) => {
    if (v < yMin) yMin = v;
    if (v > yMax) yMax = v;
  };

  // `compareTransform` and `period` depend only on start/end/compareStart,
  // which are identical for both the compare and main passes. Compute them
  // once here instead of recomputing (and re-allocating the transform
  // closure) inside each processDataSet call.
  const compareTransform = getCompareTransform(start, compareStart!);
  const period = getSuggestedPeriod(start, end);

  if (energyData.statsCompare) {
    datasets.push(
      ...processDataSet(
        params,
        compareTransform,
        period,
        chartStats(energyData.statsCompare),
        energyData.statsMetadata,
        chartSources,
        computedStyles,
        trackY,
        true
      )
    );
  } else {
    // add empty dataset so compare bars are first
    // `stack: gas` so it doesn't take up space yet
    const firstId = chartSources[0]?.stat_energy_from ?? "placeholder";
    datasets.push({
      id: "compare-" + firstId,
      type: "bar",
      stack: "gas",
      data: [],
    });
  }

  datasets.push(
    ...processDataSet(
      params,
      compareTransform,
      period,
      chartStats(energyData.stats),
      energyData.statsMetadata,
      chartSources,
      computedStyles,
      trackY
    )
  );

  fillDataGapsAndRoundCaps(
    datasets,
    true,
    generateFillBuckets(datasets, start, end, period)
  );
  const yAxisFractionDigits = computeYAxisFractionDigits(yMin, yMax, true);
  const total = processTotal(energyData.stats, gasSources);
  // After gap filling, which is meant for the bars only.
  const heating = processHeating(params, compareTransform, period, gasSources);
  const chartData: (BarSeriesOption | LineSeriesOption)[] = heating
    ? [...datasets, ...heating.series]
    : datasets;

  return {
    chartData,
    start,
    end,
    compareStart,
    compareEnd,
    unit,
    total,
    yAxisFractionDigits,
    ...(heating && {
      temperatureUnit: params.temperatureUnit,
      heatingDegreeDays: heating.degreeDays,
      heatingDegreeDaysCompare: heating.compareDegreeDays,
      heatingBaseTemperature: heating.baseTemperature,
    }),
  };
}

/**
 * The outdoor temperature on the grid of the gas consumption buckets, for
 * the main and the compare period. Gas sources normally share one outdoor
 * sensor, so the first source with one is used. Buckets of at least a day
 * carry their degree days as the fourth tuple element for the tooltip; degree
 * days are a daily quantity, so the period totals come straight from the
 * daily readings and hourly buckets carry none.
 */
function processHeating(
  {
    localize,
    energyData,
    computedStyles,
    temperatureUnit,
  }: EnergyGasGraphDataParams,
  compareTransform: (ts: Date) => Date,
  period: ReturnType<typeof getSuggestedPeriod>,
  gasSources: GasSourceTypeEnergyPreference[]
) {
  const source = gasSources.find(
    (gasSource) => gasSource.stat_outdoor_temperature
  );
  if (!source) {
    return undefined;
  }
  const statId = source.stat_outdoor_temperature!;
  const baseTemperature = convertCelsius(
    source.heating_base_temperature ?? DEFAULT_HEATING_BASE_TEMPERATURE,
    temperatureUnit
  );
  const hourly = period === "hour" || period === "5minute";
  const name = localize(
    "ui.panel.lovelace.cards.energy.energy_gas_graph.outdoor_temperature"
  );

  const heatingSeries = (
    statistics: Statistics,
    dailyStatistics: Statistics | undefined,
    compare: boolean
  ) => {
    const readings = statistics[statId] ?? [];
    // Hourly and daily readings share the gas grid, so they fill in buckets
    // the gas sensor missed; coarser buckets follow the gas rows.
    const buckets =
      hourly || period === "day"
        ? mergeBuckets(statistics[source.stat_energy_from] ?? [], readings)
        : (statistics[source.stat_energy_from] ?? []);
    const dailyReadings = dailyStatistics?.[statId] ?? [];
    const temperatures = meanTemperatureByBucket(readings, buckets);
    const bucketDegreeDays = hourly
      ? undefined
      : degreeDaysByBucket(dailyReadings, buckets, baseTemperature);
    const degreeDays = totalDegreeDays(dailyReadings, baseTemperature);
    const transform = compare ? compareTransform : undefined;
    // A bucket without a reading breaks the line instead of being bridged.
    const data: [number, number | null, number, number?][] = [];
    let readingCount = 0;
    for (const bucket of buckets) {
      const temperature = temperatures.get(bucket.start) ?? null;
      if (temperature !== null) {
        readingCount++;
      }
      let x: number;
      if (hourly) {
        x = transform
          ? (transform(new Date(bucket.start)).getTime() +
              transform(new Date(bucket.end)).getTime()) /
            2
          : (bucket.start + bucket.end) / 2;
      } else {
        x = transform
          ? transform(new Date(bucket.start)).getTime()
          : bucket.start;
      }
      data.push([
        x,
        temperature,
        bucket.start,
        bucketDegreeDays?.get(bucket.start),
      ]);
    }
    const isIsolated = (index: number) =>
      data[index][1] !== null &&
      (data[index - 1]?.[1] ?? null) === null &&
      (data[index + 1]?.[1] ?? null) === null;
    const series: LineSeriesOption = {
      id: (compare ? "compare-temperature-" : "temperature-") + statId,
      type: "line",
      name,
      yAxisIndex: 1,
      color: computedStyles.getPropertyValue(
        compare ? "--secondary-text-color" : "--primary-text-color"
      ),
      lineStyle: compare ? { width: 1.5, type: [7, 5] } : { width: 1.5 },
      // A reading between gaps has no line to draw, so it gets a marker. The
      // chart theme hides symbols, so they are switched on for this series.
      showSymbol: true,
      symbol: (_value: unknown, params: { dataIndex: number }) =>
        isIsolated(params.dataIndex) ? "circle" : "none",
      symbolSize: 8,
      z: 3,
      data,
    };
    return { series, degreeDays, readingCount };
  };

  const main = heatingSeries(
    energyData.stats,
    energyData.dailyTemperatureStats,
    false
  );
  const compare = energyData.statsCompare
    ? heatingSeries(
        energyData.statsCompare,
        energyData.dailyTemperatureStatsCompare,
        true
      )
    : undefined;
  if (!main.readingCount && !compare?.readingCount) {
    return undefined;
  }
  return {
    series: compare?.readingCount
      ? [compare.series, main.series]
      : [main.series],
    degreeDays: main.degreeDays,
    compareDegreeDays: compare?.degreeDays,
    baseTemperature,
  };
}

function processTotal(
  statistics: Statistics,
  gasSources: GasSourceTypeEnergyPreference[]
) {
  return gasSources.reduce(
    (sum, source) =>
      sum +
      (source.stat_energy_from in statistics
        ? statistics[source.stat_energy_from].reduce(
            (acc, curr) => acc + (curr.change || 0),
            0
          )
        : 0),
    0
  );
}

function processDataSet(
  { states, formatEntityName, darkMode }: EnergyGasGraphDataParams,
  compareTransform: (ts: Date) => Date,
  period: ReturnType<typeof getSuggestedPeriod>,
  statistics: Statistics,
  statisticsMetaData: Record<string, StatisticsMetaData>,
  gasSources: GasChartSource[],
  computedStyles: CSSStyleDeclaration,
  trackY: (v: number) => void,
  compare = false
) {
  const data: BarSeriesOption[] = [];

  // `center` (sub-daily midpoint) and the active compare transform depend only
  // on the call-level `period`/`compare` args, so they are loop-invariant.
  // Hoist them once and inline computeStatMidpoint below, choosing the branch
  // from these two booleans, to avoid a per-point function call, a per-point
  // `center` recompute and a per-point `compare ? … : undefined` ternary in the
  // hottest loop. The arithmetic and addition order are kept identical so the
  // resulting timestamps are bit-identical to computeStatMidpoint.
  const center = period === "hour" || period === "5minute";
  const transform = compare ? compareTransform : undefined;

  gasSources.forEach((source, idx) => {
    const statId = source.stat_energy_from;
    let prevStart: number | null = null;

    const gasConsumptionData: BarSeriesOption["data"] = [];

    // Process gas consumption data.
    if (statId in statistics) {
      const stats = statistics[statId];
      for (const point of stats) {
        const change = point.change;
        if (change === null || change === undefined || change === 0) {
          continue;
        }
        const pointStart = point.start;
        if (prevStart === pointStart) {
          continue;
        }
        let midpoint: number;
        if (center) {
          midpoint = transform
            ? (transform(new Date(pointStart)).getTime() +
                transform(new Date(point.end)).getTime()) /
              2
            : (pointStart + point.end) / 2;
        } else {
          midpoint = transform
            ? transform(new Date(pointStart)).getTime()
            : pointStart;
        }
        const dataPoint: EnergyDataPoint = [midpoint, change, pointStart];
        gasConsumptionData.push(dataPoint);
        trackY(change);
        prevStart = pointStart;
      }
    }

    data.push({
      type: "bar",
      cursor: "default",
      id: compare ? "compare-" + statId : statId,
      name:
        source.name ||
        getStatisticLabel(
          states,
          formatEntityName,
          statId,
          statisticsMetaData[statId]
        ),
      barMaxWidth: 50,
      itemStyle: {
        borderColor: getEnergyColor(
          computedStyles,
          darkMode,
          false,
          compare,
          "--energy-gas-color",
          idx
        ),
      },
      color: getEnergyColor(
        computedStyles,
        darkMode,
        true,
        compare,
        "--energy-gas-color",
        idx
      ),
      data: gasConsumptionData,
      stack: compare ? "compare-gas" : "gas",
    });
  });
  return data;
}
