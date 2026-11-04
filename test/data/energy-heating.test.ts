import { assert, describe, it } from "vitest";
import {
  computeHeatingBuckets,
  convertCelsius,
  convertToCelsius,
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

describe("computeHeatingBuckets", () => {
  it("averages readings per bucket and counts degree days below the base", () => {
    const buckets = [
      { start: 0, end: DAY },
      { start: DAY, end: 2 * DAY },
    ];
    const readings = [reading(0, DAY, 5), reading(DAY, DAY, 20)];
    const result = computeHeatingBuckets(readings, buckets, 15);
    assert.deepEqual(result.get(0), { temperature: 5, degreeDays: 10 });
    assert.deepEqual(result.get(DAY), { temperature: 20, degreeDays: 0 });
  });

  it("weights hourly readings so a day of hours equals one daily reading", () => {
    const buckets = [{ start: 0, end: DAY }];
    const hourly = Array.from({ length: 24 }, (_, i) =>
      reading(i * HOUR, HOUR, i < 12 ? 0 : 10)
    );
    const result = computeHeatingBuckets(hourly, buckets, 15)!.get(0)!;
    assert.equal(result.temperature, 5);
    assert.closeTo(result.degreeDays, 10, 1e-9);
  });

  it("sums several daily readings into a longer bucket", () => {
    const buckets = [{ start: 0, end: 3 * DAY }];
    const readings = [
      reading(0, DAY, 10),
      reading(DAY, DAY, 12),
      reading(2 * DAY, DAY, 14),
    ];
    const result = computeHeatingBuckets(readings, buckets, 15).get(0)!;
    assert.equal(result.temperature, 12);
    assert.equal(result.degreeDays, 5 + 3 + 1);
  });

  it("skips readings without a mean and buckets without readings", () => {
    const buckets = [
      { start: 0, end: DAY },
      { start: DAY, end: 2 * DAY },
    ];
    const readings = [reading(0, DAY, null), reading(2 * DAY, DAY, 1)];
    const result = computeHeatingBuckets(readings, buckets, 15);
    assert.deepEqual(result.get(0), { temperature: undefined, degreeDays: 0 });
    assert.deepEqual(result.get(DAY), {
      temperature: undefined,
      degreeDays: 0,
    });
  });
});
