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

1.  **Measure.** The engineer walks one phase and records each water-edge segment: path distance, bank profile, drain depth, barriers and gaps, lighting, and nearby schools, playgrounds and fishing spots.
2.  **Check against the rules.** Each segment is checked against MSMA and the council's handover checklist. Every flag shows the rule, the measurement, its source and anything missing. Safe Edge ranks segments for inspection; it never gives a drowning probability.
3.  **Hold the unknowns.** A segment with unknown depth stays unresolved and can never be cleared.
4.  **Fix and prove.** A flag becomes a work order. It closes only after the reviewer accepts the fix, installed evidence is uploaded and a reinspection confirms it; rejected evidence reopens it. Prevention (barriers, covers, slopes), escape and rescue equipment are tracked separately, so a ring buoy never cancels a dangerous drop.
5.  **Hand over and stay accountable.** The handover pack lists every edge, its custodian and its verified fixes. After handover, a later defect becomes an ISF-ready work package for the council: hazard, owner, rule, quote and fund line.

The rough workflow is in the [shortlist page](https://claude.ai/artifact/DxMjV6PXEj7zUdXCzMPQ8W).

## Why it's new

| Closest analogue                                         | What it does                                                        | What it lacks                                                  |
| -------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------- |
| Procore, Novade, PlanRadar ([checks][checks])            | Configurable inspections, punch lists and defects; SDP uses Procore | No water-edge rule set, and nothing about access to deep water |
| MBSP's road and drain handover checklist ([MBSP][mbsp])  | A site visit with drain-edge barriers and pond signs before the CCC | One council, a paper form, no record carried past handover     |
| Alkaff Lake, Singapore ([PUB][pub])                      | Level sensors, lights and four-language warnings as banks flood     | Storm-only; most township drownings happen in normal weather   |
| Smart Dublin ring buoys ([lake edges][lake-edges])       | Alerts when rescue equipment goes missing                           | Equipment only; says nothing about the edge itself             |
| England's Infrastructure Funding Statements ([ISF][isf]) | Councils report developer contributions received and spent          | Fund level, not asset by asset, and not in Malaysia            |

- **Our read:** no tool we found joins a water-edge rule check, verified repair and a record that carries the ISF past handover.

[pub]: https://www.pub.gov.sg/Resources/News-Room/PressReleases/2024/09/Media-Factsheet-on-Alkaff-Lake
[lake-edges]: /docs/research/niche-problems/lake-edges.md
[isf]: /docs/research/niche-problems/screens/isf-accountability.md

## Impact and how we measure it

- **Primary outcome:** hazardous edge metres closed and verified before handover, against what the current checklist finds on the same phase.
- **Repair quality:** reopened fixes and protection still intact at reinspection.
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

| Element       | Plan                                                                                                                         |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Where         | One SDP phase before handover, plus one SDP lake park (Elmina Central Park is reported to be under a 21-year SDP leaseback)  |
| Owner         | SDP's project team for the phase, with township management for the park                                                      |
| Duration      | One phase from final inspections to handover, about 6 months                                                                 |
| Cost          | App work and field time; physical fixes are priced per edge from contractor quotes                                           |
| Approvals     | SDP alone before handover; the receiving council for the post-handover record                                                |
| Success       | More verified hazards closed than the current checklist finds, fewer reopened fixes, every edge handed over with a custodian |
| Decision gate | If met, add it to every phase handover with water edges                                                                      |
| Risks         | No budget for fixes: price them first. Council won't accept the record: start with SDP-retained parks                        |

## Prototype by 23 October

- **What it is:** a web app, built with React, Three.js and a map library.
- **Software components:**
  - Edge register: segments drawn on an OpenStreetMap base map of one SDP area, each with its measurements, photos and source.
  - Rule engine: a JSON rule file with MSMA clauses and council checklist items; each flag carries the rule, the value and the missing data.
  - Measured cutaway: a Three.js section of one real edge, current against proposed fix, at normal and storm water levels.
  - Work-order flow: assign, upload evidence, reviewer accept or reject, reinspect, close.
  - Handover pack and ISF work package: CSV or PDF export.
- **Real data:** one edge the team measures with tape, level and, if access allows, a consumer sonar; OpenStreetMap paths, schools and playgrounds; MSMA and council thresholds.
- **Labelled simulation:** reviewer and contractor accounts, and a staged repair, clearly marked in the demo.
- **Build plan:** days 1 to 2 measure one edge and interview a drainage practitioner; days 3 to 4 register, rules, cutaway and work orders; day 5 compare against the current checklist; days 6 to 7 deck and video.
- **Evidence before submission:** one measured edge with a bypass around existing protection, a side-by-side with the current checklist, and an itemised repair quote.

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
