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

Energy bar charts (electricity, solar, gas, water, devices detail) zero-fill sparse data with a grid of expected statistics buckets so ECharts derives a sane bar width. That grid was stepped with date-fns in the **browser** time zone, while core aligns day and month buckets to the **server** calendar.

When the browser and the server are in zones that switch DST on different dates (for example a browser in UTC and Home Assistant in Europe/Prague or America/Los_Angeles), a generated bucket lands one hour away from a real bucket. ECharts then uses that one-hour gap as the minimum data spacing and shrinks every bar in the chart to a thin line, in day and month views. Users whose browser and server share a time zone never see it.

The fix anchors the grid as a `TZDate` in the server time zone (`hass.config.time_zone`), so stepped buckets stay on the data's grid. The three pure data transforms (`energy-gas-graph-data`, `energy-solar-graph-data`, `energy-devices-detail-graph-data`) receive the time zone as a parameter, like the other environment inputs. Characterization snapshots are unchanged; two unit tests pin day and month grids across a DST change.


## Screenshots
<!--
  If your PR includes visual changes, please add screenshots or a short video
  showing the before and after. This helps reviewers understand the impact of
  your changes.
  Note: Remove this section if this PR has no visual changes.
-->

Before (browser in UTC, server in America/Los_Angeles, "This year"): all bars rendered as thin lines.
After: full-width bars.
<!-- attach base-UTC-year-auto.png and fix-UTC-year-auto.png -->

## Type of change
<!--
  What type of change does your PR introduce to the Home Assistant frontend?
  NOTE: Please, check only 1! box!
  If your PR requires multiple boxes to be checked, you'll most likely need to
  split it into multiple PRs. This makes things easier and faster to code review.
-->

- [ ] Dependency upgrade
- [x] Bugfix (non-breaking change which fixes an issue)
- [ ] New feature (thank you!)
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
