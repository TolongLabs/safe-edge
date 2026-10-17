# Lepas Hujan

"We help new Sime Darby Property homeowners find rain leaks while the defect liability period covers them, and count a repair as proven only when a storm as heavy as the one that caused the leak, from the same side, has left the spot dry." When heavy rain falls on their phase, owners get one prompt that says which side of the house to check first. Every leak repair is water-tested before SDP closes it; any later storm can reopen it, and only a storm like the first can prove it. _Lepas hujan_ is Malay for "after the rain".

**Track:** People, housing quality (first pitched as Planet, climate resilience; the round-5 judging panel called that framing weak). **Rank:** see the [shortlist](/docs/research/shortlist.md); its earlier rank is in the [archived ranking](/docs/archive/ideas/0000-ranking.md).

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
1.  [Other directions considered](#other-directions-considered)
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
- **Signed forms don't prove a repair, and hidden leaks outlast the period.**
  - In January 2026 the Court of Appeal dismissed Sime Darby Property's appeal against a judgment of about RM4.8 million for six bungalow owners in Bukit Jelutong ([FMT][fmt], _secondary_). The defect complaints it upheld included water seepage and cracks on walls and ceiling joints ([Malaysian Bar][bar]).
  - The court affirmed the finding that some Defect Rectification Forms and Feedback Forms, which acknowledged repairs, were forged ([Malaysian Bar][bar]).
  - It held that the 24-month defect liability period covers patent defects, and does not bar claims for latent defects that are only discoverable after it ([Malaysian Bar][bar]).
  - **Our read:** a signed form is weak proof that a repair worked, and a hidden leak found after month 24 can still cost SDP. Both point at proving repairs. On a slide, say "the courts look past signed forms to evidence"; don't put "forged" in front of SDP's judges.
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
[fmt]: https://www.freemalaysiatoday.com/category/nation/2026/01/30/rm4-8mil-judgment-against-sime-darby-property-for-defective-bungalows-affirmed
[pm 2026]: https://www.planningmalaysia.org/index.php/pmj/article/view/2029
[ir2024]: https://www.simedarbyproperty.com/sites/default/files/2025-05/SDP-IR2024.pdf
[open-meteo]: https://open-meteo.com/en/docs/historical-weather-api

## Target user

- **Primary:** owners of new SDP landed homes, from month 6 to month 24 after handover, in one City of Elmina phase.
- **Secondary:** SDP's defect and customer team, which SDP is turning into PACC, its performance analytics and command centre ([SR2025] p. 46), and its We Fix Team, which speeds up defect repairs in newly handed-over projects ([IAR2025] p. 130) and would run the water tests.

[SR2025]: https://www.simedarbyproperty.com/sites/default/files/2026-04/SDP%20SR2025%20%28Website%29.pdf

## Solution and how it works

Lepas Hujan treats each heavy storm as a test that the house passes or fails. It borrows from two fields:

- **Software teams close a bug when the failing test passes again,** not when someone says it is fixed. **Our read:** a leak is a test that the weather ran and the house failed, so the repair must pass the same test.
- **Building physics says the side facing the wind takes the rain.** Wind-driven rain "is the most important moisture source affecting the performance of building facades", and measurements show that "the windward facade is wetted whereas the other facades remain relatively dry". The rain on a wall is estimated as a coefficient × wind speed × rainfall intensity × cos θ, where θ is the angle between the wind and the direction the wall faces, but such methods "can only be used to obtain rough estimates" ([Blocken and Carmeliet][blocken]). ISO 15927-3 builds an index on this from hourly wind and rain, but its methods do not apply where more than 25% of annual rain comes from severe convective storms ([ISO 15927-3 scope][sis]). **Our read:** most heavy rain here comes in thunderstorms (47 of the 55 heavy-rain reports at Subang airport in 2025 came with thunder; [IEM], our count), so we use the relation only to say which side to check first, never as a measured load.

How it works:

1.  **Enrol first.** Each home is enrolled with its verified defect-period dates, taken from a named document, the owner or a nominated occupant who will answer, and the way its front faces, from SDP's layout plan or OpenStreetMap outlines.
1.  **Watch the rain and the wind.** For each phase, read the nearest JPS rain gauges: Paya Jaras, Rem KTM Sungai Buloh, Kampung Melayu Subang and Bukit Jelutong for Elmina, and Pekan Meru and Bandar Klang for Bandar Bukit Raja. Each reading keeps its station, time and window. Missing or stale data means "unknown", never zero rain. For the wind, the prototype reads the Subang airport station, WMSA, in the Iowa Environmental Mesonet's free METAR archive ([IEM][iem]); the pilot adds a weather station with a rain gauge and wind vane on an SDP building in the phase. If the wind during the rain was light, variable or swinging widely, the storm's side is "unclear".
1.  **Ask once per storm, side first.** When rainfall passes a pilot threshold, about 40 mm in 24 hours, or an operator approves an event, each home gets one prompt. Homes with a past leak repair are asked to look at that spot first. The prompt then names the side the rain came from in the home's own words, in Malay or English: "Last night's heavy rain came from the back of your house. Start with the upstairs back bedroom window" ("Hujan lebat semalam datang dari belakang rumah anda. Mulakan dengan tingkap bilik tidur belakang di tingkat atas"). In a terrace row only the front and back face the weather, so the side is usually one of the two. If the side is unclear, the prompt gives the full check. It never asks owners onto a ladder or into the roof space.
1.  **A short guided check.** The owner answers no visible damp, damp, leaking, unsure or not checked. A report records the room, surface and photo, and the owner reviews it before sending. If the damp also grows in dry weather, the report goes to plumbing triage instead. A dry answer is logged with the storm in the home's record, as the owner's observation, not a pass. The app shows "saved", "handed to SDP" and "SDP received" as separate steps.
1.  **Repair and water-test.** SDP's customer team triages the report, an inspector visits and a technical lead assigns the repair. The 30-day repair clock runs from SDP's receipt of written notice. Before the work order closes, the We Fix Team or the contractor water-tests the repaired spot, with someone inside watching, and records it on video: a hose from the leak's side for a wall, window or roof, or standing water on a flat porch roof. The repair is then "on test".
1.  **Let a storm like the first prove it.** Any later storm can reopen the repair. Only a storm with at least as much rain at the same gauge, and for a wall or window, wind from that side, can prove it. A hose can't raise the outside air pressure the way the ASTM E1105 field test does ([Intertek][e1105], _secondary_), and the publisher of the AAMA 501.2 hose check says it "is not intended to test the rated or specified water performance representative of a wind driven rain event" ([FGIA][aama]). So the hose catches a failed repair now, and the storm is the real test. After a qualifying storm, the owner sends one photo of the spot: dry marks the repair "held"; damp reopens it, with its history, to the technical lead. When two homes of the same type leak at the same spot, the technical lead gets a type alert to inspect every home of that type in the phase, while the contractor is still liable.
1.  **Close the gap.** In month 22, every owner gets one full-check reminder, even if no heavy rain has come.

**One rule:** storm data order checks and prove repairs. They never refuse a claim, and they never close a repair without a water test.

![Lepas Hujan workflow in four lanes: JPS rain gauges feed a storm record of rain, wind and wall side; the rain rule fires for enrolled homes, and each owner gets one prompt and check, side first; a dry answer is logged with the storm, not as a pass; damp or leaking creates a report with a photo, SDP triages and inspects within 30 days of notice, and the repair is water-tested; a later storm like the first decides with one photo whether the repair held or reopens with its history](/docs/images/shortlist/lepas-hujan-workflow.png)

The rough workflow above was redrawn with Archify on 17 October; the [shortlist page](https://claude.ai/artifact/DxMjV6PXEj7zUdXCzMPQ8W) links an interactive version.

**Two real storms.** JPS gauges ([JPS][jps rain]; our check on 17 October) and the Subang airport reports in the [IEM] archive, pulled on 17 October 2026, show both storms in local time:

| Storm           | Rain at the four gauges around Elmina                                                                   | Wind at Subang during the rain                                                                                                                                                   | Side to check first          |
| --------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| 13 October 2026 | 69.0 mm Kampung Melayu Subang, 48.0 mm Paya Jaras, 47.0 mm Rem KTM Sungai Buloh, 12.0 mm Bukit Jelutong | From 270° (west) at 9 knots in light thunderstorm rain at 18:00, swinging between 190° and 300°; variable at 5 knots in heavier rain at 18:15                                    | West-facing                  |
| 15 October 2026 | 52.0 mm Bukit Jelutong, 40.5 mm Rem KTM Sungai Buloh, 31.0 mm Paya Jaras, 19.0 mm Kampung Melayu Subang | From 220° (south-west) at 9 knots at 19:00 and 190° at 14 knots at 19:22; variable at 10 knots, gusting 24, in the heaviest rain at 19:30; from 180° (south) at 7 knots at 20:00 | South- and south-west-facing |

- **Our read:** a leak at a west wall on 13 October, with a dry 15 October, fits wind-driven rain getting in. A ceiling stain that grew on both nights, whatever the wind, points to the roof or the pipes instead.
- **The wind is a hint, not proof.** Subang airport is 4 to 11 km from the Elmina area mapped in OpenStreetMap (our measurement), and storm winds swing. In 2025 Subang reported heavy rain on 35 days, and on only 10 of them did any heavy-rain report show a wind of at least 5 knots that swung through less than 90° ([IEM]; our count). Rain is local too: on 13 October the four gauges ranged from 12.0 to 69.0 mm, and near midnight on 15 October heavy rain came again with a light north-east wind, so one day's total can mix storms. That is why the side only sets the order of the check, and the pilot measures rain and wind in the phase itself.

[sis]: https://www.sis.se/en/produkter/mathematics-natural-sciences/geology-meteorology-hydrology/sseniso1592732009/

## Why it's new

| Closest analogue                                                                                            | What it does                                                                                                                     | What it lacks                                                                            |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| US EPA Construction General Permit ([EPA][epa])                                                             | Requires a site inspection "within 24 hours once a storm event has produced 0.25 inches of rain"                                 | Construction sites, not homes                                                            |
| RainCheck, US software ([RainCheck][raincheck])                                                             | Hourly rainfall checks per site; creates an inspection deadline at the threshold                                                 | Contractors' stormwater compliance                                                       |
| USAA, US insurer ([USAA][usaa])                                                                             | Texts members about coming storms and claims                                                                                     | Disasters and insurance, not warranty                                                    |
| Sekisui House's disaster-visit app, Japan ([Sekisui House][sekisui], _excerpt_)                             | Staff check owners' homes after earthquakes and typhoons                                                                         | Disaster-level, staff-run                                                                |
| Trinity Group's Gold Assurance Programme, Malaysia ([Trinity][trinity])                                     | A "36-Months Defects Liability Period" and a "10-Years Warranty for Roof Leaks", on two flagship high-rise projects              | Longer cover, but someone still has to notice the leak, and nothing proves a repair held |
| Defect reporting in the SDP App ([SDP App FAQ][sdp faq]) and Gamuda Land's app ([Gamuda][gll], _excerpt_)   | Owners report defects whenever they notice them                                                                                  | No prompt at the moment leaks appear, and no storm-based proof                           |
| Software regression tests                                                                                   | A fix closes only when the failing test passes                                                                                   | Not used for building leaks, as far as we found                                          |
| Field water tests: ASTM E1105 ([Intertek][e1105], _secondary_) and the AAMA 501.2 hose check ([FGIA][aama]) | Spray installed windows and walls to find leaks; E1105 also raises the outside air pressure                                      | One-off tests, not tied to the storm that caused a leak                                  |
| QLASSIC, CIDB's quality assessment ([CIS 7:2021][cis7])                                                     | Scores a sample of units "upon completion of the building project and before the handover"; its only water test is for wet areas | Stops at handover, and never tests a repair                                              |

- **We found no developer, snagging app or insurer that asks homeowners to check for defects when it rains,** in Malaysia or abroad. In searches on 17 October 2026 we also found no developer, warranty or insurer that closes leak repairs by storm.
- **Our read:** the closest precedent we found is informal: a 2015 customer review of a New Zealand roofer who "followed up after next rain to check on leak fix" ([Builderscrack][nz]). Leak investigators work the same way: they ask when and in what weather a home leaked, then reproduce the leak with water. ASTM E2128 sets out such methods "for determining and evaluating causes of water leakage of exterior walls" ([ASTM][e2128]). Lepas Hujan makes that routine for every leak repair in a phase, and lets the gauges say when the house has been tested again.
- **Our read:** innovation 4. Rain-triggered inspections exist abroad, but only for construction sites, insurers and disasters. The new part is pairing the trigger with the warranty clock and proving each repair under a storm like the one that broke it. SDP's app already exports cases and shows before-and-after photos, so those are not the innovation.

[epa]: https://www.epa.gov/npdes/construction-general-permit-cgp-frequent-questions
[raincheck]: https://www.raincheckhq.com/resources/rain-event-inspections
[usaa]: https://www.usaa.com/support/insurance/claims/natural-disaster/
[sekisui]: http://web.archive.org/web/20240423112544/https://www.sekisuihouse.co.jp/company/sustainable2020/social/valuechain/activity5/act_11/
[trinity]: https://www.trinitygroup.com.my/news/trinity-group-launches-malaysias-first-gold-assurance-programme-malaysian-business/
[sdp faq]: https://www.simedarbyproperty.com/app/faq.html
[gll]: https://www.gamudaland.com.my/gl-lifestyle
[cis7]: https://www.cream.my/data/cms/files/CIS7%202021.pdf
[nz]: https://builderscrack.co.nz/trades/roofers/wellington/jobs/97905/roof-leak
[e2128]: https://store.astm.org/e2128-26.html

## Impact and how we measure it

- **Primary outcome: repeat leaks.** The share of leak repairs that leak again, for repairs that were water-tested and storm-checked against ordinary closures. Alongside it: the share of repairs marked "held", and the days from report to a repair that held.
- **Detection:** confirmed new leak reports per enrolled home, rain prompts against calendar prompts. Longer-term, the share of all leaks caught inside the defect period, counting leaks reported up to 12 months after it ends.
- **Repair follow-up:** completed post-rain checks per repair due for one, and recurrences assessed against those still unverified.
- **Speed:** days from SDP's receipt of the report to inspection.
- **Design learning:** rainfall at each leak, by house type, is a later technical study, not a pilot claim.
- **After the period:** leak complaints and Tribunal claims in the 12 months after the defect period ends, when claims of up to RM50,000 can still be filed ([Thomas Philip][tribunal]).
- **Baseline:** SDP's defect logs for the comparison phase, including the share of leak repairs it reopens, which we must ask SDP for, and interviews with owners of phases handed over in 2024 and 2025.

[tribunal]: https://www.thomasphilip.com.my/articles/what-you-need-to-know-about-homebuyerrs-tribunal/

## Fit with Sime Darby Property

- **Pillars:** Community Experience, where SDP's customer net promoter score was 88% in FY2025 ([CONTEXT]), and Climate Resilience, whose 2030 target is "Adaptation and resilience plans for high-risk assets" ([CONTEXT]). Rain-tagged leak reports show the rainfall at which each house type fails, which is the evidence such a plan needs for homes facing heavier rain.
- **SDP's own aim:** its contact centre "has strengthened a proactive quality and defect management … This has helped identify recurring defects, reduce rework" ([SR2025] p. 46). Lepas Hujan gives that work a rainfall trigger.
- **SDP's own risk list:** SDP names "Additional cost for rectification/replacement, compensation" and "claims, disputes or legal action from purchasers" as impacts of its project-delivery risk. Its mitigations include "Monitor and track the status of defect claims by purchasers to ensure timely closure" and a "We Fix Team" for newly handed-over projects ([IAR2025] p. 130). It also tracks the "Number of defect issues upon project completion" and the "Volume of complaints overall" ([IAR2025] p. 51). Lepas Hujan gives the We Fix Team a test to close each leak repair against and a storm to prove it, and each repeat leak it prevents is one fewer in both numbers.
- **Value to two sides:** owners get leaks fixed for good while the period covers them, instead of paying after it ends. SDP gets fewer repeat visits, defects fixed while the original contractor is still liable, dated evidence if a latent-defect claim comes after month 24, fewer disputes after the period and, later, storm records to price an extended roof-leak warranty.
- **Scale:** every SDP handover, starting with landed homes (2,346 units delivered in FY2024 and 3,440 in FY2023, all types), then strata units, then other townships.

[CONTEXT]: /docs/CONTEXT.md

## Pilot

| Element       | Plan                                                                                                                                                                                                                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Where         | One City of Elmina landed phase between months 6 and 24 after handover, with a consented cohort sized to SDP's inspection capacity. Half get rain prompts and repairs proven by storms; half get calendar prompts and ordinary closures                                                                            |
| Owner         | One accountable township customer experience lead, with a technical lead, the We Fix Team for water tests and the SDP App team                                                                                                                                                                                     |
| Duration      | Six months, across the northeast monsoon from November to March                                                                                                                                                                                                                                                    |
| Cost          | App work and push messages. Rain and airport wind data are free. One weather station with a rain gauge and wind vane on an SDP building in the phase (price to check). Water tests add technician time to each leak repair. Extra repairs inside the period fall on contractors under their contracts (to confirm) |
| Approvals     | SDP alone. Owners consent to photos under the PDPA, and to each water test in their home. SDP legal decides whether an in-app report counts as written notice                                                                                                                                                      |
| Success       | Fewer repeat leaks than ordinary closures, and more confirmed leak reports and completed repair rechecks than calendar prompts, within a staff workload agreed first                                                                                                                                               |
| Decision gate | If met, add it to every landed handover, then strata units                                                                                                                                                                                                                                                         |
| Risks         | Prompt fatigue: cap prompts at the threshold. Few leaks in a dry season: count "dry" answers as storm passes. Fear of more claims: SDP is liable for these defects anyway                                                                                                                                          |

## Prototype by 23 October

- **What it is:** a web app that stands in for the SDP App, built with React and Supabase. The solution vet rated it buildable in 7 days, with a manual SDP hand-off and a recorded rain replay.
- **Software components:**
  - Enrolment and case import: one consented, redacted case export from an owner, with key fields entered by hand, and the way each home faces.
  - Rain record and event rule: a saved, source-linked JPS reading; a server-side reader only if access is confirmed. One prompt per home per event.
  - Storm record: each storm's JPS readings and Subang wind, with its side or "unclear".
  - Side-first prompt, guided check and private photo storage: the prompt in the home's own words; rows and files limited to the owner's own home.
  - Hand-off record: a printable evidence summary; "SDP received" is entered by staff and marked simulated in the demo.
  - Staff queue: triage, inspection, access slot, repair, water-test record and storm proof, with each recurrence linked to its original item and a type alert for repeated spots.
- **Cut from the build:** a live SDP App link, the Telegram message (the demo shows the in-app prompt), leak sensors, house-type prediction, automatic batch repairs and a 3D model.
- **Real data:** JPS gauges near Elmina and a replay of the 13 and 15 October 2026 storms; Subang's hourly wind and weather codes from the [IEM] archive, already pulled for October 2026 and all of 2025; OpenStreetMap outlines, 2,280 buildings in Elmina, 607 of them tagged as terraces (our count on 17 October); and one consented owner case if obtained.
- **Labelled simulation:** test owners, SDP's side of the flow, the water-test record and the replayed storms, clearly marked in the demo.
- **The demo moment:** the two real storms replay over one Elmina street drawn from OpenStreetMap. On 13 October the gauges light up from 12.0 to 69.0 mm and the Subang wind swings west, so homes whose backs face west start at the back. A test owner reports damp under the upstairs back window; the repair is water-tested from the back, and the work order closes with the repair "on test". Then 15 October replays: the owner answers "dry", but the app says the storm doesn't count, because it brought 40.5 mm to the Rem KTM Sungai Buloh gauge against 47.0 mm on 13 October, with the wind from the south. That refusal is the moment to remember. The video ends on the pilot's own rain gauge and wind vane.
- **Build plan:** days 1 to 2 save the JPS page on 17 October (it shows only the last six days, so 13 October drops off around 20 October), pull the Subang wind, secure one case and test the prompt wording with owners; days 3 to 4 the check, evidence, staff queue, recurrence link, storm record and proof rule; day 5 test with owners and a defect practitioner; days 6 to 7 deck and video.
- **Pass checks:** replaying an event twice sends one prompt; a failed hand-off never shows "SDP received"; a recurrence keeps the original history; one household can't open another's photos; a work order can't close without a water-test record; a lighter storm, or one with the wind from another side, can't mark a wall or window repair "held"; storm data never change a claim to rejected.
- **Evidence before submission:**
  - Interview ten owners of Elmina homes handed over in 2024 and 2025, including leak-free homes: when they found leaks, whether after rain, and whether inside the period. Add two questions: did a leak come back after a repair, and after which storm, at which side of the house? Show five of them the prompt and count how many walk to the right spot.
  - For each dated leak, look up that day's gauge rain and Subang wind, and check whether the leaking side faced the wind. Five cases, whichever way they go, make a striking slide; expect some to have no clear side.
  - Ask SDP what share of leak reports arrive after the period ends, and what share of leak repairs it reopens.
  - Ask one We Fix technician or contractor how leak repairs are signed off today, and whether they are water-tested.

## Scorecard

**Rank 1 of 8** in the merged ranking, with a mean judge score of 74.0 out of 100. It drops to fifth if strategic fit counts for 50% ([ranking](/docs/archive/ideas/0000-ranking.md#pass-2-round-10-rank-and-stress-test)). The judges are AI agents playing SDP roles, scoring the draft against the [judging matrix](/docs/archive/ideas/0000-ranking.md#judging-matrix).

| Scorer                  | Impact | Innovation | Feasibility | Fit | Commercial | Evidence | Weighted |
| ----------------------- | ------ | ---------- | ----------- | --- | ---------- | -------- | -------- |
| Author (round 9)        | 3      | 4          | 5           | 4   | 4          | 3        | 77       |
| SDP sustainability head | 3      | 4          | 5           | 3   | 4          | 4        | 76       |
| SDP township manager    | 3      | 4          | 4           | 3   | 4          | 3        | 70       |
| Innovation mentor       | 3      | 4          | 5           | 3   | 4          | 4        | 76       |

- **Biggest weakness:** nobody knows how many leaks surface after the defect period, and all three judges called the climate label a stretch for what is defect management.
- **The change that would raise it most:** one real figure for the share of leaks first reported after month 24, from SDP's defect log or from ten owner interviews. Then lead with leaks caught inside the period out of all leaks, and with rainfall at each leak as a design standard. Both are folded in above.
- **The only idea all three judges scored 4 on innovation.** All three also said owners would use it repeatedly: it is "one tap, tied to the owner's own money and a deadline".

Our expert roast on 17 October 2026, by simulated consultants on Codex gpt-6-astra (xhigh), scored it lower. The 17 October panel then scored the revised doc on Claude Opus 5.5, a different judge model from rounds 3 to 5 and from the round 9 judges above, so its row is not strictly comparable with theirs:

| Scorer                            | Impact | Innovation | Feasibility | Fit | Commercial | Evidence | Weighted |
| --------------------------------- | -----: | ---------: | ----------: | --: | ---------: | -------: | -------: |
| Judging panel, round 5            |      2 |          3 |           4 |   3 |          2 |        2 |       55 |
| Judging panel, 17 October         |    4.0 |        4.0 |         3.7 | 4.0 |        4.0 |      3.7 |     78.0 |
| Judging panel, 17 October (Codex) |    4.0 |        4.0 |         3.7 | 4.7 |        4.0 |      4.0 |     80.7 |

- **Experts:** a developer's defect manager and a building surveyor both said "wounded, back it with fixes"; no fatal attacks.
- **Their main points:** late discovery of leaks is not yet quantified, more reports don't prove better repairs, and rainfall data doesn't become a design standard. Pitch it under People, and drop 3D.
- **Solution vet, 17 October:** a developer's customer experience and defect-management head said "needs changes", nothing fatal. The top fix is to make the post-rain recheck a separate status on the original defect, so a recurrence returns to a named technical lead. All its workflow and build changes are folded in above.
- **The brainstorm's guess, 17 October:** innovation 3 → 4; impact 2 → 3, because repeat repairs are a cost SDP already names ("identify recurring defects, reduce rework", quoted in [Fit](#fit-with-sime-darby-property)); commercial 2 → 3, because the RM4.8 million case shows the exposure; evidence 2 → 3 with the storm replay and interviews; feasibility stays at 4. A guess against the judging matrix, not a panel score.
- **Specialist vet, 17 October (second):** a simulated building-envelope and waterproofing engineer on Claude Opus 5.5, with experience of defect-liability leak claims for Malaysian landed developers, said "needs changes", nothing fatal. The top fix is to stop airport wind from deciding anything: Subang's wind in heavy rain was steady on only 10 of its 35 heavy-rain days in 2025, so the side now only orders the owner's check, a recorded water test closes each repair, and a storm with at least as much rain, and wind from that side measured in the phase, proves it. It also put the prompt in the home's own words, cut the leak sensor, named QLASSIC and leak investigation as the closest practice, and built the demo around a storm that doesn't count. It expects feasibility to hold at 4 and evidence, impact and fit to gain most.
- **Judging panel, 17 October:** the sustainability head, township manager and innovation mentor scored the revised doc 76, 80 and 78, and each ranked it first of the three. Weaknesses: its impact rests on figures the team lacks, how often leak repairs fail today and how many leaks surface after month 24 (sustainability head and township manager); and the same-side proof leans on airport wind that held steady on only 10 of 35 heavy-rain days in 2025, while both demo storms turned variable in their heaviest rain, which the doc's own rule calls "unclear" (mentor). Top changes: count a repeat-leak rate across the ten owner interviews before 23 October, or get it from SDP's defect logs (sustainability head and township manager, impact 4 to 5); and make rain at the same gauge the only proof test, use wind only to order the check, and mark the demo storms "unclear" where the rule says so (mentor, evidence 3 to 4).

The **Judging panel, 17 October (Codex)** below ran on **Codex gpt-6-astra (xhigh)**, the same model family as rounds 3 to 5, and assessed the documents **after a second revision of Safe Edge and the Site breeding register**. Its three judges scored alone from copies with prior scores removed. The weighted mean uses unrounded criterion means; displayed means are rounded to one decimal.

- **Judging panel, 17 October (Codex):** **All three judges’ biggest weakness:** equal-or-higher rain totals and same-side wind do not establish equivalent exposure at the repaired spot, so a dry photo cannot yet substantiate a proven repair. **Sustainability head’s top change:** validate the rule on five consented repaired homes with a technician and local measurements, reporting observed dryness until durability is supported. **Township general manager’s top change:** obtain a We Fix-approved acceptance protocol defining comparable exposure and follow-up checks. **Innovation mentor’s top change:** validate the rule against a real repaired leak with a building-envelope specialist and retain an inconclusive status where exposure is insufficient.

## Risks and open questions

- **How many leaks surface after the period?** We found no figure. It decides how big the impact is, and only SDP has it.
- **Will owners answer?** Prompts are occasional and driven by the warranty deadline, not habit. Most answers will be "dry".
- **Does the defect flow work?** An App Store review from December 2025 says: "Cannot submit defect report… it has been two months and it is still not working" ([App Store][appstore]). The prompt is only as good as the form behind it.
- **Is a tap written notice?** If not, the app must send a formal notice for the owner.
- **"Airport wind isn't the wind on my street, and the ISO method excludes your climate."** Both true. Subang had a steady wind in heavy rain on only 10 of its 35 heavy-rain days in 2025 ([IEM]; our count). So the side only orders the check; it never removes a spot, and it never proves a repair alone. The pilot's own wind vane decides proof, and owner reports test the side.
- **"Owners don't know which way their house faces."** The prompt never uses compass points. It says front, back or side, and names rooms from the house-type plan.
- **"Waiting for a storm delays closure."** It doesn't. The repair happens inside SDP's 30-day clock, and the work order closes after the water test. Only the "held" mark waits for a storm.
- **"A water test can soak a room if the repair failed."** Someone watches inside, and the test stops at the first drip. The owner agrees to each test.
- **"An 'on test' status keeps SDP's liability open."** SDP stays liable for latent defects after month 24 anyway ([Malaysian Bar][bar]), and the test adds evidence on SDP's side. SDP's lawyers decide.
- **The killer question:** "Why pay to find more defects during the defect period?" Because SDP is liable for them anyway, after the period too, and finding them early makes the original contractor fix them.

[appstore]: https://apps.apple.com/my/app/sime-darby-property-app/id6474657954

## Other directions considered

The 17 October brainstorm explored these directions, each borrowed from another field. The verdicts show where each stands now.

| Direction                      | What it does                                                                        | Borrowed from                                                                     | Verdict                                                                                                    |
| ------------------------------ | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Repair proven by a storm       | A repair closes only after a storm at least as strong, on the same wall, passes dry | Software regression tests                                                         | **In the solution:** a storm like the first proves the repair; a water test closes the work order          |
| Wall-by-wall storm fingerprint | Rank the driving rain on each wall from gauge rain and airport wind                 | The wind-driven-rain relation ([Blocken and Carmeliet][blocken])                  | **In the solution, as a hint:** the side only sets the order of the check                                  |
| Repair sensor                  | A leak sensor left at the repaired spot reports the next storm                      | Consumer leak sensors                                                             | Cut: each one needs a hub in the home and two extra visits, and the owner's photo does the job (see below) |
| Storm-matched water test       | Spray the repaired spot from the storm's direction before closing                   | The ASTM E1105 field water test                                                   | **In the solution:** for every leak repair, before the work order closes                                   |
| Type alert                     | Same spot, same house type, same storm: inspect every home of that type             | Product recalls (our analogy)                                                     | **In the solution**                                                                                        |
| Storm record                   | Log every storm a home passes dry; the owner can download it                        | A car's service history (our analogy)                                             | **In the solution,** as the home's record; the download is cut from the prototype                          |
| Rain-correlation triage        | If the damp also grew on dry days, it's a pipe, not the roof                        | Fault diagnosis                                                                   | **In the solution:** cheap                                                                                 |
| Repeat photos                  | Re-shoot handover photos of leak-prone spots after storms; flag new stains          | Repeat photography in field science                                               | Park: accuracy unknown                                                                                     |
| Check-to-extend warranty       | Owners who complete storm checks earn longer roof-leak cover                        | Trinity's 10-year and HDB's 5-year leak warranties                                | Park: a business model for a second phase                                                                  |
| Storm test before keys         | Spray-test a sample of each house type before handover                              | ASTM E1105; SDP's full-scale mock-up home at Innovation Park ([SDP][sdp mock-up]) | Park: a construction QA change                                                                             |
| Empty-home checks              | A vetted neighbour checks absent owners' homes after storms                         | Our archived Rumah Dijaga ([ranking][rumah dijaga])                               | Park: it scored 52 and had no demand evidence                                                              |
| Sensors in every home          | Moisture sensors throughout the house                                               | Smart-home kits                                                                   | Reject: sensors only see water that reaches them ([defects])                                               |
| House-type prediction          | Machine learning on leak history                                                    | None                                                                              | Reject for now: no labels, and the solution vet cut it                                                     |

- **Why the repair sensor was cut:** TP-Link's Tapo T300 has six probes, a 90 dB siren, app alerts and AAA batteries, and it needs a Tapo hub. It is rated for 0 to 40 °C ([TP-Link Malaysia][tapo]). **Our read:** a roof space under afternoon sun may run hotter than that, the probes only see water that lands on them, and fitting and collecting each sensor means two extra visits. A dry photo after a qualifying storm does the same job.

**Cheaper twists.** The brainstorm also listed four cheaper twists for the earlier design. All four are now part of the solution, and together they are the fallback if the full build runs late:

- Open the problem slide with the court's ruling on latent defects and the seepage complaints, tactfully.
- Add the side-of-house line to the prompt.
- Add rain-correlation triage: if the damp grew on dry days, route the report as plumbing.
- Log each storm a home came through dry in its record.

[sdp mock-up]: /docs/research/landscape/sime-darby-property.md#technology-sdp-already-offers-residents
[rumah dijaga]: /docs/archive/ideas/0000-ranking.md#ranking
[defects]: /docs/research/niche-problems/screens/defect-leaks.md
[tapo]: https://www.tp-link.com/my/smart-home/smart-sensor/tapo-t300/

## How the idea changed across rounds

- **Round 1:** proposed as "Rain-Check" by the SDP township manager persona.
- **Round 3:** second on the author's score, with feasibility 5.
- **Round 4:** research found no weather-triggered warranty check anywhere, so innovation rose to 4. A US product already uses the name RainCheck, so it was renamed.
- **Round 6:** a check against gauges showed modelled rain missed both storms near Elmina in October, so the trigger moved to JPS gauges. Research found Trinity Group's 10-year roof-leak warranty, the closest Malaysian offer.
- **Round 8:** asked "Why not just copy Trinity's warranty?" Because a warranty only pays if someone notices the leak; rain-tagged reports by house type are also the data SDP would need to price its own extended warranty.
- **Round 9:** judges scored it 70 to 76, the highest mean of the eight. Their critique moved the headline outcome to the share of all leaks caught inside the period, and the fit to design standards for heavier rain.
- **Solution vet:** "one tap files a defect" became a guided check with an honest hand-off, the repair recheck became the core, and house-type learning moved to a later study.
- **Brainstorm, 17 October:** borrowing from software regression tests and wind-driven-rain physics, the repair recheck became a storm test. A repair would close only after a storm at least as strong, blowing at the same wall, left the spot dry, and each prompt would name the walls that took the rain.
- **Specialist vet, 17 October (second):** a waterproofing engineer found airport wind too unsteady to decide anything, so a recorded water test now closes each repair, a storm like the first proves it, the wind only orders the owner's check, and the leak sensor was cut.

[bar]: https://www.malaysianbar.org.my/cms/upload_files/document/Circular%20No%20108-2026.pdf
[blocken]: https://aecb.net/wp-content/uploads/2024/11/Blocken_Carmeliet_A-review-of-wind-driven-rain-research-in-building-science-2.pdf
[iem]: https://mesonet.agron.iastate.edu/sites/networks.php?network=MY__ASOS
[e1105]: https://intertek.com/building/standards/astm-e1105-15
[aama]: https://store.fgiaonline.org/AAMA-501.2-03/
[jps rain]: https://publicinfobanjir.water.gov.my/wp-content/themes/shapely/agency/searchresultrainfall.php?state=SEL&district=ALL&station=ALL&lang=en&loginStatus=0
[IAR2025]: https://www.simedarbyproperty.com/sites/default/files/2026-04/SDP%20IAR2025%20Mobile.pdf
