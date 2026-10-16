# Lepas Hujan

"We help new Sime Darby Property homeowners find roof and window leaks while the defect liability period still covers them." When heavy rain falls on their phase, the SDP App asks them to look, and one tap files a defect report stamped with the rainfall. _Lepas hujan_ is Malay for "after the rain".

**Track:** Planet, climate resilience. **Rank:** see the [ranking](0000-ranking.md).

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

- **Leaks show up only in heavy rain, so owners find them late.**
  - An Elmina owner, 21 March 2024: "Yesterday raining, now leaking again. This is so called fix but every time raining sure hv surprise from the house." Asked on 25 March whether it was the toilet or the roof, the owner answered "From rooftop and wall crack" ([Lowyat][lowyat 2024]).
  - Another Elmina owner, 11 February 2022, unit type EV5: "full of defect, especially the water leakage at car porch". A reply: "Most of them have the same water leakage problem at car porch" ([Lowyat][lowyat 2022]).
  - A buyer of an SDP home, December 2020: "The defect surficed out immediately after warranty period expried" ([PropertyGuru][askguru], _secondary_).
  - An inspection firm advises owners that "Some roof problems only become apparent during heavy or wind-driven rain" ([TAJ Tasneem][taj]).
- **Owners already care about the deadline.** A Malaysian post about hiring a defect inspector, "Banyak betul defect rumah ni" (so many defects in this house), drew 5,142 likes in 2021. The inspector replied that under the defect period "kos semua akan ditanggung oleh dev" (the developer bears all the costs) ([X][aidasue]; [X][hafez]).
- **Malaysia's cover is short.**
  - The standard sale contracts give a 24-month defect liability period, and the developer must repair "within thirty (30) days of the Developer having received written notice" ([VCC Law][vcc]).
  - Singapore's HDB adds a "5-year warranty for ceiling leaks and external wall seepage" to its one-year defect period ([MND][mnd]). Japan makes sellers liable for 10 years for the parts of a home that keep rain out ([MLIT][mlit]).
- **Leaks are few but serious.** A 2026 study of defect lists from 160 terraces in Kuala Terengganu counted 164 cases of "Watermark at ceiling due to roof leakage" and 104 blocked gutters or downpipes, out of about 4,800 defects, most of them finishes ([Planning Malaysia][pm 2026]; the total is our sum of its Table 1). A leak can ruin a ceiling, wiring and furniture; a paint defect can't.
- **The scale at SDP.** SDP delivered 2,346 units in FY2024 and 3,440 in FY2023 ([SDP Integrated Report 2024][ir2024]), so roughly 5,800 units sit inside a 24-month defect period at once (our arithmetic; the report does not split landed, strata and industrial units).
- **Heavy rain is frequent, and only gauges see it.** Near Elmina, the JPS gauge at Rem KTM Sungai Buloh recorded 47.0 mm on 13 October 2026 and 40.5 mm on 15 October; Paya Jaras recorded 48.0 mm and 31.0 mm. Open-Meteo's modelled rain for the same days showed under 5 mm, so the trigger has to come from gauges ([JPS][jps rain]; our check against [Open-Meteo][open-meteo]).

[lowyat 2024]: https://forum.lowyat.net/topic/4690221/+4540
[lowyat 2022]: https://forum.lowyat.net/topic/4690221/+2400
[askguru]: https://www.propertyguru.com.my/property-forum/sime-darby-property-quality-is-poor-full-of-defect-like-roof-leakages-yet-short-warranty-period-the-defect-surficed-out-immediately-after-warranty-period-expried-need-help-163525
[taj]: https://tajdefectinspection.my/news/dlp-expiry-checklist-malaysia/
[aidasue]: https://x.com/AidaSue/status/1464900884769345536
[hafez]: https://x.com/hafezfirdaus/status/1464908534995324938
[vcc]: https://www.vcclaw.com.my/articles/liability-of-a-developer-after-the-defect-liability-period-in-housing-development-control-and-licen
[mnd]: https://www.mnd.gov.sg/newsroom/speeches/view/written-answer-by-ministry-of-national-development-on-recourse-for-residents-of-new-hdb-bto-projects-should-defects-that-surfaced-and-are-rectified-during-the-defects-liability-period-(dlp)-recur-after-the-dlp
[mlit]: https://www.mlit.go.jp/jutakukentiku/house/content/001586555.pdf
[pm 2026]: https://www.planningmalaysia.org/index.php/pmj/article/view/2029
[ir2024]: https://www.simedarbyproperty.com/sites/default/files/2025-05/SDP-IR2024.pdf
[open-meteo]: https://open-meteo.com/en/docs/historical-weather-api
[jps rain]: https://publicinfobanjir.water.gov.my/wp-content/themes/shapely/agency/searchresultrainfall.php?state=SEL&district=ALL&station=ALL&lang=en&loginStatus=0

## Target user

- **Primary:** owners of new SDP landed homes, from month 6 to month 24 after handover, in one City of Elmina phase.
- **Secondary:** SDP's defect and customer team, which SDP is turning into PACC, its performance analytics and command centre ([SR2025] p. 46).

[SR2025]: https://www.simedarbyproperty.com/sites/default/files/2026-04/SDP%20SR2025%20%28Website%29.pdf

## Solution and how it works

1.  **Watch the rain.** For each phase, read the nearest JPS rain gauges from Public Infobanjir's public table, which updates through the day and needs no key: Paya Jaras, Rem KTM Sungai Buloh, Kampung Melayu Subang and Bukit Jelutong for Elmina, and Pekan Meru and Bandar Klang for Bandar Bukit Raja.
2.  **Ask at the right moment.** When 24-hour rainfall passes a threshold, about 40 mm to start, the SDP App sends owners in that phase one message: "Heavy rain on your street today. Check ceilings, window frames and the car porch." Two storms passed that threshold near Elmina in one week this month.
3.  **One tap.** The owner answers dry, damp or leaking. Damp or leaking opens a photo and files a defect into SDP's existing process, stamped with the rainfall in mm, the gauge and the time. Dry costs one tap and tells SDP that house passed that storm.
4.  **Learn by house type.** SDP sees which house types leak at what rainfall, and fixes the whole batch before owners report it. The data goes to the designers of the next phase.
5.  **Close the gap.** In month 22, owners get one reminder to do a full check in the next heavy rain, before the period ends.

## Why it's new

| Closest analogue                                                                                          | What it does                                                                                                        | What it lacks                                          |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| US EPA Construction General Permit ([EPA][epa])                                                           | Requires a site inspection "within 24 hours once a storm event has produced 0.25 inches of rain"                    | Construction sites, not homes                          |
| RainCheck, US software ([RainCheck][raincheck])                                                           | Hourly rainfall checks per site; creates an inspection deadline at the threshold                                    | Contractors' stormwater compliance                     |
| USAA, US insurer ([USAA][usaa])                                                                           | Texts members about coming storms and claims                                                                        | Disasters and insurance, not warranty                  |
| Sekisui House's disaster-visit app, Japan ([Sekisui House][sekisui], _excerpt_)                           | Staff check owners' homes after earthquakes and typhoons                                                            | Disaster-level, staff-run                              |
| Trinity Group's Gold Assurance Programme, Malaysia ([Trinity][trinity])                                   | A "36-Months Defects Liability Period" and a "10-Years Warranty for Roof Leaks", on two flagship high-rise projects | Longer cover, but someone still has to notice the leak |
| Defect reporting in the SDP App ([SDP App FAQ][sdp faq]) and Gamuda Land's app ([Gamuda][gll], _excerpt_) | Owners report defects whenever they notice them                                                                     | No prompt at the moment leaks appear                   |

- **We found no developer, snagging app or insurer that asks homeowners to check for defects when it rains,** in Malaysia or abroad.
- **Our read:** innovation 4. Rain-triggered inspections exist abroad, but only for construction sites, insurers and disasters. The new part is pairing the trigger with the warranty clock, and tagging every report with rainfall so SDP can learn by house type.

[epa]: https://www.epa.gov/npdes/construction-general-permit-cgp-frequent-questions
[raincheck]: https://www.raincheckhq.com/resources/rain-event-inspections
[usaa]: https://www.usaa.com/support/insurance/claims/natural-disaster/
[sekisui]: http://web.archive.org/web/20240423112544/https://www.sekisuihouse.co.jp/company/sustainable2020/social/valuechain/activity5/act_11/
[trinity]: https://www.trinitygroup.com.my/news/trinity-group-launches-malaysias-first-gold-assurance-programme-malaysian-business/
[sdp faq]: https://www.simedarbyproperty.com/app/faq.html
[gll]: https://www.gamudaland.com.my/gl-lifestyle

## Impact and how we measure it

- **Primary outcome:** the share of all leaks that are caught inside the defect period, counting leaks reported up to 12 months after it ends, against a matched phase without prompts.
- **Design outcome:** the rainfall at which each house type first leaks, which becomes a design standard for heavier rain in the next phase.
- **Speed:** hours from the first storm that causes a leak to the report.
- **Repeat leaks:** repaired leaks that come back in a later storm of similar rainfall.
- **After the period:** leak complaints and Tribunal claims in the 12 months after the defect period ends, when claims of up to RM50,000 can still be filed ([Thomas Philip][tribunal]).
- **Baseline:** SDP's defect logs for the comparison phase, which we must ask SDP for, and interviews with owners of phases handed over in 2024 and 2025.

[tribunal]: https://www.thomasphilip.com.my/articles/what-you-need-to-know-about-homebuyerrs-tribunal/

## Fit with Sime Darby Property

- **Pillar:** Climate Resilience. SDP's 2030 target is "Adaptation and resilience plans for high-risk assets" ([CONTEXT]). Rain-tagged leak reports show the rainfall at which each house type fails, which is the evidence such a plan needs for homes facing heavier rain. The Community Experience pillar gains too: SDP's customer net promoter score was 88% in FY2025 ([CONTEXT]).
- **SDP's own aim:** its contact centre "has strengthened a proactive quality and defect management … This has helped identify recurring defects, reduce rework" ([SR2025] p. 46). Lepas Hujan gives that work a rainfall trigger.
- **Value to two sides:** owners avoid paying for leaks after the period ends. SDP gets defects fixed while the original contractor is still liable, fewer disputes after the period, and design data for the next phase.
- **Scale:** every SDP handover, starting with landed homes (2,346 units delivered in FY2024 and 3,440 in FY2023, all types), then strata units, then other townships.

[CONTEXT]: /docs/CONTEXT.md

## Pilot

| Element       | Plan                                                                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where         | Two comparable City of Elmina landed phases between months 6 and 24 after handover. One gets prompts; the other is the comparison                                         |
| Owner         | SDP's customer experience team and PACC, with the SDP App team                                                                                                            |
| Duration      | Six months, across the northeast monsoon from November to March                                                                                                           |
| Cost          | App work and push messages. Rain data is free. An optional rain gauge per phase. Extra repairs inside the period fall on contractors under their contracts (to confirm)   |
| Approvals     | SDP alone. Owners consent to photos under the PDPA. SDP legal decides whether an in-app report counts as written notice                                                   |
| Success       | More leak reports inside the period, faster reports after storms and fewer repeat leaks than the comparison phase                                                         |
| Decision gate | If met, add it to every landed handover, then strata units                                                                                                                |
| Risks         | Prompt fatigue: cap prompts at the threshold. Few leaks in a dry season: count "dry" answers as storm passes. Fear of more claims: SDP is liable for these defects anyway |

## Prototype by 23 October

- **Build:**
  - A rainfall watcher for Elmina and Bandar Bukit Raja gauges, scraped from the JPS table. The table is undocumented, so ask JPS Selangor for access.
  - A threshold rule that messages test users through Telegram or web push.
  - A one-tap form with a photo, and a dashboard by house type and rainfall.
- **Real triggers:** replay the two storms of 13 and 15 October 2026 and any heavy rain before submission.
- **Evidence before submission:**
  - Interview ten owners of Elmina homes handed over in 2024 and 2025: when they found leaks, whether after rain, and whether inside the period.
  - Ask SDP what share of leak reports arrive after the period ends.

## Scorecard

**Rank 1 of 8** in the merged ranking, with a mean judge score of 74.0 out of 100. It drops to fifth if strategic fit counts for 50% ([ranking](0000-ranking.md#pass-2-round-10-rank-and-stress-test)). The judges are AI agents playing SDP roles, scoring the draft against the [judging matrix](0000-ranking.md#judging-matrix).

| Scorer                  | Impact | Innovation | Feasibility | Fit | Commercial | Evidence | Weighted |
| ----------------------- | ------ | ---------- | ----------- | --- | ---------- | -------- | -------- |
| Author (round 9)        | 3      | 4          | 5           | 4   | 4          | 3        | 77       |
| SDP sustainability head | 3      | 4          | 5           | 3   | 4          | 4        | 76       |
| SDP township manager    | 3      | 4          | 4           | 3   | 4          | 3        | 70       |
| Innovation mentor       | 3      | 4          | 5           | 3   | 4          | 4        | 76       |

- **Biggest weakness:** nobody knows how many leaks surface after the defect period, and all three judges called the climate label a stretch for what is defect management.
- **The change that would raise it most:** one real figure for the share of leaks first reported after month 24, from SDP's defect log or from ten owner interviews. Then lead with leaks caught inside the period out of all leaks, and with rainfall at each leak as a design standard. Both are folded in above.
- **The only idea all three judges scored 4 on innovation.** All three also said owners would use it repeatedly: it is "one tap, tied to the owner's own money and a deadline".

## Risks and open questions

- **How many leaks surface after the period?** We found no figure. It decides how big the impact is, and only SDP has it.
- **Will owners answer?** Prompts are occasional and driven by the warranty deadline, not habit. Most answers will be "dry".
- **Does the defect flow work?** An App Store review from December 2025 says: "Cannot submit defect report… it has been two months and it is still not working" ([App Store][appstore]). The prompt is only as good as the form behind it.
- **Is a tap written notice?** If not, the app must send a formal notice for the owner.
- **The killer question:** "Why pay to find more defects during the defect period?" Because SDP is liable for them anyway, after the period too, and finding them early makes the original contractor fix them.

[appstore]: https://apps.apple.com/my/app/sime-darby-property-app/id6474657954

## How the idea changed across rounds

- **Round 1:** proposed as "Rain-Check" by the SDP township manager persona.
- **Round 3:** second on the author's score, with feasibility 5.
- **Round 4:** research found no weather-triggered warranty check anywhere, so innovation rose to 4. A US product already uses the name RainCheck, so it was renamed.
- **Round 6:** a check against gauges showed modelled rain missed both storms near Elmina in October, so the trigger moved to JPS gauges. Research found Trinity Group's 10-year roof-leak warranty, the closest Malaysian offer.
- **Round 8:** asked "Why not just copy Trinity's warranty?" Because a warranty only pays if someone notices the leak; rain-tagged reports by house type are also the data SDP would need to price its own extended warranty.
- **Round 9:** judges scored it 70 to 76, the highest mean of the eight. Their critique moved the headline outcome to the share of all leaks caught inside the period, and the fit to design standards for heavier rain.
