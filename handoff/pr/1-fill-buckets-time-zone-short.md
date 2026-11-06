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

When the browser and the Home Assistant server are in different time zones that switch DST on different dates, the bars in the energy charts (e.g. "This year" or a month) are drawn as thin lines.

The charts fill missing buckets with zeros. These fill buckets were generated in the browser time zone, but the statistics from core are aligned to the server time zone. After one of the zones switches DST, the generated buckets are one hour off the real ones, and ECharts uses that one-hour gap as the bar width.

This generates the fill buckets in the server time zone (`hass.config.time_zone`), like the statistics. Added tests for day and month buckets across a DST change.

To reproduce: server in America/Los_Angeles, browser in UTC (e.g. Chrome DevTools > Sensors > Location), energy dashboard > This year.


## Screenshots
<!--
  If your PR includes visual changes, please add screenshots or a short video
  showing the before and after. This helps reviewers understand the impact of
  your changes.
  Note: Remove this section if this PR has no visual changes.
-->

Before / after (browser UTC, server America/Los_Angeles, This year):
<!-- drop base-UTC-year-auto.png and fix-UTC-year-auto.png here -->

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
