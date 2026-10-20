# Procore sandbox hand-off

On 19 October 2026, an accepted Safe Edge finding became a Procore Observation with its photo in the Procore Developer Sandbox, through the dev API and Procore's upload flow. S1 was played over HTTP with the dev tokens up to the manager's submit, and the API filed Observation 371386 in sandbox project 374160 with the crew's photo attached, byte for byte. All Safe Edge records in the run are simulated.

Contents:

1.  [Setup](#setup)
1.  [Run](#run)
1.  [Result](#result)
1.  [Status changes through the repair](#status-changes-through-the-repair)
1.  [Other Observations in the sandbox](#other-observations-in-the-sandbox)
1.  [See also](#see-also)

## Setup

- Credentials: the four `PROCORE_*` variables in the gitignored root `.env`, written by `scripts/procore-sandbox-wizard.sh`. No credential is checked in or printed; the sandbox project ID this page shows is not one.
- Command: `bun run procore:e2e` ([`procore-e2e.ts`](/packages/providers/scripts/procore-e2e.ts)) from the repo root. It refuses to run in CI and fails when any `PROCORE_*` variable is missing.
- API: the script starts `bun run dev` in `apps/api` on a free port. That script loads the root `.env` with `--env-file` and served the seeded core to the dev tokens then committed (`dev_<name>` for `usr_<name>`), on the wall clock. Since #129 it serves this machine's generated dev tokens instead, and the script takes each person's from `apps/api/src/dev-tokens.ts`. Since #147 it starts on the scenario clock, at the seed's date.
- Photo: [`data/elmina/scenarios/s6-vandalised-sign.png`](/data/elmina/scenarios/s6-vandalised-sign.png), a 72,948-byte PNG, sha256 `9ea49766287640e0504847442a83448466890cb954e75ce115d75c750918c5c5`. The repo has no real site photo; this simulated drone frame of `seg_866518980_11`, the S1 segment, is the only photo-like image of it.

## Run

Each step is one HTTP call through the SDK's HTTP client with the named dev token:

1.  `dev_crew` uploads the photo as evidence (`evd_1`) and records a phone observation with it on `seg_866518980_11`, viewpoint `vp_866518980_11_2`.
1.  `dev_drone_sim` (provider) raises fence panel 4 as missing. Core makes it a Tier 2 candidate.
1.  `dev_manager` confirms it, severity high, which opens `fnd_1` and drafts `wo_1`. `dev_crew` completes the interim protection task.
1.  `dev_manager` marks the panel gap as an opening. `dev_engineer` creates the panel replacement remedy and approves it.
1.  `dev_manager` puts the remedy on `wo_1` and submits it, which publishes `edge.work_order.submitted.v1`. The API's Procore hand-off files the Observation, stores its ID on `wo_1`, then uploads the photo and attaches it.
1.  The script reads `wo_1` back as `dev_manager` until `externalRef` is set, then gets a token of its own and calls `GET /rest/v1.0/observations/items/371386?project_id=374160` on `sandbox.procore.com`. It downloads the attachment, with the token, and compares its sha256 with the uploaded photo's.

## Result

```text
2026-10-19T09:14:29.115Z submitted wo_1 (finding fnd_1, photo evd_1)
2026-10-19T09:14:31.119Z wo_1 externalRef is Procore Observation 371386
Procore sandbox project 374160, Observation 371386 "Safe Edge fnd_1: inventory item on seg_866518980_11"
  created_at 2026-10-19T09:14:30Z
  attachment 13145973 evd_1.png: sha256 9ea49766287640e0504847442a83448466890cb954e75ce115d75c750918c5c5, the same bytes as data/elmina/scenarios/s6-vandalised-sign.png
  https://sandbox.procore.com/rest/v1.0/observations/items/371386?project_id=374160
```

The attachment's `url` is on `sandbox.procore.com` and answers 401 without the token. With it, it redirects to Amazon S3, which serves the PNG.

## Status changes through the repair

On 19 October 2026 the extended `procore:e2e` (#127) carried S1 past the submit, on a fresh temporary data directory. After the photo check, `usr_installer` started and completed `wo_1`, and `usr_reviewer` recorded an accepted re-test, which made the pass valid. The API moved the Observation with `WorkOrderProvider.updateStatus`, and the script read each status back from the sandbox with a token of its own:

```text
2026-10-19T10:02:22.830Z submitted wo_1 (finding fnd_1, photo evd_1)
2026-10-19T10:02:25.836Z wo_1 externalRef is Procore Observation 371390
Procore sandbox project 374160, Observation 371390 "Safe Edge fnd_1: inventory item on seg_866518980_11"
  created_at 2026-10-19T10:02:25Z, status initiated
  attachment 13145984 evd_1.png: sha256 9ea49766287640e0504847442a83448466890cb954e75ce115d75c750918c5c5, the same bytes as data/elmina/scenarios/s6-vandalised-sign.png
  https://sandbox.procore.com/rest/v1.0/observations/items/371390?project_id=374160
2026-10-19T10:02:34.946Z wo_1 completed: Observation 371390 is ready_for_review
2026-10-19T10:02:37.469Z re-test accepted: Observation 371390 is closed
```

A rejected re-test sends `not_accepted`. That path ran only against the contract double, not the sandbox.

## Other Observations in the sandbox

| Observation | Created by                                    | Photo                                                              |
| ----------- | --------------------------------------------- | ------------------------------------------------------------------ |
| 371383      | `bun run procore:smoke`, the adapter directly | `docs/images/shortlist/safe-edge-workflow.png`                     |
| 371385      | The first `procore:e2e` run, at 09:13:48Z     | The S6 frame, attached as file 13145972 with the same sha256 above |
| 371386      | The `procore:e2e` run above                   | The S6 frame, file 13145973                                        |
| 371390      | The `procore:e2e` status run, now closed      | The S6 frame, file 13145984                                        |

The first `procore:e2e` run filed and linked 371385 the same way, but its byte check fetched the attachment URL without the token and got a 401. The script now sends the token, and a check of 371385 afterwards found the same bytes.

## See also

- [Providers README: Procore sandbox setup and smoke test](/packages/providers/README.md#procore-sandbox-setup-and-smoke-test)
- [The API's Procore hand-off](/apps/api/src/work-orders.ts)
- [Procore: Working with Observations](https://developers.procore.com/documentation/tutorial-observations)
