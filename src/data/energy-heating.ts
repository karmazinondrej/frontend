import type { StatisticValue } from "./recorder";

/** Below 15.5 °C most homes start heating; a common degree day base. */
export const DEFAULT_HEATING_BASE_TEMPERATURE = 15.5;

/** A base temperature stored in °C in the unit the dashboard shows. */
export const convertCelsius = (celsius: number, unit: string): number =>
  unit === "°F" ? (celsius * 9) / 5 + 32 : celsius;

/** A temperature in the dashboard's unit back to °C for storing. */
export const convertToCelsius = (value: number, unit: string): number =>
  unit === "°F" ? ((value - 32) * 5) / 9 : value;

type Bucket = Pick<StatisticValue, "start" | "end">;

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

/**
 * Heating degree days per bucket: how far each day's mean temperature stayed
 * below the base, summed over the days in the bucket. Days are the unit of
 * degree days, so `dailyReadings` must be daily means.
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
        (sum, { mean }) =>
          mean === null || mean === undefined
            ? sum
            : sum + Math.max(0, baseTemperature - mean),
        0
      )
    );
  }
  return result;
};
