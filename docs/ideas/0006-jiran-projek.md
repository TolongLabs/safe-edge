# Jiran Projek

"We help City of Elmina residents who live next to Sime Darby Property's building sites see the dust, noise and mosquito breeding those sites cause, and get it fixed." Paired sensors on the site boundary, a one-tap report and weekly mosquito-egg counts feed a monthly grade for each site in SDP's contractor scorecard. _Jiran projek_ is Malay for "the project next door".

**Track:** People, community wellbeing. **Rank:** see the [ranking](0000-ranking.md).

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

- **Elmina residents will live next to construction for years.** SDP has "built and handed over 12,800 residential units" in City of Elmina. "About 1,780 acres, primarily in Elmina West and Elmina Business Park, remain undeveloped", with completion "by 2040" ([The Edge][edge], _secondary_).
- **Neighbours already object.** A petition by Ilham Residence residents in Elmina East, April 2025, says "The development introduces dust, noise, and vehicle emissions" and "Slope cutting and land reshaping raise fears of landslides" ([Change.org][petition]).
- **Dengue is surging, and building sites breed it.**
  - Selangor had 31,782 cases by week 40 of 2026, "peningkatan sebanyak 72.6%" (up 72.6%) on 2025, with 31 deaths against 6. Petaling district, which includes Elmina, rose 79.2% ([JKN Selangor][jkns40]).
  - A building site in Kwasa Damansara, Shah Alam, was a hotspot with 10 cases ([JKN Selangor][jkns40]).
  - In Singapore, dengue clusters near building sites had 3.3 to 17.4 times the odds of becoming major clusters, and most cases were residents living nearby ([PMC][sg sites]).
- **Without data, developers lose the argument.** Near Johor's new data centres, families blamed dust for children's coughs. One developer said it was "highly unlikely that dust pollution originated from our development", and the report found no official monitoring data either way ([Asia News Network][johor]). SDP is building a hyperscale data centre in Elmina ([CONTEXT]).
- **Today's monitoring is invisible to residents.** Environmental approvals for large housing projects require "quarterly environmental monitoring reports for ambient air quality … and noise level measurements at the boundary of project site" ([Global Green][emr], _secondary_). Those reports go to regulators, not to the people next door.

[edge]: https://theedgemalaysia.com/node/734822
[petition]: https://www.change.org/p/resident-petition-summary-ilham-residence-regarding-undisclosed-interchange-construction
[jkns40]: https://jknselangor.moh.gov.my/images/2026/denggi/ME40_26.pdf
[sg sites]: https://pmc.ncbi.nlm.nih.gov/articles/PMC13274206/
[johor]: https://asianews.network/whatll-become-of-our-village-residents-in-malaysias-johor-choke-on-dust-noise-as-data-centres-move-in-next-door/
[CONTEXT]: /docs/CONTEXT.md
[emr]: https://globalgreen.my/gg-consultant/environmental-monitoring-reporting-emr/

## Target user

- **Primary:** residents of occupied City of Elmina phases that border an active SDP building site.
- **Secondary:** SDP's project delivery and health, safety, security and environment (HSSE) teams, and the main contractors they score.

## Solution and how it works

1.  **Measure both sides of the fence.** Put a low-cost dust (PM10) and noise node upwind of the site and another downwind, at the boundary with homes. Scoring the difference, not the absolute level, separates the site's dust from haze: Shah Alam read 172 on aqicn's air-quality index on 16 October 2026, during the haze ([aqicn][aqicn]).
2.  **Report in one tap.** A resident taps "dust", "noise", "lorries" or "standing water" in the community app. Each report attaches the sensor readings and wind direction at that minute, so the contractor can't wave it away and SDP can show when it was someone else's dust.
3.  **Count mosquito eggs on SDP's land.** Ovitraps along the site boundary and on unsold plots are serviced weekly by the pest control operator Selangor already requires developers to appoint ([Selangor State Assembly][dun aedes]). The street next door gets one weekly message, for example "Egg count rising by your fence: tip standing water this Friday."
4.  **Grade each site monthly.** Dust hours above the action level, noise outside permitted hours, reports resolved within 7 days, and breeding sites found and cleared feed a grade in SDP's existing contractor scorecard. Residents see the grade for the site next door.

[aqicn]: https://aqicn.org/network/my.apims/
[dun aedes]: https://dewan.selangor.gov.my/question/pembiakan-nyamuk-aedes/

## Why it's new

| Closest analogue                                                              | What it does                                                                         | What it lacks                                     |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------- |
| UK Considerate Constructors Scheme ([CCS][ccs])                               | Scores sites out of 100%; "over 270 concerns or comments from the public each month" | Inspector visits, not live sensors; no mosquitoes |
| Hong Kong's Considerate Contractors Site Award ([HK government][hk])          | Awards sites; 417 took part in 2024                                                  | An award, not a monthly grade residents can see   |
| Singapore's construction noise meters ([MSE][mse])                            | Sites within 150 m of homes log noise "at five-minute intervals" for the regulator   | Regulator-facing                                  |
| SiteHive's public view, Melbourne's Suburban Rail Loop ([SiteHive][sitehive]) | Live dust and noise graphs for neighbours                                            | No resident reports or scorecard link             |
| Singapore's Gravitrap network ([NEA][nea])                                    | About 72,000 traps; residents in high-count areas are notified                       | Run by the state, not tied to building sites      |
| Malaysian monitoring products, such as AIS NoiseLYNK ([AIS][ais])             | Text alerts to the contractor when noise passes limits                               | Contractor-facing                                 |

- **We found no resident-facing or scored scheme for building sites in Malaysia,** and none at SDP.
- **Our read:** innovation 3, possibly 2, because contractor-facing and regulatory monitoring already exist here. The new part is one grade that joins dust, noise and mosquito breeding at the fence line, with readings attached to every complaint.

[ccs]: https://www.considerateconstructors.com/for-the-public/
[hk]: https://www.info.gov.hk/gia/general/202408/30/P2024083000522.htm
[mse]: https://www.mse.gov.sg/latest-news/written-reply-to-parliamentary-question-on-noise-monitoring-protocols-of-construction-sites/
[sitehive]: https://sitehive.com/resources/blog-keeping-stakeholders-informed-in-construction
[nea]: https://www.nea.gov.sg/dengue-zika/Aedes
[ais]: https://aisys.com.my/product/ais-noiselynk-noise-monitoring-system-for-construction-sites/

## Impact and how we measure it

- **Primary outcome:** breeding sites found and cleared on SDP land each month, and the trend in boundary egg counts. A trap trial in Malaysia found "no difference between the number of cases" ([BMC Infectious Diseases][gos]), so we measure breeding, not cases.
- **Dust:** hours each month when downwind PM10 exceeds upwind by more than an action level. The UK's air-quality institute suggests 190 µg/m³ over one hour for sites ([IAQM][iaqm]).
- **Noise:** minutes above the Department of Environment's residential guideline, 75 dBA by day and 70 dBA at night ([DOE][doe noise]).
- **Response:** share of resident reports resolved within 7 days.
- **Baseline:** the first month of readings. **Comparison:** another site boundary without the scheme.

[gos]: https://bmcinfectdis.biomedcentral.com/articles/10.1186/s12879-018-3311-6
[iaqm]: https://www.ioa.org.uk/news/IAQM-publishes-Position-Statement-on-the-use-of-low-cost-sensor-systems-for-PM10
[doe noise]: https://www.doe.gov.my/wp-content/uploads/2021/10/Guidelines-Noise-2019-Rev-3-ARK-V5-FINAL-1.4.2020-2-with-cover.pdf

## Fit with Sime Darby Property

- **Pillar:** Community Experience. SDP managed "138 projects and 70 contractors" in 2025 ([SR2025], PDF page 112) and logged "8,810 contractor touchpoints" ([SR2025]). Jiran Projek puts the neighbours' view into that scorecard.
- **Admitted gap:** construction was 52% of SDP's water use, including "earthworks, dust suppression" ([SR2025], PDF page 86), so dust is already a managed cost.
- **Value to two sides:** residents get a channel that works and evidence they can trust. SDP gets early warning on its contractors, proof when the dust is haze or another builder's, and calmer early phases while it sells later ones.
- **Scale:** every SDP site that borders occupied homes, in all 28 townships.

[SR2025]: https://www.simedarbyproperty.com/sites/default/files/2026-04/SDP%20SR2025%20%28Website%29.pdf

## Pilot

| Element       | Plan                                                                                                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Where         | One boundary between an occupied phase and an active Elmina West site                                                                                                                            |
| Owner         | SDP project delivery and HSSE, with the township team                                                                                                                                            |
| Duration      | Three months                                                                                                                                                                                     |
| Cost          | Sensor nodes (a PMS5003 dust sensor is USD 39.95 ([Adafruit][pms])), microcontrollers, data plans, a rented reference monitor to calibrate, ovitraps. The pest control operator is already paid  |
| Approvals     | SDP and its main contractor, by a contract clause. The council only if nodes sit on the road reserve. The district health office to share counts. PDPA consent for reports                       |
| Success       | Breeding sites found and cleared, fewer dust hours above the action level, and reports resolved within 7 days                                                                                    |
| Decision gate | If met, add the clause to every new construction package next to occupied homes                                                                                                                  |
| Risks         | Low-cost sensors misread heavy dust: calibrate and use them as triggers. Unserviced traps breed mosquitoes: weekly servicing by the operator. Naming contractors: publish a grade per site first |

[pms]: https://www.adafruit.com/product/3686

## Prototype by 23 October

- **Build:** two nodes (a dust sensor and a microphone on a microcontroller), placed upwind and downwind of an active Elmina or Denai Alam site for three to five days, with the readings checked against DOE's Shah Alam station; a one-tap report form; a dashboard with the grade.
- **Ask first:** SDP's HSSE team's permission to place the nodes and ovitraps on one real SDP site boundary.
- **Data:**
  - Our own nodes.
  - Hourly wind and modelled PM10 from Open-Meteo, and DOE's APIMS readings for Shah Alam.
  - JKN Selangor's weekly dengue reports, parsed for hotspots.
  - 10 to 20 DIY ovitraps for one week.
- **Evidence before submission:** interview residents beside the site about the last time dust, noise or lorries bothered them, and whether they complained and to whom.

## Scorecard

**Rank 3 of 8** in the merged ranking, with a mean judge score of 69.3 out of 100 ([ranking](0000-ranking.md#pass-2-round-10-rank-and-stress-test)). The judges are AI agents playing SDP roles, scoring the draft against the [judging matrix](0000-ranking.md#judging-matrix).

| Scorer                  | Impact | Innovation | Feasibility | Fit | Commercial | Evidence | Weighted |
| ----------------------- | ------ | ---------- | ----------- | --- | ---------- | -------- | -------- |
| Author (round 9)        | 3      | 3          | 4           | 3   | 3          | 3        | 64       |
| SDP sustainability head | 3      | 3          | 4           | 3   | 3          | 4        | 66       |
| SDP township manager    | 3      | 3          | 4           | 4   | 4          | 4        | 71       |
| Innovation mentor       | 3      | 3          | 4           | 4   | 4          | 4        | 71       |

- **Biggest weakness:** SDP's project delivery and HSSE teams must agree to publish a grade, and low-cost dust sensors are shaky in humid, hazy air.
- **The change that would raise it most:** a real three-to-five-day paired trace at an SDP site boundary, checked against DOE's Shah Alam station, with an HSSE contact who has agreed to the pilot. Both are folded into the prototype above.
- **All three judges said residents would use it repeatedly:** "A one-tap report with readings attached is less effort than a petition." The township manager ranked it second of eight.

## Risks and open questions

- **No complaint count.** We found no MBSA or MBDK count of construction complaints at Elmina. The pilot's first month creates the baseline.
- **Will residents use it?** People report only when disturbed. Repeat use comes from the weekly egg message and the monthly grade, not the report button.
- **The killer question:** "Why hand residents ammunition when we already comply?" Because the readings are already collected for regulators, residents petition anyway, and paired sensors let SDP prove when the dust isn't its own.

## How the idea changed across rounds

- **Round 1:** seeded from the analogy with the UK's Considerate Constructors Scheme.
- **Round 4:** research found Malaysian monitoring is contractor-facing only, and that Singapore already alerts residents from trap counts. The separate "Tip-It Friday" idea, ovitraps counted by SDP's crews, merged in as the mosquito metric.
- **Round 4:** the haze made absolute dust thresholds useless, so scoring moved to downwind minus upwind.
- **Round 8:** asked "Why hand residents ammunition?" Changed to publish a grade per site before naming any contractor.
- **Round 9:** judges scored it 66 to 71. Their critique added a check against DOE's station and HSSE permission for a real boundary to the prototype.
