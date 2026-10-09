# Teduh

"We help Sime Darby Property plant its remaining trees where City of Elmina residents walk and wait in the sun, and keep them alive." The headline result is shade-hours delivered to people on foot, not trees planted. _Teduh_ is Malay for "shaded" or "sheltered".

**Track:** Planet, urban biodiversity and climate resilience. **Rank:** see the [ranking](0000-ranking.md).

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

- **The tree target counts planting, not benefit.**
  - SDP had planted 191,827 trees by 2025 against a 2030 target of 250,000, so about 58,000 remain (our arithmetic; [SR2025] pp. 66 and 155).
  - The report gives no survival, canopy or shade figure (our search of the full text).
- **Many planted trees die.** Across 176 forest-restoration sites in tropical and subtropical Asia, "Mean mortality of planted trees was 18% 1 year after planting, increasing to 44% after 5 years" ([PMC][mortality]). Care changes that: one US urban programme reached 99.4% annual survival, and its authors found "Stewardship was essential" ([USDA Forest Service][stewardship]).
- **People wait in the heat.**
  - Elmina has no rail station. Its two MRT feeder buses run about every 25 to 30 minutes ([CONTEXT]).
  - A 2026 Universiti Malaya study of tropical bus stations recorded mean air temperatures that "reached 31.5°C", and found "waiting time was identified as a key psychological adaptation factor" ([Theoretical and Applied Climatology][busheat]).
- **Shade works.**
  - In Shah Alam, land-surface temperature ranged from "26.5 to 33.8 ºC", and "The presence of green trees also influenced the surrounding LST" ([Journal of Fundamental and Applied Sciences][shahalam]).
  - A simulation of four George Town street sections found that mature street trees, by 2050, cut felt heat (the UTCI index) by 3 to 7 °C ([Climate][georgetown]).
- **Avoid a "getting hotter" story.** Across Kuala Lumpur, Petaling and Putrajaya, land-surface temperature didn't rise significantly between 2014 and 2021; Petaling's urban areas rose slightly, by 0.5 °C ([JAGST][petaling]). The case is exposure, not a trend.

[SR2025]: https://www.simedarbyproperty.com/sites/default/files/2026-04/SDP%20SR2025%20(Mobile).pdf
[mortality]: https://pmc.ncbi.nlm.nih.gov/articles/PMC9661948/
[stewardship]: https://research.fs.usda.gov/treesearch/50768
[CONTEXT]: /docs/CONTEXT.md
[busheat]: https://link.springer.com/article/10.1007/s00704-026-06257-0
[shahalam]: https://www.ajol.info/index.php/jfas/article/view/165380
[georgetown]: https://www.mdpi.com/2225-1154/12/10/154
[petaling]: https://jagst.utm.my/index.php/jagst/article/view/33

## Target user

- **Primary:** whoever at SDP decides where the remaining Elmina trees go. We assume that is its landscape and sustainability teams; confirm it with SDP.
- **Beneficiaries:** residents on foot: people waiting at feeder stops, children walking to school, and older people walking to shops.
- **Secondary:** residents who adopt a sapling near their home.

## Solution and how it works

1.  **Rank.** Score every walking segment and bus stop in Elmina by three things:
    - **heat exposure**, from Sentinel-2 vegetation and Landsat land-surface temperature;
    - **people on foot**, from the feeder stops in GTFS, OpenStreetMap paths, schools and shops;
    - **missing canopy**, from ESA WorldCover.
2.  **Site.** Recommend where the next batch of trees should go, on land SDP still controls. The batch counts toward the 250,000 target either way, and the tool shows projected shade-hours at years 5 and 10.
3.  **Shade now.** Mark the stops where shade is needed before trees grow, as candidates for interim shelters.
4.  **Keep alive.** QR-tag each new sapling, and let a nearby resident adopt it. When rainfall data shows a dry spell, adopters get a watering prompt and log it. The dashboard reports survival rate and shade-hours, not just trees planted.

## Why it's new

| Closest analogue                                                        | What it does                                                           | What it lacks                                   |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------- |
| Shade Phoenix Plan, 2024, published 2025 ([City of Phoenix][phoenix])   | Prioritises shade at transit stops and walking routes                  | A city plan, not a developer's tree pledge      |
| UCLA and American Forests ([UCLA][ucla])                                | Map shade at bus stops and on school routes                            | No tie to planting decisions or survival        |
| GeoTrees, Universiti Teknologi Malaysia (UTM) ([Coordinates][geotrees]) | QR tags on trees and logs of watering                                  | No siting for pedestrians; no survival headline |
| Gieß den Kiez, Berlin ([CityLAB Berlin][giess])                         | Residents adopt and water street trees, alongside a map of recent rain | No siting                                       |

- **Our read:** none of these turns a developer's tree count into shade delivered to pedestrians and survival rate.
- **The parts are known:** shade siting is new in Malaysia but not globally; citizen tree tagging and watering logs already exist in Malaysia through GeoTrees. Adopting a specific tree is Gieß den Kiez's model.

[phoenix]: https://www.phoenix.gov/content/dam/phoenix/heatsite/documents/BP_ShadePhoenixPlan_Report_031025_EN.pdf
[ucla]: https://innovation.luskin.ucla.edu/heat/mapping-shade-a-new-lens-on-heat-equity
[geotrees]: https://mycoordinates.org/citizen-science-tree-inventory/
[giess]: https://citylab-berlin.org/en/projects/giess-den-kiez/

## Impact and how we measure it

- **Measured exposure (lead with this):** the person-minutes spent waiting in direct midday sun at the top 10 stops, counted with a stopwatch and a thermometer. If it's small, the idea is small, and we should know before pitching.
- **Survival:** the one-year and two-year survival rate of adopted saplings, compared with saplings in the same batch that weren't adopted. Ask SDP for the survival rate of trees it has already planted in Elmina, as the baseline.
- **Projected shade:** shade-hours per day on the top-ranked segments at years 5 and 10, compared with SDP's current siting. This is a model, so it supports the case but doesn't lead it.
- **Canopy baseline:** today's canopy on the ranked segments, from ESA WorldCover.

## Fit with Sime Darby Property

- **Pillars:** Urban Biodiversity (250,000 trees, at least 15% green space per township) and Climate Resilience. Heat stress is a rising chronic risk ([CONTEXT]).
- **Costs SDP little:** SDP has committed to the 250,000 trees either way ([SR2025] p. 66). Teduh changes where they go and keeps more of them alive.
- **Value to two sides:** residents get cooler walks. SDP gets a defensible survival and shade number to report, and a more walkable township to sell.
- **Partners:** SDP already works with the Tropical Rainforest Conservation & Research Centre on its Elmina nursery and community planting ([SR2025] p. 74).
- **Scale:** every SDP township with planting left to do.

## Pilot

| Element       | Plan                                                                                                                                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Where         | City of Elmina: the top 20 feeder stops and walking segments, on land not yet handed to the council                                                                                                                      |
| Owner         | SDP's sustainability and landscape teams, with the Tropical Rainforest Conservation & Research Centre                                                                                                                    |
| Duration      | One planting season to site; 24 months to measure survival                                                                                                                                                               |
| Cost          | The trees are already committed. The new costs are QR tags, the dashboard, and shelters at the top-ranked stops (to be estimated)                                                                                        |
| Approvals     | SDP, as the developer responsible for areas not yet handed to the council ([Selangor State Assembly][dun dev]); MBSA landscape plan approval with a deposit ([MBSA][mbsa landscape])                                     |
| Success       | More projected shade-hours per tree than current siting, and higher survival among adopted saplings                                                                                                                      |
| Decision gate | If both hold, use Teduh for all remaining Elmina planting, then for Bandar Bukit Raja                                                                                                                                    |
| Risks         | Saplings shade nothing for years (interim shelters); low adoption away from homes (only tag saplings near homes); road-reserve rules (follow the National Landscape Department's shade-tree planting guide ([JLN][jln])) |

[dun dev]: https://dewan.selangor.gov.my/question/pemaju-yang-tidak-menyelenggara-infra-sebelum-serahan-kepada-pihak-berkuasa-tempatan-pbt/
[mbsa landscape]: https://www.mbsa.gov.my/ms-my/mbsa/perkhidmatan/pelanpembangunan/Halaman/pelan_landskap.aspx
[jln]: https://www.jln.gov.my/jln/resources/user_1/Text%20Documents/Dokumen%20Penerbitan/Pokok%20Teduhan/PANDUAN_PENANAMAN_POKOK_TEDUHAN_2.pdf

## Prototype by 23 October

- **Build:** a map dashboard for Elmina that ranks segments and stops and recommends tree sites, plus a mobile page for adopting a sapling.
- **Data:**
  - Sentinel-2 at 10 m ([Copernicus][s2]) and ESA WorldCover at 10 m ([ESA][worldcover]) for vegetation and canopy.
  - Landsat 8's thermal bands are 100 m ([USGS][landsat]), too coarse to see one stop, so use them for context only.
  - Rapid KL GTFS stops, OpenStreetMap paths and Open-Meteo rainfall.
- **Evidence before submission:**
  - Stopwatch and thermometer readings at 10 feeder stops at midday.
  - Interviews with people waiting there.
  - One conversation with SDP's landscape team, or the Tropical Rainforest Conservation & Research Centre, about how sites are chosen today.

[s2]: https://dataspace.copernicus.eu/explore-data/data-collections/sentinel-data/sentinel-2
[worldcover]: https://esa-worldcover.org/en/data-access
[landsat]: https://www.usgs.gov/faqs/what-are-band-designations-landsat-satellites

## Scorecard

**Rank 3 of 4**, with a mean judge score of 65.3 out of 100 ([ranking](0000-ranking.md)). The judges are AI agents playing SDP roles, scoring the draft against the [judging matrix](0000-ranking.md#judging-matrix).

| Scorer                  | Impact | Innovation | Feasibility | Fit | Commercial | Evidence | Weighted |
| ----------------------- | ------ | ---------- | ----------- | --- | ---------- | -------- | -------- |
| Author (round 9)        | 3      | 3          | 4           | 4   | 2          | 3        | 65       |
| SDP sustainability head | 3      | 3          | 4           | 4   | 4          | 4        | 71       |
| SDP township manager    | 3      | 2          | 4           | 4   | 4          | 4        | 67       |
| Innovation mentor       | 2      | 2          | 4           | 4   | 3          | 3        | 58       |

- **Biggest weakness:**
  - The headline is a modelled projection.
  - Few people wait at stops served every 25 to 30 minutes.
  - Citizen tree tagging and watering logs already exist in Malaysia (GeoTrees).
- **The change that would raise it most:** lead with measured exposure: the person-minutes spent waiting in midday sun at the top 10 stops, and SDP's actual survival rate for the trees it has already planted. Sell the siting and the survival reporting, not adoption.

## Risks and open questions

- **The killer question:** "A sapling gives no shade for years, and a shelter gives it on day one." Answer with interim shelters at the top stops and year-5 and year-10 projections.
- **Impact may be small:** with buses every 25 to 30 minutes, few people wait at any one stop. Count them before pitching.
- **Unknown:** how SDP currently chooses planting sites, and what share of the remaining 58,000 trees are for Elmina.
- **Unknown:** MBSA's maintenance period for new landscaping.

## How the idea changed across rounds

- **Round 1:** seeded as "Shade where people wait", which sites trees by pedestrian heat exposure, and separately as "Tree survival adoption".
- **Round 4:** research found a shade plan in Phoenix, shade mapping by UCLA, and GeoTrees in Malaysia. Shade siting is new in Malaysia; tree tagging and watering logs aren't.
- **Round 8:** the two merged, so trees go where people are and stay alive. Interim shelters answer "a sapling gives no shade for years".
- **Round 9:** judges scored it 58 to 71. Their critique moved the lead evidence to measured sun exposure at stops.
