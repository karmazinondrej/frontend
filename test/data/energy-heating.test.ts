import { assert, describe, it } from "vitest";
import {
  convertCelsius,
  convertToCelsius,
  degreeDaysByBucket,
  meanTemperatureByBucket,
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

describe("meanTemperatureByBucket", () => {
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
