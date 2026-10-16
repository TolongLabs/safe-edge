# Site breeding register

"We help Sime Darby Property's contractors show, floor by floor, which areas of a building site were searched for Aedes breeding, what was found, and which fixes were checked." Heavy rain adds checks, a separate checker accepts or rejects each fix, and SDP can share a dated summary with neighbours. Working name; first called Rain Check.

**Track:** People, health and wellbeing. **Rank:** see the [shortlist](/docs/research/shortlist.md).

Contents:

1.  [Problem](#problem)
1.  [Target user](#target-user)
1.  [Solution and how it works](#solution-and-how-it-works)
1.  [Why it's new](#why-its-new)
1.  [Impact and how we measure it](#impact-and-how-we-measure-it)
1.  [Fit with Sime Darby Property](#fit-with-sime-darby-property)
1.  [Pilot](#pilot)
1.  [Prototype by 23 October](#prototype-by-23-october)
1.  [Scorecard](#scorecard)
1.  [Risks and open questions](#risks-and-open-questions)
1.  [How the idea changed across rounds](#how-the-idea-changed-across-rounds)

## Problem

- **Dengue is back.** Malaysia recorded 65,979 cases by epidemiological week 35 of 2026, 66% more than at the same point of 2025; deaths rose from 32 to 62 ([Bernama][bernama-dengue]).
- **Building sites breed Aedes inside the structure.**
  - In 2024, Kuala Lumpur and Putrajaya health inspectors found Aedes at 126 of 242 construction sites checked (52%); at one KL site, 6 of 8 breeding spots were inside the building ([site dengue screen][screen]; [Kosmo][kosmo]).
  - A survey of 19 KL sites found breeding from ground level up to the 14th floor ([site dengue screen][screen]).
  - The MOH construction-site guide lists basements, lift wells, drums, formwork, water tanks, floors and slabs as places to inspect ([MOH guide][moh-guide]).
- **Enforcement is real.** In 2026 DBKL found 4 breeding spots at a Bukit Damansara site after 4 local dengue cases and issued a 14-day closure order ([DBKL][dbkl]). The Destruction of Disease-Bearing Insects Act 1975 lets officers order fixes and close premises ([Act 154][ddbia]).
- **Inspections are periodic.** MPAJ's 2026 calendar schedules construction-site operations about once a month ([MPAJ][mpaj]).
- **Neighbours care.** A former Head of Township at SDP we consulted says residents near large developments worry most about "construction dust, noise, traffic congestion, and potential impacts on their health", and that developers should "share monitoring results" ([consultation][consult]).

[bernama-dengue]: https://bernama.com/en/news.php?id=2605035
[screen]: /docs/research/niche-problems/screens/site-dengue.md
[kosmo]: https://www.kosmo.com.my/2024/05/23/nyamuk-aedes-berlambak-di-tapak-projek/
[moh-guide]: https://jknkelantan.moh.gov.my/htumpat/v1/images/ukkp/garis-panduan-pengawalan-nyamuk-aedes-di-tapak-pembinaan-.pdf
[dbkl]: https://www.dbkl.gov.my/berita-acara/dbkl-ambil-tindakan-tegas-tangani-risiko-pembiakan-nyamuk-aedes-di-tapak-pembinaan
[ddbia]: https://www.moh.gov.my/images/04-penerbitan/akta-kesihatan/destruction%20of%20disease-bearing%20insects%20act%201975.pdf
[mpaj]: https://www.mpaj.gov.my/sites/default/files/2_takwim_mpaj_2026_-_02_feb.docx.pdf
[consult]: /docs/research/consultations/township-practitioner.md

## Target user

- **Primary:** the main contractor's site environmental officer on an SDP building site next to occupied homes.
- **Secondary:** the contractor's site manager, who owns resources and unresolved work; a trained checker who did not do the fix; and SDP as sponsor and auditor. Neighbouring residents benefit and read the summary; they don't use the app.

## Solution and how it works

1.  **Register areas, not just spots.** Each floor and ground zone is a named area. Sources found there, from the MOH guide's list of targets, get stable IDs and their own history.
2.  **Plan dated rounds; let rain add more.** Routine rounds follow the site's control plan; the 2015 MOH guide sets weekly searches ([MOH guide 2015, §6.1][moh-2015]). When the officer records heavy rain, they add areas to an extra round. A second shower never resets an open finding's clock.
3.  **Sweep each area.** The officer searches the whole area, not only known pins, and records the sweep as complete, partial or blocked. An unswept area stays visible even when every known pin is checked. A dry check closes without creating a task.
4.  **Fix, then check separately.** The officer can fix a safe problem on the spot, or assign it to a named person. A checker who did not do the fix rechecks it on site; nobody approves their own fix. A repeat finding opens a new incident linked to the same source, and needs a cause.
5.  **Escalate and report.** Blocked, overdue and unchecked work goes to the contractor manager first, then to SDP. A dated report shows every state, including unswept and unresolved areas. Official orders from health officers are tracked apart, and only they can close them.

![Site breeding register workflow in four lanes: the area register and recorded heavy rain set a dated round; the officer sweeps each area, a finding goes to a fix, and an independent person rechecks it, returning rejected fixes; checked fixes stay on future rounds; areas not searched are held as blocked or unswept and escalate to the contractor, then SDP; a dated report covers every state](/docs/images/shortlist/breeding-register-workflow.png)

The rough workflow above was checked with Archify and vetted on 17 October; the [shortlist page](https://claude.ai/artifact/DxMjV6PXEj7zUdXCzMPQ8W) links an interactive version.

[moh-2015]: https://dosh.gov.my/wp-content/uploads/2024/10/Garis-Panduan-Pengawalan-Nyamuk-Aedes-Di-Tapak-Tapak-Pembinaan-2015.pdf

## Why it's new

| Closest analogue                                                    | What it does                                                  | What it lacks                                          |
| ------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------ |
| RainCheck, US software ([RainCheck][raincheck])                     | Rain-triggered inspection deadlines for stormwater compliance | Stormwater, not Aedes; no floor-by-floor locations     |
| iDengue and council dengue maps ([iDengue][idengue])                | Public case and hotspot maps                                  | Area level; nothing about where on a site water stands |
| Construction apps such as Procore and BuildTrack ([screen][screen]) | General site inspections and tasks; SDP uses Procore          | No Aedes location register or verified close-out       |
| MOH construction-site guide ([MOH guide][moh-guide])                | Lists what to inspect and who is responsible                  | Paper guidance; no record of what was checked or fixed |

- **Our read:** the new part is dated area sweeps that keep unsearched areas visible, joined to separately checked fixes, recurrence history and rain. Procore already has floor locations and rejection, so the pilot tests whether these controls add value on top of it.

[raincheck]: https://www.raincheckhq.com/resources/rain-event-inspections
[idengue]: https://idengue.mysa.gov.my/ide_v3/introduction.html

## Impact and how we measure it

- **Primary outcome:** checks done on time against checks due in each round, with unswept areas shown.
- **Omissions:** sources found by a separate area audit that the round missed, against areas searched.
- **Breeding:** positive water-holding containers against inspected water-holding containers, and repeat findings at the same source.
- **Speed:** time from finding to verified fix.
- **Cost:** staff minutes per inspection round, including verification.
- **What we won't claim:** dengue cases prevented; nearby cases don't prove a site caused them.

## Fit with Sime Darby Property

- **Pillar:** Community Experience in SDP's Sustainability Strategy and Roadmap 2030 ([SDP][sdp]).
- **SDP's own process:** SDP already pilots SafePass AI and Guardian AI for site safety and uses Procore ([SDP][sdp]); the register adds the missing health layer.
- **Value:** SDP is the employer, so it can write the register and verification into contracts. A closure order stops work and can push back vacant possession; the register reduces that exposure, without claiming a saving before the pilot. The judging panel scored its strategic fit 5 out of 5 in round 4.
- **Scale:** every active SDP phase next to occupied homes, across 27 townships.

[sdp]: /docs/research/sime-darby-property.md

## Pilot

| Element       | Plan                                                                                                                              |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Where         | One active SDP phase beside occupied homes, with a comparison site                                                                |
| Owner         | SDP's project team, with the main contractor's environmental officer                                                              |
| Duration      | 8 to 12 weeks for the first stage, then a monsoon season                                                                          |
| Cost          | App work and verification time; corrective work is already the contractor's duty                                                  |
| Approvals     | SDP and the main contractor; no public body needed                                                                                |
| Success       | More on-time checks, fewer omissions and repeat findings, and faster checked fixes than the comparison, with targets agreed first |
| Decision gate | If met, add the register to SDP's contract requirements for sites next to homes                                                   |
| Risks         | Paperwork without fixes: spot rechecks. Staff time: measure it and keep the form short                                            |
| Baseline      | Start with the current process; match comparison areas by work stage; log weather and site changes                                |

## Prototype by 23 October

- **What it is:** a mobile-first web app that works offline, built with React, Dexie and Supabase. The vet rated it buildable in 7 days with cuts.
- **Software components:**
  - Area and source register with dated rounds: areas, sources, rounds and observations kept as separate records, from a hand-made CSV and area sketch.
  - Phone inspection form: water state, immature mosquitoes seen, containers inspected and action needed, saved offline in an upload queue.
  - Fix, recheck and escalation flow: separate test accounts, server-enforced roles, an append-only history and an in-app overdue queue.
  - Rain events: entered by hand with their source; a reading from a station off site is labelled as such.
  - Exploded floor view: Three.js slabs built from the same area records, capped at half a day and kept only if a user test shows it helps.
  - Report: one internal, printable snapshot with scope, dates and unresolved work.
- **Cut from the build:** automatic JPS polling, SMS, WhatsApp and push alerts, a live public feed, a "dengue-safe" badge and a live Procore link. A CSV with stable IDs stands in for Procore.
- **Real data:** one consenting site's areas and observations; MOH guide targets.
- **Labelled simulation:** if site access fails, a campus building with documented records, said plainly in the demo. Never create standing water for the demo.
- **Build plan:** day 1 agree the field method and collect a small consented dataset; days 2 to 3 the sweep, fix and recheck path; day 4 offline upload, then the floor view; day 5 test with the site user and time the work; days 6 to 7 deck and video.
- **Day 5 pass checks:** an offline save survives a restart; a repeated upload creates one record; a foreman can't approve their own fix; a dry check creates no task; new rain can't reset an old finding; an unswept area never counts as covered.
- **Evidence before submission:** one area omission found by an audit, or a fix closed without a recheck, and staff minutes for both methods on the same floor. If no omission appears, report that.

## Scorecard

Judged by simulated consultants and panels, not the real judges. Rounds 3 to 5 used Codex gpt-6-astra (xhigh).

| Scorer                 | Impact | Innovation | Feasibility | Fit | Commercial | Evidence | Weighted |
| ---------------------- | -----: | ---------: | ----------: | --: | ---------: | -------: | -------: |
| Judging panel, round 3 |      4 |          2 |           3 |   5 |          3 |        3 |       67 |
| Judging panel, round 4 |      4 |          3 |           3 |   5 |          3 |        3 |       71 |
| Judging panel, round 5 |      4 |          2 |           3 |   4 |          3 |        3 |       64 |

- **Experts in round 4:** a vector-control health officer and a contractor's safety, health and environment manager both said "wounded, back it with fixes"; no fatal attacks.
- **Biggest weakness:** no proof yet that it catches what the current checklist misses.
- **The change that would raise it most:** one site visit that finds a missed location or an unverified close-out.
- **Solution vet, 17 October:** a vector-control specialist said "needs changes", nothing fatal. The top fix is to replace spot-only status with dated area sweeps, linked to source and fix histories, and to prove one omission-to-recheck journey. All its workflow and build changes are folded in above.

## Risks and open questions

- **Contractors already inspect.** We must show the specific gap.
- **Photos can be gamed.** Verification and spot rechecks cost staff time.
- **Is 3D worth it?** Keep the exploded view only if it beats a floor list in a user test.
- **Site access.** Without a consenting site, the demo uses an analogue and says so.

## How the idea changed across rounds

- **Round 2:** began as "living next to a data centre", then "living next to an active building site"; experts found construction dashboards already sold and SDP unwilling to publish breach scores.
- **Round 3:** narrowed to Aedes on building sites as Rain Check, with rain-triggered, floor-aware checks; panel 67, the leader.
- **Round 4:** rebuilt as a register that can't be faked clear, with verified close-out and an exploded floor view; panel 71 and strategic fit 5.
- **Round 5:** renamed after finding the US product RainCheck; panel 64 on a rerun.
- **Solution vet:** spots became dated area sweeps, the clerk of works became an independent checker, and rain polling became manual event entry.
