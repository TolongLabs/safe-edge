# Kolam Sedia

"We help Sime Darby Property's Bandar Bukit Raja team keep its flood ponds empty and flowing before the rain comes, and prove it after." Cheap water-level sensors catch blocked outlets, and a tide-aware rule sets how low the ponds sit through the monsoon. _Kolam sedia_ is Malay for "ready pond".

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

- **Bandar Bukit Raja keeps flooding:**
  - Water reached 3 m in December 2021 ([FMT][fmt may], _secondary_).
  - In June 2023 a residents' association chairman said "semua kolam takungan di Bandar Bukit Raja" (all retention ponds in Bandar Bukit Raja) could not hold the heavy rain ([Malaysia Gazette][gazette], _secondary_).
  - Taman Kyra had "five floods since 2021". A Taman Casira residents' association vice-president said the water took "up to 14 hours to recede" ([FMT][fmt nov], _secondary_).
  - In 2026 the area flooded on 16 February, 20 April and 8 May ([MBDK][mbdk feb]; [RTM][rtm apr]; [RTM][rtm may]).
- **The tide makes it worse:**
  - A November 2024 flood was worsened by "air laut pasang besar" (a big high tide) ([Utusan][utusan], _secondary_).
  - Port Klang has two tides a day, and a closed tide gate causes "a backwater effect in the upstream area during high tide" ([Frontiers][tide]).
- **SDP admits the gaps.** It lists "static flood zone mapping" as a modelling limit. Its flood measures depend on government river works, and "failure to maintain systems may reduce resilience over time" ([CONTEXT]).
- **The river fix is years away.** The federal RM219 million Sungai Kapar Kecil and Sungai Kapar Besar flood scheme in Meru, one of the projects covering the Sungai Puloh basin, runs from 2024 to 2029, and was 27.31% done in March 2026 ([Selangor State Assembly][meru]).
- **Nobody measures the local river.** We found no JPS gauge on Sungai Puloh, the river through the township, among JPS Selangor's stations.

[fmt may]: https://www.freemalaysiatoday.com/category/nation/2024/05/24/developers-local-councils-need-to-hash-out-flood-issues-say-bandar-bukit-raja-folk
[gazette]: https://malaysiagazette.com/2023/06/04/dalamkan-sungai-puloh-klang-elak-banjir-kilat/
[fmt nov]: https://www.freemalaysiatoday.com/category/nation/2024/11/16/flood-hit-bandar-bukit-raja-residents-want-developer-to-halt-new-projects
[mbdk feb]: https://www.mbdk.gov.my/en/news/floodwaters-in-klang-have-receded-residents-are-urged-to-remain-vigilant-due-to-the-high-tide
[rtm apr]: https://berita.rtm.gov.my/kes/senarai-berita-kes/senarai-artikel/banjir-kilat-landa-shah-alam-klang/
[rtm may]: https://berita.rtm.gov.my/nasional/senarai-berita-nasional/senarai-artikel/beberapa-kawasan-di-lembah-klang-dilanda-banjir-kilat/
[utusan]: https://www.utusan.com.my/nasional/2024/11/shah-alam-klang-sekali-lagi-dilanda-banjir-kilat/
[tide]: https://www.frontiersin.org/journals/environmental-science/articles/10.3389/fenvs.2022.919704/full
[CONTEXT]: /docs/CONTEXT.md
[meru]: https://dewan.selangor.gov.my/question/projek-tebatan-banjir-meru-2/

## Target user

- **Primary:** SDP's Bandar Bukit Raja township and facilities team. We assume they run the ponds not yet handed over and schedule desilting; confirm it with SDP.
- **Beneficiaries:** residents of flood-hit streets, such as Taman Kyra and Taman Casira.

## Solution and how it works

1.  **Sense.** Put a low-cost water-level sensor in each SDP retention pond and at each outlet in Bandar Bukit Raja, reporting every few minutes.
2.  **Diagnose.** After every rain, compare how fast each pond drains with how it drained before. A pond that drains more slowly than its own record points to silt, a blocked outlet or a stuck flap gate. Kolam Sedia raises a work order before the next storm, and pre-monsoon desilting follows the data instead of the calendar.
3.  **Pre-position, seasonally.** Through the northeast monsoon and spring-tide weeks, recommend holding gated ponds at a lower level, releasing at low tide using JUPEM's tide predictions for Pelabuhan Kelang ([JUPEM][jupem]).

    Kolam Sedia doesn't draw ponds down storm by storm, because warnings come too late. On 8 May 2026 rain fell "sejak tengah hari" (since midday), but the warning came at 7.20 pm ([Harian Metro][hmetro], _secondary_). Lowering the 30-acre (12.14 ha) working wetland the press describes by 10 cm frees about 12,100 m³. Doing that in two hours would need about 1.7 m³/s of outflow (our arithmetic).

4.  **Share.** Publish a live "pond fullness" signal to the township team and the residents' associations. It can also feed the [Jiran Siaga](0001-jiran-siaga.md) evacuation trigger.

[jupem]: https://www.jupem.gov.my/en/staps
[hmetro]: https://www.hmetro.com.my/amp/mutakhir/2026/05/1355462/lembah-klang-banjir-kilat-metmalaysia-keluar-amaran-cuaca-buruk

## Why it's new

| Closest analogue                                                                                 | What it does                                                                      | What it lacks                               |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------- |
| Continuous monitoring and adaptive control, Ormond Beach, US ([EPA][epa])                        | Forecast-driven pumps on ponds; released about 70 acre-feet before Hurricane Irma | Not tidal; a city system                    |
| Japan's farm-ministry guide for irrigation ponds ([MAFF][maff]) and NARO's system ([NARO][naro]) | Pre-release from rain forecasts, and seasonal low-level rules                     | Farm ponds, not township flood ponds        |
| Delfland water board, Netherlands ([Delfland][delfland])                                         | Pumps polder water out ahead of forecast rain                                     | Canals, not ponds                           |
| SMART tunnel, Kuala Lumpur ([JPS][smart])                                                        | Switches modes on a flow forecast                                                 | Diverts flow; doesn't empty storage first   |
| "Smart Manhole", winner of USM's Varsity Hackathon 2025 ([past winners][winners])                | Sensors for flood prevention and drain maintenance                                | Manholes, not ponds; no seasonal level rule |

- **Malaysia:** we found no developer or council running ponds this way. The drainage department "would consider smart monitoring tools" for selected projects ([NST][nst], _secondary_).
- **Malaysian judges have seen sensors for drain upkeep.** A student team won USM's Varsity Hackathon 2025 with one ([past winners][winners]), so the pitch must lead with the ponds and the tide, not the sensor.
- **Our read:** new in Malaysia, not globally. The new part here is checking each pond's outlet health from how fast it drains, and setting levels around the tide.

[epa]: https://www.epa.gov/npdes/smart-sewers
[maff]: https://www.maff.go.jp/j/nousin/bousai/bousai_saigai/b_tameike/attach/pdf/zirei-22.pdf
[naro]: https://www.naro.go.jp/project/results/5th_laboratory/nire/2023/23_032.html
[delfland]: https://www.hhdelfland.nl/loket/wegwijzer/melden-anoniem/hoog-water/kans-hevige-regen-neemt-toe/
[smart]: https://www.water.gov.my/index.php/pages/view/430
[winners]: /docs/research/past-winners.md#malaysian-hackathons-2024-to-2026
[nst]: https://www.pressreader.com/malaysia/new-straits-times/20260724/281616722149538

## Impact and how we measure it

- **Primary outcome:** outlet faults found and fixed before a storm. These are counted directly, so the pilot proves something even in a dry season.
- **Resident outcome:** hours of standing water on the lowest pilot streets after storms of similar rainfall, before and after the pilot. Residents already report up to 14 hours. Storms vary, so treat this as supporting evidence, not proof.
- **Secondary:** pond storage free at the start of each storm, in m³.
- **Baseline:** this season's recession times from the sensors, plus residents' accounts and dated photos from past floods.
- **Comparison:** ponds without sensors, measured by staff reading gauge boards.

## Fit with Sime Darby Property

- **Pillar:** Climate Resilience. Bandar Bukit Raja is a township SDP rates at key acute flood risk ([CONTEXT]).
- **Admitted gaps:** static flood maps and maintenance. Kolam Sedia answers both on assets SDP owns.
  - SDP says the Wetland Townpark "can retain over 50,000 m³" ([SR2025] p. 58).
  - SDP still lists "Maintenance of flood-related infrastructure in handed-over areas" ([SR2025] p. 88).
  - **The figures conflict:** a 2026 StarPicks feature written in SDP's voice says the Townpark and a Wetland Nature Park opening in 2027 will together hold 150,000 m³ ([The Star][star]).
- **Value to two sides:** residents get fewer and shorter floods. SDP protects sales of new Bandar Bukit Raja phases, gets data to answer residents' anger, and gets evidence to work with JPS and the Klang city council (MBDK).
- **Scale:** to Bandar Universiti Pagoh, then to any SDP township with retention ponds.

[SR2025]: https://www.simedarbyproperty.com/sites/default/files/2026-04/SDP%20SR2025%20(Mobile).pdf
[star]: https://www.thestar.com.my/starpicks/2026/04/30/bandar-bukit-raja-a-space-to-grow-built-to-last

## Pilot

| Element       | Plan                                                                                                                                                                                                                                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Where         | The Bandar Bukit Raja Wetland Townpark, the 2027 Wetland Nature Park, and one or two neighbourhood retention ponds SDP still runs                                                                                                                                                                                        |
| Owner         | SDP's Bandar Bukit Raja township team, with its drainage consultant                                                                                                                                                                                                                                                      |
| Duration      | Six months across the northeast monsoon                                                                                                                                                                                                                                                                                  |
| Cost          | To be estimated: sensors, data connectivity, a dashboard and maintenance call-outs. There are no civil works                                                                                                                                                                                                             |
| Approvals     | SDP for sensors on its own ponds. JPS Selangor before changing any release operation. MBDK for ponds already handed over. Its predecessor, the Klang municipal council, agreed to a pump that developer Titijaya Land installed at Taman Mutiara Bukit Raja, completed in June 2019 ([Selangor State Assembly][mutiara]) |
| Success       | Faults caught before storms, and shorter standing-water hours on the pilot streets than in past comparable storms                                                                                                                                                                                                        |
| Decision gate | If met, fit every Bandar Bukit Raja pond, then Bandar Universiti Pagoh                                                                                                                                                                                                                                                   |
| Risks         | Releases worsen flooding downstream, which the drainage manual (MSMA) warns of ([MSMA][msma]): release only at low tide, with JPS's agreement. Sensors get vandalised or fouled: place them in protected wells. Data is ignored: tie it to work orders                                                                   |

[mutiara]: https://dewan.selangor.gov.my/question/isu-banjir-di-taman-mutiara-bukit-raja-klang/
[msma]: https://did.sarawak.gov.my/web/attachment/show/?docid=TGpTNUJRMmFzRXhkb0NUN0xuZEEvdz09Ojr0qQ0hRh0QPdV4ie9S7VGA

## Prototype by 23 October

- **Build:**
  - A dashboard that shows each pond's level, its recession curve against its own record, and a fault flag.
  - A seasonal level recommendation that uses rain and tide.
- **Hardware:** one real sensor, an ultrasonic sensor on a cheap microcontroller, installed in a campus pond or monsoon drain. This gives real data rather than synthetic.
- **Data:**
  - Open-Meteo hourly rainfall forecasts.
  - Weather warnings from data.gov.my.
  - JUPEM tide predictions.
  - The Copernicus GLO-30 elevation model, to find the lowest streets.
  - SDP's published pond figures.
- **Evidence before submission:**
  - Interview Taman Kyra residents about the last flood: depth, hours, and what they lost.
  - Collect dated photos.
  - Ask SDP or MBDK how desilting is scheduled today.

## Scorecard

**Rank 2 of 4**, with a mean judge score of 68.7 out of 100. It comes first if strategic fit counts for 50% ([ranking](0000-ranking.md#round-10-rank-and-stress-test)). The judges are AI agents playing SDP roles, scoring the draft against the [judging matrix](0000-ranking.md#judging-matrix).

| Scorer                  | Impact | Innovation | Feasibility | Fit | Commercial | Evidence | Weighted |
| ----------------------- | ------ | ---------- | ----------- | --- | ---------- | -------- | -------- |
| Author (round 9)        | 3      | 4          | 3           | 5   | 3          | 4        | 72       |
| SDP sustainability head | 3      | 3          | 4           | 5   | 4          | 3        | 72       |
| SDP township manager    | 3      | 3          | 4           | 4   | 4          | 3        | 69       |
| Innovation mentor       | 3      | 3          | 3           | 4   | 4          | 3        | 65       |

- **Biggest weakness:** nothing yet shows that sensors and maintenance shorten standing water. We don't know which outlets can be controlled, and the only real sensor is on a campus.
- **The change that would raise it most:** get SDP's Bandar Bukit Raja team to confirm which outlets are gated or pumped, and to share its desilting records and one real pond's drain-down record. Then lead with outlet faults caught before a storm.
- **Two judges ranked it first:** SDP can approve the core alone, on ponds it owns.

## Risks and open questions

- **Which outlets are gated or pumped?** We don't know which Bandar Bukit Raja outlets have gates or pumps, and seasonal levels only work where an outlet can be controlled.
- **Who runs what?** Unknown which ponds SDP still operates and which went to MBDK.
- **How far does the tide reach?** Unknown how far up Sungai Puloh the tide reaches.
- **The killer question:** "Your floods come from thunderstorms with almost no warning." The answer is maintenance and seasonal positioning, not storm-by-storm draining. Say so before a judge asks.

## How the idea changed across rounds

- **Round 5:** seeded from round 4's flood research as "Pond operations", which drew ponds down before each storm using forecasts.
- **Round 6:** research found that Klang's thunderstorm warnings come too late to empty a pond, and that no developer or council in Malaysia runs ponds this way. The idea narrowed to outlet health from drain-down rates, and seasonal levels around the tide.
- **Round 8:** absorbed the sensors from the cut "Living flood map", and shares its pond signal with Jiran Siaga.
- **Round 9:** judges scored it 65 to 72. Two of three ranked it first. Their critique moved the headline outcome to outlet faults caught.
