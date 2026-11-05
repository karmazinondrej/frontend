<!--
  You are amazing! Thanks for contributing to our project!
  Please, DO NOT DELETE ANY TEXT from this template! (unless instructed).
-->
## Proposed change
<!--
  Describe the big picture of your changes here to communicate to the
  maintainers why we should accept this pull request. If it fixes a bug
  or resolves a feature request, be sure to link to that issue or discussion
  in the additional information section.
-->

The energy dashboard picked the chart bucket size from the selected period, and every card derived it again. The period selector now offers the bucket size: automatic (default), hourly, daily, weekly, monthly or yearly. It is resolved once on the energy collection and published as `EnergyData.granularity`, so the cards, tooltips, axes and the zero-fill grid all follow it. Only the sizes that make sense for the period are offered (hourly up to 31 days, daily up to two years, and a coarse size once the period holds a whole bucket).

- **Weeks follow the profile's first weekday.** Core buckets weeks from Monday only, so weekly and yearly buckets are fetched as days or months and summed client-side in the server's time zone. Energy-linked statistics graph cards combine their weeks from days the same way when the week does not start on Monday, so they match the energy charts.
- **Totals stay inside the selection.** Core widens day and month requests to whole buckets. When a selection starts or ends inside a bucket (for example May 15 to June 15 with monthly buckets), the partial edges are requested hourly and summed into their bucket, so no consumption outside the selection is counted.
- **Comparisons line up bucket for bucket.** Compared buckets are shifted by whole weeks, months or years: weeks by the calendar weeks between both periods' first buckets, using the first weekday. The shift runs in the server's time zone, so a browser in another zone (with other DST dates) no longer puts compare bars an hour off.
- **Compare to date**, a new option next to "Compare data": a period that is still running is compared with the same elapsed part of the previous period, so both totals cover the same amount of time. The cut-off day is requested hourly so it is not widened to the whole day.
- Solar forecasts are bucketed in the server's calendar like the statistics; an axis of a single month gets one tick instead of a repeated label.
- Granularity and "Compare to date" are remembered per dashboard, like "Combine sources".

New pure module `src/data/energy-granularity.ts` (granularity options, request planning for partial edges, client-side re-bucketing) with unit tests; existing characterization snapshots only gain the `granularity` key.


## Screenshots
<!--
  If your PR includes visual changes, please add screenshots or a short video
  showing the before and after. This helps reviewers understand the impact of
  your changes.
  Note: Remove this section if this PR has no visual changes.
-->

<!-- attach v-30d-weekly-compare.png, v-year-monthly-compare.png, v-year-yearly-compare.png, demo-desktop-2-dropdown.png, compare-to-date-menu.png, v-narrow-3-submenu.png (mobile) — retake weekly compare after the alignment fix -->

## Type of change
<!--
  What type of change does your PR introduce to the Home Assistant frontend?
  NOTE: Please, check only 1! box!
  If your PR requires multiple boxes to be checked, you'll most likely need to
  split it into multiple PRs. This makes things easier and faster to code review.
-->

- [ ] Dependency upgrade
- [ ] Bugfix (non-breaking change which fixes an issue)
- [x] New feature (thank you!)
- [ ] Breaking change (fix/feature causing existing functionality to break)
- [ ] Code quality improvements to existing code or addition of tests

## Additional information
<!--
  Details are important, and help maintainers processing your PR.
  Please be sure to fill out additional details, if applicable.
-->

- This PR fixes or closes issue: fixes #
- This PR is related to issue or discussion:
- Link to [documentation][docs-repository] pull request:
- Link to [contributors documentation][contributors-repository] pull request:
- Link to backend pull request:

## Checklist
<!--
  Put an `x` in the boxes that apply. You can also fill these out after
  creating the PR. If you're unsure about any of them, don't hesitate to ask.
  We're here to help! This is simply a reminder of what we are going to look
  for before merging your code.

  AI tools are welcome, but contributors are responsible for *fully*
  understanding the code before submitting a PR. Please follow our AI policy:
  https://contributors.home-assistant.io/start/ai-policy/
-->

- [ ] I understand the code I am submitting and can explain how it works.
- [ ] The code change is tested and works locally.
- [ ] There is no commented out code in this PR.
- [ ] I have followed the [perfect PR recommendations][perfect-pr]
- [ ] Any generated code has been carefully reviewed for correctness and compliance with project standards.

If user exposed functionality or configuration variables are added/changed:

- [ ] Documentation added/updated for [www.home-assistant.io][docs-repository]

<!--
  This project is very active and we have a high turnover of pull requests.

  Unfortunately, the number of incoming pull requests is higher than what our
  reviewers can review and merge so there is a long backlog of pull requests
  waiting for review. You can help here!

  By reviewing another pull request, you will help raise the code quality of
  that pull request and the final review will be faster. This way the general
  pace of pull request reviews will go up and your wait time will go down.

  When picking a pull request to review, try to choose one that hasn't yet
  been reviewed.

  Thanks for helping out!
-->

To help with the load of incoming pull requests:

- [ ] I have reviewed two other [open pull requests][prs] in this repository.

[prs]: https://github.com/home-assistant/frontend/pulls?q=is%3Aopen+is%3Apr+-author%3A%40me+-draft%3Atrue+sort%3Acreated-desc+review%3Anone+-status%3Afailure

<!--
  Thank you for contributing <3

  Below, some useful links you could explore:
-->
[docs-repository]: https://github.com/home-assistant/home-assistant.io
[contributors-repository]: https://github.com/home-assistant/contributors.home-assistant.io
[perfect-pr]: https://contributors.home-assistant.io/start/pull-requests/#before-you-open-it

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01KSmQc7Hiy9Co5Sy7dh3yaE
