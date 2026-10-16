# Site breeding register

"We help Sime Darby Property's contractors find every place Aedes can breed on a building site, floor by floor, and prove each fix, so no spot shows clear without a check." Heavy rain adds checks, a verifier accepts or rejects each fix, and neighbours get a monthly summary of verified results. Working name; first called Rain Check.

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
- **Secondary:** SDP's clerk of works, who verifies fixes, the foremen who carry them out, and the neighbouring residents who read the monthly summary.

## Solution and how it works

1.  **Register every spot.** Each breeding-prone location from the MOH guide sits on its floor, with an owner and the age of its last check.
2.  **Keep routine checks; let rain add more.** When the site's rain gauge or the nearest JPS gauge passes a threshold, the register adds a due check for exposed locations.
3.  **Walk the floors.** The officer gives every location a state: not checked, blocked, finding open or verified. A missed or blocked location can never show clear.
4.  **Fix and verify.** A finding goes to a named foreman, the fix needs photo evidence, and the clerk of works accepts or rejects it. A repeat finding reopens the same location with its history.
5.  **Escalate and share.** Overdue or blocked locations escalate to SDP's project manager, and neighbours get a monthly summary of verified results, with no health-outcome claims.

The rough workflow is in the [shortlist page](https://claude.ai/artifact/DxMjV6PXEj7zUdXCzMPQ8W).

## Why it's new

| Closest analogue                                                    | What it does                                                  | What it lacks                                          |
| ------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------ |
| RainCheck, US software ([RainCheck][raincheck])                     | Rain-triggered inspection deadlines for stormwater compliance | Stormwater, not Aedes; no floor-by-floor locations     |
| iDengue and council dengue maps ([iDengue][idengue])                | Public case and hotspot maps                                  | Area level; nothing about where on a site water stands |
| Construction apps such as Procore and BuildTrack ([screen][screen]) | General site inspections and tasks; SDP uses Procore          | No Aedes location register or verified close-out       |
| MOH construction-site guide ([MOH guide][moh-guide])                | Lists what to inspect and who is responsible                  | Paper guidance; no record of what was checked or fixed |

- **Our read:** the new part is a register in which a location cannot show clear without a check and a verified fix, joined to rain and to a summary neighbours can read.

[raincheck]: https://www.raincheckhq.com/resources/rain-event-inspections
[idengue]: https://idengue.mysa.gov.my/ide_v3/introduction.html

## Impact and how we measure it

- **Primary outcome:** audited coverage, the share of registered locations checked on schedule and after heavy rain.
- **Breeding:** positive locations per containers inspected, and repeat findings at the same location.
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

| Element       | Plan                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------- |
| Where         | One active SDP phase beside occupied homes, with a comparison site                           |
| Owner         | SDP's project team, with the main contractor's environmental officer                         |
| Duration      | 8 to 12 weeks for the first stage, then a monsoon season                                     |
| Cost          | App work and verification time; corrective work is already the contractor's duty             |
| Approvals     | SDP and the main contractor; no public body needed                                           |
| Success       | Higher audited coverage, fewer repeat findings and faster verified fixes than the comparison |
| Decision gate | If met, add the register to SDP's contract requirements for sites next to homes              |
| Risks         | Paperwork without fixes: spot rechecks. Staff time: measure it and keep the form short       |

## Prototype by 23 October

- **What it is:** a mobile-first web app that works offline, built with React and Three.js.
- **Software components:**
  - Location register: floors and breeding-prone locations from a real floor plan, each with an owner and last-check age.
  - Rain trigger: polls the nearest JPS Public Infobanjir gauge and adds due checks above a threshold.
  - Phone checklist: a state for every location, with photo and timestamp, saved offline.
  - Task and verification flow: foreman task, photo proof, verifier accept or reject, repeat findings reopen, overdue items escalate.
  - Exploded floor view: a Three.js stack of floors showing unchecked floors, blocked spots and open findings.
  - Resident summary: a monthly page of verified results.
- **Real data:** one consenting site's floor plan and inspection records; JPS rainfall; MOH guide targets.
- **Labelled simulation:** if site access fails, a campus building with documented records, said plainly in the demo.
- **Build plan:** day 1 site access and an interview with the environmental officer; days 2 to 4 register, checklist, verification and floor view; day 5 test with the officer against the current checklist; days 6 to 7 deck and video.
- **Evidence before submission:** one location the current checklist misses, or a fix closed without a recheck, and staff minutes for both methods on the same floor.

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
