import type { StatisticValue } from "./recorder";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Below 15.5 °C most homes start heating; a common degree day base. */
export const DEFAULT_HEATING_BASE_TEMPERATURE = 15.5;

/** A base temperature stored in °C in the unit the dashboard shows. */
export const convertCelsius = (celsius: number, unit: string): number =>
  unit === "°F" ? (celsius * 9) / 5 + 32 : celsius;

/** A temperature in the dashboard's unit back to °C for storing. */
export const convertToCelsius = (value: number, unit: string): number =>
  unit === "°F" ? ((value - 32) * 5) / 9 : value;

export interface HeatingBucket {
  /** Mean outdoor temperature of the readings in the bucket, if any. */
  temperature?: number;
  /** How far, in degree days, the temperature stayed below the base. */
  degreeDays: number;
}

/**
 * Folds outdoor temperature readings into consumption buckets. Readings and
 * buckets are both sorted by start, and a reading belongs to the bucket its
 * start falls in. Degree days are weighted by how long a reading lasts, so
 * hourly and daily readings add up the same.
 */
export const computeHeatingBuckets = (
  readings: StatisticValue[],
  buckets: Pick<StatisticValue, "start" | "end">[],
  baseTemperature: number
): Map<number, HeatingBucket> => {
  const result = new Map<number, HeatingBucket>();
  let index = 0;
  for (const bucket of buckets) {
    while (index < readings.length && readings[index].start < bucket.start) {
      index++;
    }
    let sum = 0;
    let count = 0;
    let degreeDays = 0;
    for (
      ;
      index < readings.length && readings[index].start < bucket.end;
      index++
    ) {
      const { mean, start, end } = readings[index];
      if (mean === null || mean === undefined) {
        continue;
      }
      sum += mean;
      count++;
      degreeDays +=
        (Math.max(0, baseTemperature - mean) * (end - start)) / DAY_MS;
    }
    result.set(bucket.start, {
      temperature: count ? sum / count : undefined,
      degreeDays,
    });
  }
  return result;
};
