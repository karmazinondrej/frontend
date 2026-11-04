import { TZDate } from "@date-fns/tz";
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  startOfDay,
  startOfHour,
  startOfMonth,
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
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
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
  // Counted from the length of the range rather than the browser's calendar,
  // where a range of server days can span an extra day around DST changes.
  // The tolerance absorbs the hour a DST change adds or removes.
  const length = (end ? end.getTime() + 1 : Date.now()) - start.getTime();
  const days = Math.max(1, Math.ceil((length - 2 * HOUR_MS) / DAY_MS));
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

type CalendarBucket = Exclude<EnergyGranularity, "hour">;

/** A time as a date in the server's time zone, where core aligns buckets. */
const toServerDate = (ms: number, timeZone: string): Date => {
  const zoned = new TZDate(ms, timeZone);
  // TZDate is invalid where Intl lacks "longOffset" (Chrome < 95, Safari < 15.4)
  return Number.isNaN(zoned.getTime()) ? new Date(ms) : zoned;
};

/** Start and end of the calendar bucket that contains a time. */
const getBucketRange = (
  startMs: number,
  granularity: CalendarBucket,
  config: HassConfig,
  weekStartsOn: WeekdayIndex
): [number, number] => {
  const date = toServerDate(startMs, config.time_zone);
  switch (granularity) {
    case "day": {
      const bucketStart = startOfDay(date);
      return [bucketStart.getTime(), addDays(bucketStart, 1).getTime()];
    }
    case "week": {
      const bucketStart = startOfWeek(date, { weekStartsOn });
      return [bucketStart.getTime(), addWeeks(bucketStart, 1).getTime()];
    }
    case "month": {
      const bucketStart = startOfMonth(date);
      return [bucketStart.getTime(), addMonths(bucketStart, 1).getTime()];
    }
    default: {
      const bucketStart = startOfYear(date);
      return [bucketStart.getTime(), addYears(bucketStart, 1).getTime()];
    }
  }
};

/** Start of the chart bucket that contains a time, as core aligns it. */
export const getBucketStart = (
  ms: number,
  granularity: EnergyGranularity,
  config: HassConfig,
  weekStartsOn: WeekdayIndex
): number =>
  granularity === "hour"
    ? startOfHour(toServerDate(ms, config.time_zone)).getTime()
    : getBucketRange(ms, granularity, config, weekStartsOn)[0];

/** Sums the `change` of sorted buckets into the calendar buckets they fall in. */
const sumIntoBuckets = (
  statistics: Statistics,
  granularity: CalendarBucket,
  config: HassConfig,
  weekStartsOn: WeekdayIndex
): Statistics => {
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

/** One `recorder/statistics_during_period` request. */
export interface StatisticsRequest {
  start: Date;
  end?: Date;
  period: EnergyFetchPeriod;
}

/**
 * The requests that return the buckets of a range and nothing outside it.
 * Core widens day and month requests to whole buckets, so an edge of the
 * range that falls inside a bucket is requested hourly instead. Ranges end on
 * the last millisecond of their final bucket, as the period selector sets
 * them.
 */
export const planStatisticsRequests = (
  start: Date,
  end: Date | undefined,
  period: EnergyFetchPeriod,
  config: HassConfig
): StatisticsRequest[] => {
  if (period === "hour") {
    return [{ start, end, period }];
  }
  const startMs = start.getTime();
  const [firstStart, firstEnd] = getBucketRange(startMs, period, config, 1);
  const innerStart = firstStart === startMs ? startMs : firstEnd;
  let innerEnd: number | undefined;
  let partialEnd = false;
  if (end) {
    const endMs = end.getTime();
    const [lastStart, lastEnd] = getBucketRange(endMs, period, config, 1);
    partialEnd = lastEnd - endMs > 1;
    innerEnd = partialEnd ? lastStart : lastEnd;
  }
  if (innerEnd !== undefined && innerStart >= innerEnd) {
    return [{ start, end, period: "hour" }];
  }
  const requests: StatisticsRequest[] = [];
  if (innerStart > startMs) {
    requests.push({ start, end: new Date(innerStart), period: "hour" });
  }
  requests.push({
    start: new Date(innerStart),
    // Core takes the end as inclusive and widens it to its bucket's end.
    end: innerEnd === undefined ? undefined : new Date(innerEnd - 1),
    period,
  });
  if (partialEnd) {
    requests.push({ start: new Date(innerEnd!), end, period: "hour" });
  }
  return requests;
};

/** The statistics of planned requests joined into buckets of `period`. */
export const joinStatisticsRequests = (
  requests: StatisticsRequest[],
  results: Statistics[],
  period: EnergyFetchPeriod,
  config: HassConfig
): Statistics => {
  if (requests.length === 1 && requests[0].period === period) {
    return results[0];
  }
  const joined: Statistics = {};
  results.forEach((result, i) => {
    const buckets =
      requests[i].period === period || period === "hour"
        ? result
        : sumIntoBuckets(result, period, config, 1);
    for (const [statisticId, values] of Object.entries(buckets)) {
      (joined[statisticId] ??= []).push(...values);
    }
  });
  return joined;
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
): Statistics =>
  needsRebucketing(granularity)
    ? sumIntoBuckets(statistics, granularity, config, weekStartsOn)
    : statistics;

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
