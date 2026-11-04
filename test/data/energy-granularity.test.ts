import type { HassConfig } from "home-assistant-js-websocket";
import { assert, describe, it } from "vitest";
import {
  aggregateStatistics,
  getEnergyGranularityOptions,
  joinStatisticsRequests,
  planStatisticsRequests,
  rebucketFossilEnergyConsumption,
  rebucketStatistics,
  resolveEnergyGranularity,
} from "../../src/data/energy-granularity";

// Sofia is UTC+3 in September; buckets from core start at local midnight.
const config = { time_zone: "Europe/Sofia" } as HassConfig;
const day = (date: string) => new Date(`${date}T00:00:00+03:00`).getTime();
const dayBucket = (date: string, change: number) => {
  const start = day(date);
  return { start, end: start + 24 * 60 * 60 * 1000, change };
};

describe("getEnergyGranularityOptions", () => {
  const options = (days: number) =>
    getEnergyGranularityOptions(
      new Date(2026, 8, 1),
      new Date(2026, 8, days, 23, 59, 59, 999)
    );

  it("offers only fine buckets for short periods", () => {
    assert.deepEqual(options(1), ["hour", "day"]);
    assert.deepEqual(options(6), ["hour", "day"]);
  });

  it("offers a coarse bucket once the period holds a whole one", () => {
    assert.deepEqual(options(7), ["hour", "day", "week"]);
    assert.deepEqual(options(28), ["hour", "day", "week", "month"]);
  });

  it("drops fine buckets for long periods", () => {
    assert.deepEqual(
      getEnergyGranularityOptions(
        new Date(2026, 0, 1),
        new Date(2026, 11, 31, 23, 59, 59, 999)
      ),
      ["day", "week", "month", "year"]
    );
    assert.deepEqual(
      getEnergyGranularityOptions(
        new Date(2024, 0, 1),
        new Date(2026, 11, 31, 23, 59, 59, 999)
      ),
      ["week", "month", "year"]
    );
  });

  it("counts server days whose range spans a DST change", () => {
    // October 2026 in Berlin is 31 days and one hour, seen from UTC.
    assert.include(
      getEnergyGranularityOptions(
        new Date("2026-09-30T22:00:00Z"),
        new Date("2026-10-31T22:59:59.999Z")
      ),
      "hour"
    );
  });

  it("treats an open end as ending now", () => {
    assert.deepEqual(
      getEnergyGranularityOptions(new Date(Date.now() - 60 * 60 * 1000)),
      ["hour", "day"]
    );
  });
});

describe("resolveEnergyGranularity", () => {
  const start = new Date(2026, 8, 1);
  const end = new Date(2026, 8, 30, 23, 59, 59, 999);

  it("keeps a picked bucket size that fits the period", () => {
    assert.equal(resolveEnergyGranularity("week", "day", start, end), "week");
  });

  it("falls back to the automatic bucket size otherwise", () => {
    assert.equal(resolveEnergyGranularity("year", "day", start, end), "day");
    assert.equal(resolveEnergyGranularity(undefined, "day", start, end), "day");
  });
});

describe("rebucketStatistics", () => {
  // 2026-09-13 is a Sunday.
  const statistics = {
    "sensor.energy": [
      dayBucket("2026-09-13", 1),
      dayBucket("2026-09-14", 2),
      dayBucket("2026-09-15", 4),
      dayBucket("2026-09-21", 8),
    ],
  };

  it("sums days into weeks starting on the first weekday", () => {
    assert.deepEqual(rebucketStatistics(statistics, "week", config, 1), {
      "sensor.energy": [
        { start: day("2026-09-07"), end: day("2026-09-14"), change: 1 },
        { start: day("2026-09-14"), end: day("2026-09-21"), change: 6 },
        { start: day("2026-09-21"), end: day("2026-09-28"), change: 8 },
      ],
    });
    assert.deepEqual(rebucketStatistics(statistics, "week", config, 0), {
      "sensor.energy": [
        { start: day("2026-09-13"), end: day("2026-09-20"), change: 7 },
        { start: day("2026-09-20"), end: day("2026-09-27"), change: 8 },
      ],
    });
  });

  it("sums months into years in the server time zone", () => {
    const month = (date: string, change: number) => ({
      start: new Date(`${date}T00:00:00+02:00`).getTime(),
      end: 0,
      change,
    });
    assert.deepEqual(
      rebucketStatistics(
        {
          "sensor.energy": [
            month("2025-11-01", 1),
            month("2025-12-01", 2),
            month("2026-01-01", 4),
          ],
        },
        "year",
        config,
        1
      ),
      {
        "sensor.energy": [
          {
            start: new Date("2025-01-01T00:00:00+02:00").getTime(),
            end: new Date("2026-01-01T00:00:00+02:00").getTime(),
            change: 3,
          },
          {
            start: new Date("2026-01-01T00:00:00+02:00").getTime(),
            end: new Date("2027-01-01T00:00:00+02:00").getTime(),
            change: 4,
          },
        ],
      }
    );
  });

  it("counts a missing change as zero", () => {
    assert.deepEqual(
      rebucketStatistics(
        { "sensor.energy": [{ ...dayBucket("2026-09-14", 0), change: null }] },
        "week",
        config,
        1
      ),
      {
        "sensor.energy": [
          { start: day("2026-09-14"), end: day("2026-09-21"), change: 0 },
        ],
      }
    );
  });
});

describe("rebucketFossilEnergyConsumption", () => {
  it("sums days into weeks keyed by the week start", () => {
    assert.deepEqual(
      rebucketFossilEnergyConsumption(
        {
          "2026-09-13T00:00:00+03:00": 1,
          "2026-09-14T00:00:00+03:00": 2,
          "2026-09-15T00:00:00+03:00": 4,
        },
        "week",
        config,
        1
      ),
      {
        [new Date(day("2026-09-07")).toISOString()]: 1,
        [new Date(day("2026-09-14")).toISOString()]: 6,
      }
    );
  });
});

describe("planStatisticsRequests", () => {
  const at = (iso: string) => new Date(iso);
  const plan = (
    start: string,
    end: string | undefined,
    period: "day" | "month"
  ) =>
    planStatisticsRequests(
      at(start),
      end === undefined ? undefined : at(end),
      period,
      config
    ).map((request) => [
      request.period,
      request.start.toISOString(),
      request.end?.toISOString(),
    ]);

  it("requests whole buckets as they are", () => {
    assert.deepEqual(
      plan("2026-08-31T21:00:00Z", "2026-09-30T20:59:59.999Z", "day"),
      [["day", "2026-08-31T21:00:00.000Z", "2026-09-30T20:59:59.999Z"]]
    );
  });

  it("requests the partial months at the edges hourly", () => {
    // Apr 15 to Jun 15 in Sofia (UTC+3)
    assert.deepEqual(
      plan("2026-04-14T21:00:00Z", "2026-06-15T20:59:59.999Z", "month"),
      [
        ["hour", "2026-04-14T21:00:00.000Z", "2026-04-30T21:00:00.000Z"],
        ["month", "2026-04-30T21:00:00.000Z", "2026-05-31T20:59:59.999Z"],
        ["hour", "2026-05-31T21:00:00.000Z", "2026-06-15T20:59:59.999Z"],
      ]
    );
  });

  it("requests a range within one bucket hourly", () => {
    assert.deepEqual(
      plan("2026-05-14T21:00:00Z", "2026-06-15T20:59:59.999Z", "month"),
      [["hour", "2026-05-14T21:00:00.000Z", "2026-06-15T20:59:59.999Z"]]
    );
  });

  it("cuts a range off inside a day", () => {
    assert.deepEqual(
      plan("2026-07-31T21:00:00Z", "2026-08-28T12:00:00Z", "day"),
      [
        ["day", "2026-07-31T21:00:00.000Z", "2026-08-27T20:59:59.999Z"],
        ["hour", "2026-08-27T21:00:00.000Z", "2026-08-28T12:00:00.000Z"],
      ]
    );
  });

  it("keeps an open end open", () => {
    assert.deepEqual(plan("2026-08-14T21:00:00Z", undefined, "month"), [
      ["hour", "2026-08-14T21:00:00.000Z", "2026-08-31T21:00:00.000Z"],
      ["month", "2026-08-31T21:00:00.000Z", undefined],
    ]);
  });
});

describe("joinStatisticsRequests", () => {
  it("sums hourly edges into the buckets of the period", () => {
    const hour = 60 * 60 * 1000;
    const hourly = (from: number, count: number) =>
      Array.from({ length: count }, (_, i) => ({
        start: from + i * hour,
        end: from + (i + 1) * hour,
        change: 1,
      }));
    const requests = planStatisticsRequests(
      new Date("2026-08-31T21:00:00Z"),
      new Date("2026-09-03T12:00:00Z"),
      "day",
      config
    );
    const joined = joinStatisticsRequests(
      requests,
      [
        { "sensor.energy": [dayBucket("2026-09-01", 24)] },
        { "sensor.energy": hourly(day("2026-09-03"), 15) },
      ],
      "day",
      config
    );
    assert.deepEqual(joined, {
      "sensor.energy": [
        dayBucket("2026-09-01", 24),
        dayBucket("2026-09-03", 15),
      ],
    });
  });
});

describe("aggregateStatistics", () => {
  it("combines each statistic type into Sunday-first weeks", () => {
    // Sat Sep 12, Sun Sep 13 and Mon Sep 14 in Sofia.
    const values = [
      { mean: 10, min: 5, max: 15, state: 1, sum: 1, change: 1 },
      { mean: 20, min: 2, max: 30, state: 2, sum: 3, change: 2 },
      { mean: 30, min: 4, max: 40, state: 3, sum: 6, change: 3 },
    ].map((value, i) => ({
      ...dayBucket(["2026-09-12", "2026-09-13", "2026-09-14"][i], 0),
      ...value,
    }));
    assert.deepEqual(
      aggregateStatistics({ "sensor.x": values }, "week", config, 0),
      {
        "sensor.x": [
          {
            start: day("2026-09-06"),
            end: day("2026-09-13"),
            mean: 10,
            min: 5,
            max: 15,
            state: 1,
            sum: 1,
            change: 1,
          },
          {
            start: day("2026-09-13"),
            end: day("2026-09-20"),
            mean: 25,
            min: 2,
            max: 40,
            state: 3,
            sum: 6,
            change: 5,
          },
        ],
      }
    );
  });
});
