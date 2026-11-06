# Energy dashboard work: handoff to a local session (2026-11-05)

This folder lives on branch `claude/sleepy-clarke-yy01zk` of the fork `karmazinondrej/frontend`. That branch is
also the **merge check**: `dev` + all three frontend feature branches merged together, with this
`handoff/` folder in the last commit. Never open a PR from this branch.

## Starter prompt for the local Claude session

> Read `handoff/README.md` on branch `claude/sleepy-clarke-yy01zk` of my frontend fork (I fetched it as described
> there). The work is three frontend branches and one core branch for the Home Assistant energy dashboard, all
> pushed to my forks and ready for PRs. Help me with the "Next steps" section: refresh the branches against
> upstream `dev`, verify them locally (tests, lint, a run in the demo), retake screenshots, and walk me through
> each change so I can explain it. I open the PRs myself (AI policy); do not open PRs, issues or comments.

## Local setup

```bash
git clone https://github.com/karmazinondrej/frontend.git && cd frontend
git remote add upstream https://github.com/home-assistant/frontend.git
git fetch origin && git fetch upstream dev
git switch fix-energy-thin-bars && git switch energy-chart-granularity && git switch energy-gas-outdoor-temperature
git switch -c merge-check origin/claude/sleepy-clarke-yy01zk   # integration branch + this folder
script/bootstrap   # installs the pnpm dependencies (Node from .nvmrc)
```

```bash
git clone https://github.com/karmazinondrej/core.git && cd core
git remote add upstream https://github.com/home-assistant/core.git
git fetch origin && git fetch upstream dev
git switch energy-gas-outdoor-temperature
script/setup
```

Checks:
- frontend: `pnpm lint:types` (never with file arguments), `pnpm exec eslint <files>`, `pnpm test <paths>`.
  `pnpm lint:types` reported only the pre-existing gallery errors (missing generated `build/import-pages`) in the
  container; run `pnpm dev:gallery` once or ignore them.
- frontend demo for screenshots: `pnpm dev:demo` (port 8090). Playwright scripts that took the screenshots are in
  `handoff/scripts/` (they write next to themselves; `timezoneId` emulates a browser zone ≠ server zone).
- core: `uv run --no-sync pytest tests/components/energy -q`, then `uv run --no-sync prek run --all-files`.

## Branches

| Repo | Branch | Head | Content | Last verified |
|---|---|---|---|---|
| frontend | `fix-energy-thin-bars` | fd5b130 | Bug fix: zero-fill grid stepped in browser TZ → thin bars when browser and server zones change DST on different dates. Independent. Rebased on upstream `dev` 5cfdff0, one commit authored by karmazinondrej, no AI trailers. Replaces `energy-fill-buckets-time-zone` (38f04c5), which can be deleted. | 1873 tests green, verified in demo (UTC vs LA) |
| core | `energy-gas-outdoor-temperature` | d170106e | Gas source keys `stat_outdoor_temperature`, `heating_base_temperature` (°C, 0–30), validation + repair issue string, tests. Must merge before the frontend temperature PR. | 270 energy tests, prek green |
| frontend | `energy-gas-outdoor-temperature` | 069e4ee | Gas dialog fields; temperature line on a second y-axis (compare dashed); heating degree days from daily means (chip + tooltip); CSV rows `outdoor_temperature`, `heating_degree_days` (unit names the base). | 299 energy tests green |
| frontend | `energy-chart-granularity` | 958811a | Granularity picker (auto/hour/day/week/month/year), weeks by first weekday, partial edges fetched hourly, compare by whole buckets in server TZ, "Compare to date", solar forecast bucketing, statistics card weeks, one-month axis tick. | 1870 tests green |
| frontend | `claude/sleepy-clarke-yy01zk` | (this) | Merge check: dev + the three branches above. | 1886 tests green |

Forks' `dev` were at frontend 16ed504 / core d2106048. Upstream has moved since: rebase each feature branch on
`upstream/dev` **before** opening its PR (no PR is open yet, so rebasing is fine). After a PR is open: new commits
only, no rebase/force-push (core CLAUDE.md).

Stale remote branches in the frontend fork to delete yourself (they predate the renames):
`git push origin --delete claude/energy-gas-outdoor-temperature claude/fix-energy-fill-buckets-time-zone`.

## Submission order and rules

1. frontend `fix-energy-thin-bars` → PR to `home-assistant/frontend:dev` (Bugfix). Shorter draft: `PR-fill-fix-draft.md` style (template, own words); `pr/1-fill-buckets-time-zone.md` is the longer older version.
2. core `energy-gas-outdoor-temperature` → PR to `home-assistant/core:dev` (New feature). Text: `pr/2-gas-temperature-core.md`.
   Then frontend `energy-gas-outdoor-temperature` (New feature, link the core PR; likely labelled "waiting for upstream").
   Text: `pr/3-gas-temperature-frontend.md`. Docs PR in home-assistant.io: gas source outdoor temperature + degree days.
3. frontend `energy-chart-granularity` (New feature). Text: `pr/4-chart-granularity.md`. Docs PR: granularity, compare to date.

The `pr/*.md` files are the repos' real PR templates, filled in (template comments kept; the frontend's
"Breaking change" section removed as its template instructs, the core template kept whole as core's CLAUDE.md
requires). Exactly one type-of-change box is ticked; the checklist is left for you to tick honestly. Fill the
`<...>` placeholders with the PR links. Add screenshots for every UI PR.
AI policy (both repos): you must understand and be able to explain every change; you open the PRs and post
comments yourself. Send PR numbers to Claude afterwards to follow CI and review comments.

## Next steps (in order)

1. Rebase the four feature branches on `upstream/dev`; re-run the checks above.
2. Rebuild the merge check after the rebase. Semantic merge points (they merge without a textual conflict or
   with a trivial one, but need these edits; all done in this branch, see its two merge commits):
   - fill-fix and granularity both add `timeZone` to the gas/devices data params: keep one required
     `timeZone: string`. Solar takes `config: HassConfig` (granularity) instead of fill-fix's `timeZone`.
   - `generateFillBuckets(datasets, start, end, granularity, timeZone)` with `period: StatisticPeriod`.
   - temperature × granularity: `formatTooltipTitle` needs the year and week cases; the gas card tooltip uses the
     granularity, not `getSuggestedPeriod`; `processHeating` takes `period: EnergyGranularity`; the CSV
     hourly/day checks use `state.granularity`; temperature stats are spread **before**
     `rebucketStatistics(...)` and are not rebucketed (daily means feed week/month/year buckets).
   Whichever frontend PR lands last needs these in its rebase.
3. Retake screenshots in `pnpm dev:demo` (old ones in `screenshots/` predate the review fixes):
   weekly compare (alignment changed), gas graph with an isolated temperature reading (marker), gas dialog with
   an out-of-range base (Save disabled), one-month view with monthly granularity (single tick).
4. Optional independent review before opening: `git diff upstream/dev...HEAD --output=<name>.diff` per branch,
   review with another model (Copilot chat or `/code-review` locally).
5. Open PRs in the order above; docs PRs in home-assistant.io.

## What was done in the cloud session (for context)

- Temperature feature reviewed by three models plus an external review ("Astra"); all confirmed findings fixed:
  base range 0–30 °C (catches °F typed as °C; real bases are 12–18.3 °C), Save disabled out of range, markers
  for readings between gaps (theme sets `showSymbol: false`; verified by ECharts SSR render), CSV degree days per
  sensor+base.
- Granularity: all 8 external findings fixed: partial edge buckets fetched hourly (`planStatisticsRequests`,
  core widens day/month requests to whole buckets), compare-to-date cut-off = elapsed time since the fetched start,
  weekly compare by calendar weeks, compare shift in server TZ, solar forecasts in server TZ, granularity options
  count days by range length (DST-safe), energy-linked statistics card builds non-Monday weeks from days
  (`aggregateStatistics`), one-month axis gets one explicit tick.
- Discussion https://github.com/orgs/home-assistant/discussions/1746 (community request for heating degree days,
  unanswered, no maintainer input) is aligned with our approach and is linked from both temperature PRs. Gaps we
  deliberately leave as follow-ups: the indoor-minus-outdoor "Gradtagzahl" variant, standard presets, consumption
  per degree day (energy signature chart; declined for now), HDD as a core statistic.

## Known limitations / follow-ups

- Degree days count the partial current day as a full day.
- `getCompareTransform` still computes the day/month differences between both starts in the browser's calendar
  (pre-existing pattern); only the shifting itself runs in the server zone.
- Chart sonification: no label for the second (temperature) y-axis; separate change.
- core follow-ups: `first_weekday` for `statistics_during_period`; week/year in `energy/fossil_energy_consumption`;
  its `5minute` request is reduced to months (looks like a bug).

## Folder contents

- `pr/` – four filled PR templates.
- `screenshots/` – PNGs from the cloud session (base/fix-UTC-year-auto = before/after for the fill fix;
  gas-*, gascmp-*, gasdialog-*, gasgran-* = temperature; v-*, demo-desktop-*, d2-* = granularity).
- `scripts/` – Playwright and ECharts scripts used for the screenshots and render checks.
