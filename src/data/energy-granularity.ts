import { TZDate } from "@date-fns/tz";
import {
  addWeeks,
  addYears,
  differenceInDays,
  startOfWeek,
  startOfYear,
} from "date-fns";
import type { HassConfig } from "home-assistant-js-websocket";
import type { WeekdayIndex } from "../common/datetime/weekday";
import type { FossilEnergyConsumption } from "./energy";
import type { StatisticPeriod, Statistics } from "./recorder";

/** Bucket size of the energy dashboard charts. */
export type EnergyGranularity = "hour" | "day" | "week" | "month" | "year";

export const ENERGY_GRANULARITIES: EnergyGranularity[] = [
  "hour",
  "day",
  "week",
  "month",
  "year",
];

/** The periods core can bucket both statistics and fossil consumption in. */
export type EnergyFetchPeriod = Extract<
  StatisticPeriod,
  "hour" | "day" | "month"
>;

// Core only buckets weeks from Monday and fossil consumption only up to
// months, so those are fetched finer and summed into buckets client-side.
const FETCH_PERIOD: Record<EnergyGranularity, EnergyFetchPeriod> = {
  hour: "hour",
  day: "day",
  week: "day",
  month: "month",
  year: "month",
};

// Upper bounds keep the bar count sane; lower bounds require at least one
// whole bucket, so a coarse bucket never represents a sliver of the range.
const MAX_HOURLY_DAYS = 31;
const MAX_DAILY_DAYS = 2 * 366;
const MIN_DAYS: Partial<Record<EnergyGranularity, number>> = {
  week: 7,
  month: 28,
  year: 365,
};

export const getEnergyFetchPeriod = (
  granularity: EnergyGranularity
): EnergyFetchPeriod => FETCH_PERIOD[granularity];

/** The granularities that make sense for a period, in display order. */
export const getEnergyGranularityOptions = (
  start: Date,
  end?: Date
): EnergyGranularity[] => {
  const days = differenceInDays(end || new Date(), start) + 1;
  return ENERGY_GRANULARITIES.filter((granularity) => {
    if (granularity === "hour") {
      return days <= MAX_HOURLY_DAYS;
    }
    if (granularity === "day") {
      return days <= MAX_DAILY_DAYS;
    }
    return days >= MIN_DAYS[granularity]!;
  });
};

/**
 * The bucket size the dashboard shows for a period: the picked granularity
 * while it fits the period, otherwise the automatic one.
 */
export const resolveEnergyGranularity = (
  preferred: EnergyGranularity | undefined,
  automatic: EnergyGranularity,
  start: Date,
  end?: Date
): EnergyGranularity =>
  preferred && getEnergyGranularityOptions(start, end).includes(preferred)
    ? preferred
    : automatic;

type ClientGranularity = "week" | "year";

const needsRebucketing = (
  granularity: EnergyGranularity
): granularity is ClientGranularity =>
  FETCH_PERIOD[granularity] !== granularity;

/**
 * Start and end of the week or year that contains a fetched bucket. Fetched
 * buckets are aligned to the server's calendar, so the coarser bucket is too.
 */
const getBucketRange = (
  startMs: number,
  granularity: ClientGranularity,
  config: HassConfig,
  weekStartsOn: WeekdayIndex
): [number, number] => {
  const zoned = new TZDate(startMs, config.time_zone);
  // TZDate is invalid where Intl lacks "longOffset" (Chrome < 95, Safari < 15.4)
  const date = Number.isNaN(zoned.getTime()) ? new Date(startMs) : zoned;
  const bucketStart =
    granularity === "week"
      ? startOfWeek(date, { weekStartsOn })
      : startOfYear(date);
  const bucketEnd =
    granularity === "week"
      ? addWeeks(bucketStart, 1)
      : addYears(bucketStart, 1);
  return [bucketStart.getTime(), bucketEnd.getTime()];
};

/**
 * Sums the `change` of fetched buckets into the granularity when core cannot
 * bucket it. Fetched buckets are sorted by start, so each coarse bucket is one
 * run of consecutive values.
 */
export const rebucketStatistics = (
  statistics: Statistics,
  granularity: EnergyGranularity,
  config: HassConfig,
  weekStartsOn: WeekdayIndex
): Statistics => {
  if (!needsRebucketing(granularity)) {
    return statistics;
  }
  const result: Statistics = {};
  for (const [statisticId, values] of Object.entries(statistics)) {
    const buckets: Statistics[string] = [];
    let current: Statistics[string][number] | undefined;
    for (const value of values) {
      if (!current || value.start >= current.end) {
        const [start, end] = getBucketRange(
          value.start,
          granularity,
          config,
          weekStartsOn
        );
        current = { start, end, change: 0 };
        buckets.push(current);
      }
      current.change! += value.change ?? 0;
    }
    result[statisticId] = buckets;
  }
  return result;
};

/** Like `rebucketStatistics` for fossil energy, keyed by ISO time like core. */
export const rebucketFossilEnergyConsumption = (
  consumption: FossilEnergyConsumption,
  granularity: EnergyGranularity,
  config: HassConfig,
  weekStartsOn: WeekdayIndex
): FossilEnergyConsumption => {
  if (!needsRebucketing(granularity)) {
    return consumption;
  }
  const result: FossilEnergyConsumption = {};
  for (const [time, value] of Object.entries(consumption)) {
    const [start] = getBucketRange(
      new Date(time).getTime(),
      granularity,
      config,
      weekStartsOn
    );
    const key = new Date(start).toISOString();
    result[key] = (result[key] ?? 0) + value;
  }
  return result;
};
