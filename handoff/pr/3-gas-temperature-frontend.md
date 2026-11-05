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

Lets a gas source reference an **outdoor temperature** statistic and a **heating base temperature**, so gas consumption can be judged against the weather.

- **Gas settings dialog**: an optional outdoor temperature picker (mean statistics with the temperature unit class) and, once one is picked, a required heating base temperature. The base is edited in the dashboard's temperature unit and stored in °C (default 15.5 °C, 0–30 °C as the backend accepts; Save stays disabled outside that range).
- **Energy collection**: fetches the temperature statistics in the dashboard's unit: daily means for the degree days, plus hourly means for the line at the hourly zoom. With a comparison on, the compared period is fetched the same way.
- **Gas graph card**: draws the temperature as a line on a second y-axis (the compared period as a dashed line shifted onto the main axis, like the compare bars; a reading between two gaps gets a marker, as the chart theme hides line symbols), adds each period's outdoor temperature and heating degree days to its section of the tooltip, and shows the period's heating degree days as a chip, with the gas used per degree day and the compared period's degree days in the chip's tooltip.
- **Data download**: the CSV gains an `outdoor_temperature` row (mean per gas bucket) and, for daily and coarser buckets, a `heating_degree_days` row whose unit names the base used (e.g. `degree days (base 15.5 °C)`), so a spreadsheet can set consumption against the weather and the numbers stay reproducible. Gas sources sharing one outdoor sensor with different bases get one degree day row per base.
- New pure module `src/data/energy-heating.ts` with the bucketing of temperature means and degree days and the unit conversions, covered by unit tests; the gas graph transform has a new characterization case for the temperature series. Existing snapshots are unchanged.

Heating degree days are a daily quantity: for each day `max(0, base − daily mean)`, summed over the days of a bucket. This is the single-base definition of EN ISO 15927-6 and ASHRAE (base 15.5 °C or 65 °F); the German/Austrian indoor-minus-outdoor variant (Gradtagzahl) and consumption normalized per degree day are left for a follow-up. They are always derived from daily means so the same day shows the same value at every zoom; hourly buckets show the temperature only, and the chip holds the period total.


## Screenshots
<!--
  If your PR includes visual changes, please add screenshots or a short video
  showing the before and after. This helps reviewers understand the impact of
  your changes.
  Note: Remove this section if this PR has no visual changes.
-->

<!-- attach gas-4-tooltip.png, gas-5-year.png, gasdialog-3-edited.png (retake after the review fixes if markers or the dialog changed visibly) -->

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
- This PR is related to issue or discussion: https://github.com/orgs/home-assistant/discussions/1746
- Link to [documentation][docs-repository] pull request:
- Link to [contributors documentation][contributors-repository] pull request:
- Link to backend pull request: <core PR adding stat_outdoor_temperature and heating_base_temperature to gas sources>

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
