# Safe Edge

"We help Sime Darby Property find and fix the drain, pond and lake edges where people can reach deep water, prove every repair before handover, and keep someone accountable after." An explainable rule check flags each edge, a reviewer accepts or rejects each fix, and the record passes to the council at handover.

**Track:** People, safety and security. **Rank:** see the [shortlist](/docs/research/shortlist.md).

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

- **People drown at township water edges, mostly in normal weather.**
  - On 15 October 2026 a 30-year-old man went missing while fishing at Tasik Bukit Raja in Bandar Bukit Raja, an SDP township; Bomba recovered his body the next day ([Utusan][utusan]). We cite this as a reason to inspect, not as a claim about what caused his death.
  - In August 2026 two boys aged 11 and 12 drowned at a township dam in Pasir Gudang, and residents asked for fencing and CCTV ([Bernama][bernama-pg]; [MalaysiaGazette][mgazette]).
  - The Fire and Rescue Department counted 371 child and teen drowning deaths from January 2023 to August 2026 ([The Star][star-371]).
  - Of 21 news-reported cases in Selangor and Kuala Lumpur township waters since 2023, rain featured in only 4 ([incident table][incidents]).
- **The rules exist, but nobody checks access to the water.** MSMA asks for covers on drains deeper than 0.6 m beside footpaths, a 1.2 m rail or grating where flow runs at 2 to 4 m/s, and pond banks of 1V:4H or gentler ([water-edge checks][checks]). Form G17, the road and drain certificate, ties work to approved plans and has no item for pedestrian access to water. Only some councils check it at handover: MBSP's July 2026 checklist asks for a barrier beside drains 1.2 m wide or deeper than 0.9 m, and pond warning signs ([MBSP][mbsp]).
- **After handover, money exists but accountability doesn't.** Developers prepay councils an Improvement Service Fund (ISF) under the Street, Drainage and Building Act 1974; MBDK charges RM5,000 per acre for drainage, paid into an ISF trust fund ([MBDK][mbdk]). A former Head of Township at SDP we consulted: "The bigger issue is not who owns the drain or pond after handover, but whether there is clear accountability for maintenance and public safety" ([consultation][consult]).

[utusan]: https://www.utusan.com.my/nasional/tragedi/2026/10/pemancing-ditemukan-lemas/
[bernama-pg]: https://www.bernama.com/en/news.php?id=2592495
[mgazette]: https://malaysiagazette.com/2026/08/10/2-budak-lemas-penduduk-mahu-kawasan-empangan-dipagar-pasang-cctv/
[star-371]: https://www.thestar.com.my/news/nation/2026/10/16/371-youngsters-lost-to-drowning
[incidents]: /docs/research/niche-problems/drowning-incidents.md
[checks]: /docs/research/niche-problems/water-edge-checks.md
[mbsp]: https://www.mbsp.gov.my/brgonline/kej/jalanparit/jp7-ccc.pdf
[mbdk]: https://www.mbdk.gov.my/sites/default/files/media/document/2024-03/9.%20SENARAI%20SEMAK%20IMPROVEMENT%20SERVICE%20FUND%20%28ISF%29.pdf
[consult]: /docs/research/consultations/township-practitioner.md

## Target user

- **Primary:** an SDP project engineer checking one township phase before handover.
- **Secondary:** the reviewer who signs off repairs (the responsible engineer, with a water-safety assessor where needed), and after handover the council engineer and the residents' association.

## Solution and how it works

1.  **Set up the asset.** Record the asset and phase, the local authority, the current custodian, the approved drawing revision and the responsible engineer before anyone walks the site.
2.  **Measure one access route.** The unit of work is a route from a path to an exposed edge and the control that should stop it: a cover, a rail, a barrier end or a gate. The engineer records a plan sketch, a section and labelled photos of both ends, with the method and its uncertainty. Drain depth and water depth are kept apart.
3.  **Check against the rules.** Each check returns a finding, no finding, not applicable or needs information, with the clause, the measurement and its source. Continuity and bypass checks are labelled as human observations. Safe Edge never computes a drowning risk; the engineer sets urgency.
4.  **Act now on what is visible.** A missing cover or broken barrier gets interim protection at once. Missing depth blocks only the checks that need it, and that data request goes back to the field with an owner and a due date.
5.  **Fix and prove.** The engineer approves the remedy and its acceptance test before any work is issued, and a budget holder authorises it. The contractor submits installed evidence; a reviewer who did not install it checks it on site. Rejection keeps the earlier evidence and states the failed item. Assessment, repair and custody each keep their own status.
6.  **Hand over and stay accountable.** The pack lists every route, its open findings and its verified repairs. The receiving authority records acceptance, and each edge keeps a next inspection date. Later damage opens a linked defect. A maintenance funding request, for example from the ISF, comes after the first pilot.

The rough workflow is in the [shortlist page](https://claude.ai/artifact/DxMjV6PXEj7zUdXCzMPQ8W).

## Why it's new

| Closest analogue                                         | What it does                                                        | What it lacks                                                  |
| -------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------- |
| Procore, Novade, PlanRadar ([checks][checks])            | Configurable inspections, punch lists and defects; SDP uses Procore | No water-edge rule set, and nothing about access to deep water |
| MBSP's road and drain handover checklist ([MBSP][mbsp])  | A site visit with drain-edge barriers and pond signs before the CCC | One council, a paper form, no record carried past handover     |
| Alkaff Lake, Singapore ([PUB][pub])                      | Level sensors, lights and four-language warnings as banks flood     | Storm-only; most township drownings happen in normal weather   |
| Smart Dublin ring buoys ([lake edges][lake-edges])       | Alerts when rescue equipment goes missing                           | Equipment only; says nothing about the edge itself             |
| England's Infrastructure Funding Statements ([ISF][isf]) | Councils report developer contributions received and spent          | Fund level, not asset by asset, and not in Malaysia            |

- **Our read:** no tool we found joins a water-edge rule check, a repair accepted against an agreed test and a record that carries custody past handover.

[pub]: https://www.pub.gov.sg/Resources/News-Room/PressReleases/2024/09/Media-Factsheet-on-Alkaff-Lake
[lake-edges]: /docs/research/niche-problems/lake-edges.md
[isf]: /docs/research/niche-problems/screens/isf-accountability.md

## Impact and how we measure it

- **Primary outcome:** controls verified on site, against defects confirmed, with the inspected coverage shown. Edge metres are a secondary count.
- **Decision quality:** on the same evidence, the current checklist against Safe Edge; a practitioner judges useful findings, false flags, unresolved items and review time.
- **Repair quality:** rejected submissions, reopened fixes and protection still intact at reinspection.
- **Accountability:** share of edges handed over with a named custodian, and time from a later defect report to a verified fix.
- **What we won't claim:** drowning deaths are too rare to count in a pilot, so the pilot measures hazards and repairs, not lives saved.

## Fit with Sime Darby Property

- **Pillars:** Community Experience and Climate Resilience in SDP's Sustainability Strategy and Roadmap 2030 ([SDP][sdp]).
- **SDP's own process:** SDP uses Procore for construction quality, inspections and defects ([Procore case study][procore]); Safe Edge exports into that workflow.
- **Value:** smoother handover acceptance, a compliance step the practitioner calls a hidden cost; less legal exposure at ponds and lakes; and visible upkeep from the ISF SDP already pays, which the practitioner says preserves "community trust and township value".
- **Scale:** every SDP phase with drains, ponds or lakes across 27 active townships, then other developers and councils.

[sdp]: /docs/research/sime-darby-property.md
[procore]: https://www.procore.com/en-sg/casestudies/sime-darby-property

## Pilot

| Element       | Plan                                                                                                                                          |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Where         | One pre-handover drain asset in one SDP phase. A lake park (Elmina Central Park is reported to be under a 21-year SDP leaseback) comes second |
| Owner         | One SDP project engineer, with one budget approver                                                                                            |
| Duration      | One asset from final inspections to handover, about 6 months                                                                                  |
| Cost          | A quantity-based sheet: survey and review, interim controls, installed work, repeat inspection and software support                           |
| Approvals     | SDP alone before handover; the receiving authority records acceptance of the handover pack                                                    |
| Success       | More confirmed defects found and verified than the current checklist, fewer reopened fixes, a custodian and inspection date for every edge    |
| Decision gate | If met, add it to every phase handover with water edges, then lake parks, then council funding requests                                       |
| Risks         | No budget for fixes: price them first. The recipient can't use the pack: test one hand-off before promising more                              |

## Prototype by 23 October

- **What it is:** a web app built with React, Leaflet, Three.js and Supabase. The vet rated it buildable in 7 days with cuts.
- **Software components:**
  - Edge register and field form: one edge and its access routes on a saved OpenStreetMap extract, with measurements, photos, sources and uncertainty.
  - Rule checks: plain TypeScript checks from a small JSON rule file. Start with one MSMA cover check, one human-recorded continuity check and one maintenance-access review.
  - Review-and-repair flow: saved state changes with required fields. The installer can't verify their own repair, and nothing is accepted without reinspection evidence.
  - Measured view: a plan, one section and photos; a short Three.js view shows only measured geometry and labels the rest unknown.
  - Evidence pack: a printable record plus CSV or JSON and the original files. It attaches by hand to SDP's Procore item with that item's ID.
- **Cut from the build:** a live Procore API, council acceptance and ISF funding flows, sonar, flood simulation and a computed risk score.
- **Real data:** one permitted edge the team measures; OpenStreetMap paths, schools and playgrounds; MSMA clause text, confirmed by the project engineer.
- **Labelled simulation:** reviewer and contractor accounts, and a rehearsed repair, clearly marked in the demo.
- **Build plan:** days 1 to 2 site access, measurements and rule review; days 3 to 4 the saved case, rules, review flow and export; day 5 the practitioner comparison on identical evidence; days 6 to 7 deck and video. Drop the 3D view if the saved flow is not done by day 4.
- **Evidence before submission:** one measured route with a documented gap or bypass, the practitioner comparison and an itemised repair quote. Don't stage a defect to fit the story.

## Scorecard

Judged by simulated consultants and panels, not the real judges. Rounds 3 to 5 used Codex gpt-6-astra (xhigh).

| Scorer                 | Impact | Innovation | Feasibility | Fit | Commercial | Evidence | Weighted |
| ---------------------- | -----: | ---------: | ----------: | --: | ---------: | -------: | -------: |
| Judging panel, round 3 |      3 |          3 |           2 |   4 |          2 |        3 |       57 |
| Judging panel, round 4 |      4 |          3 |           3 |   4 |          2 |        3 |       66 |
| Judging panel, round 5 |      4 |          3 |           3 |   4 |          2 |        3 |       66 |

- **Experts in round 4:** a drainage and water-safety engineer and a developer project director both said "wounded, back it with fixes"; no fatal attacks remained.
- **Biggest weakness:** no proof yet that it finds hazards the current checklist misses, and no priced repair.
- **The change that would raise it most:** one measured edge with a real bypass that makes the cheap fix wrong, shown against the current checklist.
- **Solution vet, 17 October:** a drainage and water-safety engineer said "needs changes", nothing fatal. The top fix is to agree each repair's acceptance test before work starts, then prove it on one real access route. All its workflow and build changes are folded in above.

## Risks and open questions

- **Who pays for the fixes?** Safe Edge organises and proves repairs; it does not fund them.
- **Who is the custodian after handover?** It must be confirmed edge by edge.
- **Does it beat a good engineer?** Only a field comparison will show it.
- **Evidence for planted benches and lighting is thin.** Barriers have the strongest evidence; benches follow design guidance, not trials.

## How the idea changed across rounds

- **Round 1:** pitched as drowning alerts for children at drains and ponds; strongest impact, but close to flood alerts.
- **Round 2:** reframed as a pre-handover audit; experts showed guards can't rescue anyone from a fast drain and that a public "deadly edge" map is a legal trap.
- **Round 3:** became Safe Edge with a 3D lake view; the stricter judge found the underwater geometry unmeasured.
- **Round 4:** narrowed to an explainable rule check with verified repair, a measured cutaway and the ISF accountability layer from the practitioner; the fatal attack was cleared.
- **Round 5:** held at 66; the remaining gap is field evidence.
- **Solution vet:** the unit of work became one access route and its control; the pilot shrank to one drain asset; ISF funding moved after the first pilot.
