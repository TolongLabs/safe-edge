# Jiran Siaga

"We help residents of Bandar Bukit Raja's flood-prone streets who can't evacuate alone get out before the water rises." Each one gets two neighbour buddies and a written plan, and a river gauge sets the plan off. _Jiran siaga_ is Malay for "neighbour on standby".

**Track:** People, safety and security. **Rank:** see the [ranking](0000-ranking.md).

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

- **Floods in Bandar Bukit Raja.**
  - It had about 40,000 residents in 2022, with 105,000 expected at full development ([Sime Darby Property research][sdp research]).
  - It is one of the two townships where SDP rates flooding a key acute risk ([CONTEXT]).
  - In November 2024 a flash flood reached "2,000 homes across 10 neighbourhoods". Residents asked SDP to "halt ongoing projects", and said Taman Kyra had had "five floods since 2021" ([FMT][fmt bbr], _secondary_).
  - It flooded again on 20 April and 8 May 2026 ([RTM][rtm apr]; [RTM][rtm may]).
- **People who can't leave alone die or need rescue:**
  - In Taman Sri Muda, Shah Alam, in December 2021, a woman of 94, "paralyzed from the waist to the feet", and a woman of 73, the family's grandmother and aunt, were found "hugging each other" ([The Rakyat Post][sri muda], _secondary_).
  - At 8 pm on 12 April 2025, six relief centres in Petaling and Klang held 979 evacuees, including "376 orang kurang upaya (OKU) dan 82 warga emas" (376 disabled and 82 elderly people) ([NADMA][nadma pps]).
- **More older people, more of them alone:**
  - People aged 60 and over rose from 10.5% to 12.7% of Klang district between 2020 and 2026 ([CONTEXT]).
  - The National Health and Morbidity Survey 2025 found 18.8% of older Malaysians live alone, against 6.3% in 2018 ([Berita Harian][nhms alone], _secondary_).
- **Agencies map vulnerable people, but nobody gets them to the door.**
  - NADMA says it needs the home locations of disabled, elderly and bedridden people for its Defence Geospatial Information Management (DGIM) system, for rescues ([NADMA][nadma dgim]).
  - A newspaper column republished on NADMA's site says "Keluarga, jiran dan komuniti perlu mengenal pasti individu rentan" (families, neighbours and communities need to identify vulnerable people) and make sure they have an emergency plan ([NADMA][nadma rentan]).
  - We found no Malaysian scheme that gives each person a named helper, a plan and a trigger.

[CONTEXT]: /docs/CONTEXT.md
[fmt bbr]: https://www.freemalaysiatoday.com/category/nation/2024/11/16/flood-hit-bandar-bukit-raja-residents-want-developer-to-halt-new-projects
[rtm apr]: https://berita.rtm.gov.my/kes/senarai-berita-kes/senarai-artikel/banjir-kilat-landa-shah-alam-klang/
[rtm may]: https://berita.rtm.gov.my/nasional/senarai-berita-nasional/senarai-artikel/beberapa-kawasan-di-lembah-klang-dilanda-banjir-kilat/
[sri muda]: https://www.therakyatpost.com/news/malaysia/2022/01/08/sri-muda-flood-victims-rm20000-cannot-replace-the-lives-of-our-family-members/
[nadma pps]: https://www.nadma.gov.my/bm/media-2/berita/3856-979-mangsa-banjir-selangor-ditempatkan-di-6-pps
[nhms alone]: https://www.bharian.com.my/berita/nasional/2026/04/1535870/188-peratus-warga-emas-di-malaysia-tinggal-sendirian-meningkat-3
[nadma dgim]: https://www.nadma.gov.my/bm/media-2/program-dan-aktiviti/4444-sesi-perbincangan-perkongsian-maklumat-lokasi-orang-kurang-upaya-oku-warga-emas-dan-pesakit-terlantar-bagi-operasi-menyelamat-semasa-bencana
[nadma rentan]: https://www.nadma.gov.my/bm/korporat/sektor-bahagian/bahagian-perancangan-dan-kesiapsiagaan-bencana-bppb/seksyen-logistik/90-korporat/5466-menjaga-golongan-rentan-ketika-banjir
[sdp research]: /docs/research/sime-darby-property.md

## Target user

- **Primary:** residents of Bandar Bukit Raja's flood-prone streets who can't evacuate alone: older people living alone, wheelchair users, bedridden people and their carers.
- **Secondary:** the neighbours who act as buddies, and the residents' association that coordinates them.

## Solution and how it works

1.  **Enrol.** Residents' association volunteers, backed by SDP's township team, go door to door on the pilot streets. With the resident's explicit consent, they record:
    - mobility needs;
    - medicines;
    - where the resident will go;
    - a main buddy and a backup buddy, chosen from neighbours on higher floors or higher ground.
2.  **Watch.** No JPS gauge sits on Sungai Puloh, the river through the township. The nearest gauges, on the Sungai Binjai at Pekan Meru and the Sungai Klang at Bandar Klang, are 4.7 km and 5.1 km away by our measurement ([JPS Selangor][jps api]). So the trigger combines four local signals:
    - MET Malaysia thunderstorm warnings for Klang, from data.gov.my;
    - JUPEM's high-tide predictions, because a November 2024 flood was worsened by a big tide ([Utusan][utusan], _secondary_);
    - the JPS gauges;
    - in the pilot, water-level sensors in SDP's own ponds, shared with [Kolam Sedia](0002-kolam-sedia.md).
3.  **Act.** "Get ready" goes to buddies when a warning coincides with high tide, or a gauge reaches "Alert". "Go" follows when a local sensor or gauge reaches its warning level; JPS defines "Warning" as "prepare for any evacuation action" ([JPS Selangor][jps levels]). Each buddy goes to their resident and taps "with them", then "moved".
4.  **Escalate.** A pair that stays silent for 30 minutes passes to the backup buddy, then to the association's coordinator, then to the civil defence force (APM).
5.  **Learn.** After each event or drill, the tool records the minutes from Warning to "moved" for each pair, and the plans are updated.

The residents' association holds the register; SDP convenes the scheme and supplies the tool. Messages go through WhatsApp, so nobody installs a new app, and the scheme can move into the SDP App later.

[jps api]: https://infobanjirjps.selangor.gov.my/JPSAPI/api/StationRiverLevels/GetWLAllStationData/6
[jps levels]: https://infobanjirjps.selangor.gov.my/water-level.html
[utusan]: https://www.utusan.com.my/nasional/2024/11/shah-alam-klang-sekali-lagi-dilanda-banjir-kilat/

## Why it's new

| Closest analogue                                                                    | What it does                                                                                           | What it lacks                                           |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| Japan, Disaster Countermeasures Basic Act ([Cabinet Office][jp list])               | Lists of people needing help have been mandatory since 2013; individual plans since 2021 (effort duty) | Run by municipalities; patchy coverage (below)          |
| NADMA's planned location data ([NADMA][nadma dgim])                                 | Would give rescuers the homes of disabled, elderly and bedridden people                                | No neighbour, no plan, no trigger                       |
| Washington State, Map Your Neighborhood ([WA EMD][myn])                             | Neighbours map who needs help                                                                          | Checks happen after the disaster                        |
| Penang's community preparedness programme ([Buletin Mutiara][cepa], _secondary_)    | Maps vulnerable groups for rescuers                                                                    | No named buddy or trigger                               |
| MySelamat, winner of the Great Malaysia AI Hackathon 2025 ([past winners][winners]) | Plans flood rescues from social media posts and map routing                                            | Starts after people post for help; no pre-agreed helper |
| NADMA's SMS flood alerts, since 2024 ([existing solutions][existing])               | Free flood alerts to every phone                                                                       | Warns everyone, but assigns nobody to act               |

- **Japan shows the gap:** 1,451,097 people had individual plans on 1 April 2025, but in 920 of Japan's 1,741 municipalities (52.8%), 20% or fewer of listed people had one ([Cabinet Office][jp survey]).
- **Our read:** what's new is a named neighbour pair, triggered by a live gauge and measured in minutes, convened by the developer while the township is young. It is new in Malaysia, which Dr Lam accepts ([brief]), but not globally.

[jp list]: https://www.bousai.go.jp/taisaku/hisaisyagyousei/yoshiensha.html
[winners]: /docs/research/past-winners.md#malaysian-hackathons-2024-to-2026
[existing]: /docs/research/existing-solutions.md#floods-and-weather
[myn]: https://m.mil.wa.gov/asset/5ba4202849a61
[cepa]: https://www.buletinmutiara.com/cepa-perkasa-kesiapsiagaan-komuniti-tingkat-kesedaran-hadapi-risiko-banjir/
[jp survey]: https://www.bousai.go.jp/taisaku/hisaisyagyousei/pdf/r7chosa1.pdf
[brief]: /docs/BRIEF.md

## Impact and how we measure it

- **Primary outcome:** the share of enrolled residents moved to safety before a gauge reaches "Danger", and the median minutes from "Warning" to "moved". Both are measured in drills and in real events.
- **Coverage:** the share of identified residents on the pilot streets who have a plan and two buddies. Japan's figure above sets the bar to beat.
- **Baseline:** in interviews, ask residents who helped them last time and how long it took. Run one drill on a comparison street without the scheme.
- **Reach:** every household on a flood-prone street gains, because buddies, neighbours and rescuers all know who is still inside.

## Fit with Sime Darby Property

- **Pillars:** Climate Resilience (adaptation plans for high-risk assets) and Community Experience ([CONTEXT]).
- **Admitted gap:** SDP's flood measures rely on government river works it doesn't control ([CONTEXT]). Jiran Siaga cuts harm while those works are pending.
- **Reputation:** after the November 2024 flood, residents blamed SDP. Being seen to protect the most vulnerable residents speaks to that anger directly.
- **Value to two sides:** residents' lives; and for SDP, a working adaptation plan for a township it rates high-risk, plus goodwill. The association gains an organised volunteer base, and APM gets fewer emergency rescues.
- **Scale:** next to Bandar Universiti Pagoh, SDP's other high flood-risk township, then to any flood-prone neighbourhood in Malaysia.

## Pilot

| Element       | Plan                                                                                                                                                                        |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where         | Two of the 10 Bandar Bukit Raja neighbourhoods hit in November 2024, with one comparison neighbourhood                                                                      |
| Owner         | SDP's township management team, with each neighbourhood's residents' association                                                                                            |
| Duration      | Six months across the northeast monsoon, with a drill every two months                                                                                                      |
| Cost          | To be estimated. The items are messaging, volunteer training, drills and a part-time coordinator; there is no hardware                                                      |
| Approvals     | The residents' associations; explicit consent for health data under the PDPA ([PDP FAQ][pdp]); alignment with APM and the welfare department (JKM)                          |
| Success       | Most identified residents covered, and drill times beating the comparison street                                                                                            |
| Decision gate | If both are met, extend to all 10 neighbourhoods, then to Bandar Universiti Pagoh                                                                                           |
| Risks         | A buddy's own house floods (choose buddies on higher ground; backup buddy); liability (the association holds the data; SDP only convenes); alert fatigue (two-stage alerts) |

[pdp]: https://www.pdp.gov.my/ppdpv1/en/faq/

## Prototype by 23 October

- **Build:** a web dashboard and a WhatsApp or Telegram bot.
  - The dashboard holds the register, a map and the trigger engine, running on the live JPS Selangor API.
  - A drill mode injects gauge levels.
- **Data:** the JPS Selangor river-level API, data.gov.my weather warnings, JUPEM tide predictions, OpenStreetMap building outlines for Bandar Bukit Raja, and DOSM's district ages ([CONTEXT]).
- **Video flow:**
  1. Enrol a resident.
  2. The gauge hits Alert.
  3. Buddies are notified.
  4. At Warning, one buddy confirms and one stays silent.
  5. The silent pair escalates.
  6. The dashboard shows everyone moved.
- **Evidence before submission:**
  - Interview residents affected in November 2024 about the last flood: who helped, and when.
  - Interview one residents' association committee member and one carer.
  - Count the households on two streets with someone who can't evacuate alone.

## Scorecard

**Rank 1 of 4**, with a mean judge score of 69.3 out of 100. Its lead over Kolam Sedia is about 0.7 points, which is a tie in practice ([ranking](0000-ranking.md)). The judges are AI agents playing SDP roles, scoring the draft against the [judging matrix](0000-ranking.md#judging-matrix).

| Scorer                  | Impact | Innovation | Feasibility | Fit | Commercial | Evidence | Weighted |
| ----------------------- | ------ | ---------- | ----------- | --- | ---------- | -------- | -------- |
| Author (round 9)        | 4      | 4          | 3           | 4   | 2          | 4        | 72       |
| SDP sustainability head | 4      | 3          | 3           | 4   | 3          | 4        | 70       |
| SDP township manager    | 4      | 3          | 3           | 4   | 3          | 3        | 68       |
| Innovation mentor       | 4      | 3          | 3           | 4   | 3          | 4        | 70       |

- **Biggest weakness:**
  - **The trigger:** there is no gauge on Sungai Puloh, and past warnings came hours late.
  - **Liability:** SDP's name sits on a life-safety scheme that depends on residents' associations, PDPA consent and untested buddy liability.
- **The change that would raise it most:** get one residents' association on one flooded street to commit. Run and film a timed drill there, get a lawyer to review the buddy commitment, and count the residents on two streets who can't evacuate alone.

## Risks and open questions

- **Which neighbourhoods, and was there warning?** We don't know which 10 neighbourhoods flooded in November 2024, or how much warning the signals gave. On 8 May 2026 rain fell from midday, but the reported warning came at 7.20 pm ([Harian Metro][hmetro], _secondary_). Local pond sensors may be the only timely signal.
- Does each pilot neighbourhood have an active residents' association?
- Will APM train the buddies?
- Malaysia has no specific Good Samaritan law ([ANN][samaritan], _secondary_). Ask a lawyer how to word the buddy's commitment.

[samaritan]: https://asianews.network/malaysias-good-samaritan-law-reduces-fear-among-bystanders-during-emergencies
[hmetro]: https://www.hmetro.com.my/amp/mutakhir/2026/05/1355462/lembah-klang-banjir-kilat-metmalaysia-keluar-amaran-cuaca-buruk

## How the idea changed across rounds

- **Round 1:** seeded as "Evacuation buddy", pairing residents who can't leave alone with a neighbour, and triggered by river levels.
- **Round 3:** the author scored it 79, level with Handover Loop at the top.
- **Round 4:** research found Japan's statutory lists and plans, and NADMA's plan to map vulnerable people's homes. Nothing in Malaysia pairs a named neighbour with a plan and a trigger.
- **Round 8:** no gauge sits on Sungai Puloh, and warnings came hours late. The trigger moved to warnings, tides and pond sensors, shared with Kolam Sedia. The residents' association holds the data, and SDP only convenes.
- **Round 9:** judges scored it 68 to 70. All three named the trigger and liability as the risks.
