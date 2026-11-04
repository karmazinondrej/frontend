import { assert, describe, it } from "vitest";
import {
  convertCelsius,
  convertToCelsius,
  degreeDaysByBucket,
  isValidHeatingBaseTemperature,
  meanTemperatureByBucket,
  mergeBuckets,
  totalDegreeDays,
} from "../../src/data/energy-heating";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const reading = (start: number, length: number, mean: number | null) => ({
  start,
  end: start + length,
  mean,
});

describe("convertCelsius", () => {
  it("converts a Celsius base to the dashboard unit and back", () => {
    assert.equal(convertCelsius(15.5, "°C"), 15.5);
    assert.equal(convertCelsius(15.5, "°F"), 59.9);
    assert.equal(convertToCelsius(59.9, "°F"), 15.5);
    assert.equal(convertToCelsius(15.5, "°C"), 15.5);
  });
});

describe("isValidHeatingBaseTemperature", () => {
  it("accepts only the range the backend schema accepts", () => {
    assert.isTrue(isValidHeatingBaseTemperature(0));
    assert.isTrue(isValidHeatingBaseTemperature(30));
    assert.isFalse(isValidHeatingBaseTemperature(-0.01));
    assert.isFalse(isValidHeatingBaseTemperature(30.01));
    assert.isFalse(isValidHeatingBaseTemperature(NaN));
    assert.isFalse(isValidHeatingBaseTemperature(undefined));
  });
});

describe("meanTemperatureByBucket", () => {
  it("keeps the readings of a repeated bucket start", () => {
    const buckets = [
      { start: 0, end: DAY },
      { start: 0, end: DAY },
    ];
    const result = meanTemperatureByBucket([reading(0, DAY, 7)], buckets);
    assert.equal(result.get(0), 7);
  });

  it("averages the readings that start in each bucket", () => {
    const buckets = [
      { start: 0, end: DAY },
      { start: DAY, end: 2 * DAY },
      { start: 2 * DAY, end: 3 * DAY },
    ];
    const hourly = Array.from({ length: 24 }, (_, i) =>
      reading(i * HOUR, HOUR, i < 12 ? 0 : 10)
    );
    const result = meanTemperatureByBucket(
      [...hourly, reading(DAY, DAY, null), reading(2 * DAY, DAY, 7)],
      buckets
    );
    assert.equal(result.get(0), 5);
    assert.isFalse(result.has(DAY), "a bucket without a mean is left out");
    assert.equal(result.get(2 * DAY), 7);
  });
});

describe("mergeBuckets", () => {
  it("merges two sorted bucket lists by start without duplicates", () => {
    const gas = [
      { start: 0, end: DAY },
      { start: 2 * DAY, end: 3 * DAY },
    ];
    const readings = [
      { start: DAY, end: 2 * DAY },
      { start: 2 * DAY, end: 3 * DAY },
      { start: 3 * DAY, end: 4 * DAY },
    ];
    assert.deepEqual(
      mergeBuckets(gas, readings).map((bucket) => bucket.start),
      [0, DAY, 2 * DAY, 3 * DAY]
    );
    assert.deepEqual(mergeBuckets([], readings), readings);
  });
});

describe("totalDegreeDays", () => {
  it("sums all daily readings and is undefined without any", () => {
    assert.equal(
      totalDegreeDays([reading(0, DAY, 10), reading(DAY, DAY, 20)], 15),
      5
    );
    assert.isUndefined(totalDegreeDays([], 15));
  });
});

describe("degreeDaysByBucket", () => {
  it("counts how far each day stays below the base", () => {
    const buckets = [
      { start: 0, end: DAY },
      { start: DAY, end: 2 * DAY },
    ];
    const result = degreeDaysByBucket(
      [reading(0, DAY, 12), reading(DAY, DAY, 20)],
      buckets,
      15
    );
    assert.equal(result.get(0), 3);
    assert.equal(result.get(DAY), 0);
  });

  it("sums the days of a longer bucket and skips days without a mean", () => {
    const days = [
      reading(0, DAY, 10),
      reading(DAY, DAY, null),
      reading(2 * DAY, DAY, 14),
      reading(3 * DAY, DAY, 16),
    ];
    const result = degreeDaysByBucket(days, [{ start: 0, end: 4 * DAY }], 15);
    assert.equal(result.get(0), 5 + 1);
  });
});
