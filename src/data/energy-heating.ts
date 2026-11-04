import type { StatisticValue } from "./recorder";

/** Below 15.5 °C most homes start heating; a common degree day base. */
export const DEFAULT_HEATING_BASE_TEMPERATURE = 15.5;

/** Bounds of the base in °C, as the backend schema enforces them. */
export const MIN_HEATING_BASE_TEMPERATURE = 0;
export const MAX_HEATING_BASE_TEMPERATURE = 30;

/** Whether a stored base (°C) is one the backend accepts. */
export const isValidHeatingBaseTemperature = (celsius: unknown): boolean =>
  typeof celsius === "number" &&
  Number.isFinite(celsius) &&
  celsius >= MIN_HEATING_BASE_TEMPERATURE &&
  celsius <= MAX_HEATING_BASE_TEMPERATURE;

/** A base temperature stored in °C in the unit the dashboard shows. */
export const convertCelsius = (celsius: number, unit: string): number =>
  unit === "°F" ? (celsius * 9) / 5 + 32 : celsius;

/** A temperature in the dashboard's unit back to °C for storing. */
export const convertToCelsius = (value: number, unit: string): number =>
  unit === "°F" ? ((value - 32) * 5) / 9 : value;

type Bucket = Pick<StatisticValue, "start" | "end">;

/** The buckets of two sorted series merged by start, without duplicates. */
export const mergeBuckets = (first: Bucket[], second: Bucket[]): Bucket[] => {
  const merged: Bucket[] = [];
  let i = 0;
  let j = 0;
  while (i < first.length || j < second.length) {
    const next =
      j >= second.length ||
      (i < first.length && first[i].start <= second[j].start)
        ? first[i++]
        : second[j++];
    if (!merged.length || merged[merged.length - 1].start !== next.start) {
      merged.push({ start: next.start, end: next.end });
    }
  }
  return merged;
};

/**
 * Groups readings by the bucket their start falls in. Readings and buckets
 * are both sorted by start, so this is a single sweep.
 */
const groupByBucket = (
  readings: StatisticValue[],
  buckets: Bucket[]
): Map<number, StatisticValue[]> => {
  const groups = new Map<number, StatisticValue[]>();
  let index = 0;
  for (const bucket of buckets) {
    // A repeated bucket keeps the readings of its first occurrence.
    if (groups.has(bucket.start)) {
      continue;
    }
    while (index < readings.length && readings[index].start < bucket.start) {
      index++;
    }
    const group: StatisticValue[] = [];
    for (
      ;
      index < readings.length && readings[index].start < bucket.end;
      index++
    ) {
      group.push(readings[index]);
    }
    groups.set(bucket.start, group);
  }
  return groups;
};

/** Mean temperature per bucket; buckets without readings are left out. */
export const meanTemperatureByBucket = (
  readings: StatisticValue[],
  buckets: Bucket[]
): Map<number, number> => {
  const result = new Map<number, number>();
  for (const [start, group] of groupByBucket(readings, buckets)) {
    const means = group
      .map((reading) => reading.mean)
      .filter((mean): mean is number => mean !== null && mean !== undefined);
    if (means.length) {
      result.set(
        start,
        means.reduce((sum, mean) => sum + mean, 0) / means.length
      );
    }
  }
  return result;
};

/** Heating degree days of one daily mean; a missing mean counts nothing. */
const degreeDaysOfDay = (
  mean: number | null | undefined,
  baseTemperature: number
): number =>
  mean === null || mean === undefined ? 0 : Math.max(0, baseTemperature - mean);

/**
 * Heating degree days of a period: how far each day's mean temperature stayed
 * below the base, summed over all daily readings. `undefined` without any
 * reading, so a missing sensor is not mistaken for a warm period.
 */
export const totalDegreeDays = (
  dailyReadings: StatisticValue[],
  baseTemperature: number
): number | undefined =>
  dailyReadings.length
    ? dailyReadings.reduce(
        (sum, { mean }) => sum + degreeDaysOfDay(mean, baseTemperature),
        0
      )
    : undefined;

/**
 * Heating degree days per bucket, summed over the days in the bucket. Days
 * are the unit of degree days, so `dailyReadings` must be daily means.
 */
export const degreeDaysByBucket = (
  dailyReadings: StatisticValue[],
  buckets: Bucket[],
  baseTemperature: number
): Map<number, number> => {
  const result = new Map<number, number>();
  for (const [start, group] of groupByBucket(dailyReadings, buckets)) {
    result.set(
      start,
      group.reduce(
        (sum, { mean }) => sum + degreeDaysOfDay(mean, baseTemperature),
        0
      )
    );
  }
  return result;
};
