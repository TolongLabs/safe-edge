# Open data for a township prototype

Public data sources our prototype can use today, with what each covers and where it falls short, as of 2026-10-10. The hackathon wants real data, not synthetic data ([BRIEF, rules](/docs/BRIEF.md#rules)), so every source here answered a live request on that date. A research worker tested each one with `curl`, and we re-ran a sample (NASA POWER, PVGIS, Open-Meteo, OpenDOSM income, ridership, weather and flood) the same day with the same results.

Contents:

1.  [Quick picks](#quick-picks)
1.  [Sources that answered today](#sources-that-answered-today)
1.  [Source notes](#source-notes)
    1.  [Government open API](#government-open-api)
    1.  [Weather, floods and air](#weather-floods-and-air)
    1.  [Energy and solar](#energy-and-solar)
    1.  [Maps and buildings](#maps-and-buildings)
    1.  [Transport, water, waste, crime and health](#transport-water-waste-crime-and-health)
1.  [What works at township level](#what-works-at-township-level)
1.  [Gotchas](#gotchas)
1.  [Unverified and not found](#unverified-and-not-found)
1.  [See also](#see-also)

## Quick picks

Use these coordinates for City of Elmina: **3.185889, 101.518667**. This is the official gazetteer point for Taman Perumahan Elmina, not the centre of the whole township ([Selangor Gazetteer][gazetteer]).

| If the idea needs           | Start with                                    | Finest resolution           | Key needed |
| --------------------------- | --------------------------------------------- | --------------------------- | ---------- |
| Solar yield for a roof      | PVGIS `PVcalc`                                | About 25 km grid            | No         |
| Sun and temperature history | NASA POWER                                    | 0.5° to 1° grid             | No         |
| Weather forecast            | data.gov.my weather, or Open-Meteo            | District or town; any point | No         |
| Buildings and amenities     | OpenStreetMap through Overpass                | Single building             | No         |
| Building footprints in bulk | Microsoft or Google Open Buildings            | Single building             | No         |
| Household income            | OpenDOSM `hies_district`                      | Administrative district     | No         |
| Population                  | OpenDOSM `population_district` (CSV, not API) | Administrative district     | No         |
| Bus and rail                | data.gov.my GTFS static and realtime          | Stop, route, vehicle        | No         |
| Electricity cost and carbon | TNB tariff schedule and grid emission factor  | Peninsular Malaysia         | No         |
| Roof-level solar potential  | Google Solar API                              | Single building, if covered | Yes, paid  |

[gazetteer]: https://mygeoname.mygeoportal.gov.my/pdf/10.pdf

## Sources that answered today

| Source                        | What it gives                            | Auth                       | Licence                   | Live result, 2026-10-10                        |
| ----------------------------- | ---------------------------------------- | -------------------------- | ------------------------- | ---------------------------------------------- |
| data.gov.my catalogue API     | National datasets as JSON                | Keyless, 4 requests a min  | Varies; many CC BY 4.0    | 200                                            |
| OpenDOSM                      | Population, household income, CPI        | Keyless, 4 requests a min  | CC BY 4.0                 | 200; population API empty, CSV works           |
| data.gov.my weather           | MET 7-day forecasts and warnings         | Keyless, 4 requests a min  | Not stated                | 200 for Selangor districts; no Elmina entry    |
| MET Malaysia API              | Forecasts, warnings, radar               | Token needed               | Not stated                | 401 without a token                            |
| GTFS static and realtime      | Schedules, stops and live bus positions  | Keyless, 4 requests a min  | Not stated                | Static 200; Rapid Bus live 200; Rapid Rail 404 |
| JPS flood-warning endpoint    | River level and rainfall stations        | Keyless                    | Not stated                | 200, but sampled rows dated February 2024      |
| Monthly air pollution         | National monthly pollutant means         | Keyless                    | CC BY 4.0                 | 200; ends in 2024, no station field            |
| MyEnergyStats (ST)            | Energy statistics, tariffs, grid factor  | Public pages               | Not stated                | 200 and PDFs                                   |
| SEDA SEIP                     | Feed-in tariff and RE statistics         | Public charts, CSV export  | Free reuse with credit    | 200                                            |
| NASA POWER                    | Solar irradiance and weather history     | Keyless                    | Not stated in API docs    | 200 at Elmina                                  |
| PVGIS                         | PV output estimates                      | Keyless, 30 calls a second | Free, no use restrictions | 200 at Elmina, ERA5 database                   |
| Global Solar Atlas            | Long-term solar maps and downloads       | Public                     | CC BY 4.0                 | 200                                            |
| Google Solar API              | Building-level solar potential           | Key and billing            | Google terms              | Coverage page only; no call made               |
| OpenStreetMap and Overpass    | Buildings, roads, amenities              | Keyless, shared limits     | ODbL                      | 200 on an alternate Overpass server            |
| Google Open Buildings v3      | Building polygons with confidence scores | Download                   | CC BY 4.0 or ODbL         | Page 200; Malaysia listed                      |
| Microsoft building footprints | 7,283,908 Malaysian building polygons    | Download                   | ODbL                      | Page 200                                       |
| Open-Meteo                    | Forecast and history at any point        | Keyless, non-commercial    | CC BY 4.0                 | 200 at Elmina                                  |
| Crime by district             | Annual convictions by police district    | Keyless                    | CC BY 4.0                 | 200; latest year 2023                          |
| Water consumption (SPAN)      | Annual use by state and sector           | Keyless                    | CC BY 4.0                 | 200; latest year 2024                          |
| Public transport ridership    | Daily trips per line                     | Keyless                    | CC BY 4.0                 | 200; latest day 31 August 2026                 |
| OpenAQ                        | Aggregated air-quality sensors           | Free key                   | Per provider              | 401 without a key                              |
| Open Charge Map               | EV charger locations                     | Free key                   | Mixed                     | 403 without a key                              |

Each row's evidence is cited in its section under [Source notes](#source-notes).

## Source notes

### Government open API

- **data.gov.my** needs no token. It allows 4 requests a minute per API and returns HTTP 429 above that ([rate limits][dgm-rate]).
- **OpenDOSM population** covers every administrative district for 2020 to 2026, by sex, age and ethnicity. It was updated on 7 October 2026. The API returned an empty array, but the CSV downloads normally ([population table][dosm-pop]).
- **OpenDOSM household income** (`hies_district`) gives mean and median income, spending, Gini and poverty by district, based on HIES 2022 ([income table][dosm-hies]). A sample row: Batu Pahat, mean RM7,419, median RM6,347.
- **OpenDOSM CPI** gives monthly state CPI for 13 spending groups, through August 2026 ([CPI table][dosm-cpi]).

[dgm-rate]: https://developer.data.gov.my/rate-limit
[dosm-pop]: https://open.dosm.gov.my/data-catalogue/population_district
[dosm-hies]: https://open.dosm.gov.my/data-catalogue/hies_district
[dosm-cpi]: https://open.dosm.gov.my/data-catalogue/cpi_state

### Weather, floods and air

- **Weather** forecasts cover named states, districts and towns, refreshed daily for 7 days ([weather API][dgm-weather]). A query for "Petaling" or "Kuala Selangor" works; "Elmina" returns nothing, so use the nearest district.
- **MET Malaysia's own API** needs a token. Its docs contradict themselves on whether it is public; an unauthenticated call returned 401 ([MET API][met-api]).
- **Floods:** the data.gov.my flood-warning endpoint answered, but its first station row was timestamped 23 February 2024. Treat it as stale until a fresh row appears ([flood endpoint][flood]). Public Infobanjir shows live levels on its website but documents no API ([Public Infobanjir][infobanjir]).
- **Air quality:** the Department of Environment's APIMS site is a web app with no public API; raw data is by application ([APIMS][apims]). The open monthly air-pollution table is national, ends in 2024 and has no station field ([air pollution table][air]). OpenAQ needs a free key, so its Selangor coverage is unchecked.

[dgm-weather]: https://developer.data.gov.my/realtime-api/weather
[met-api]: https://metapi2.met.gov.my/
[flood]: https://api.data.gov.my/flood-warning
[infobanjir]: https://publicinfobanjir.water.gov.my/
[apims]: https://eqms.doe.gov.my/APIMS/main
[air]: https://data.gov.my/data-catalogue/air_pollution

### Energy and solar

- **Solar at Elmina:** NASA POWER gives 4.80 kWh/m²/day average irradiance and 27.84°C mean temperature for 2001 to 2025 ([NASA POWER call][nasa]). PVGIS estimates 1,382 kWh a year from 1 kWp with 14% losses, using its ERA5 database ([PVGIS call][pvgis]).
- **Google Solar API** added BASE-quality coverage for residential areas in Malaysia on 25 March 2026. It needs billing; the free tier is 10,000 Building Insights calls a month ([coverage][gsolar-cov], [billing][gsolar-bill]). A "solar opportunity mapper" is already taken ([BRIEF, the challenge](/docs/BRIEF.md#the-challenge)), and this API makes one easy to copy.
- **Tariffs:** the Peninsular TNB schedule for 1 July 2025 to 31 December 2027 is a public PDF ([tariff schedule][tariff]). Rates are in [Energy, HVAC and solar](/docs/research/energy-hvac-solar.md).
- **Grid emission factor:** 0.740 kg CO2e per kWh for Peninsular Malaysia in 2024, provisional, published 23 February 2026 ([grid emission factor][gef]). Use it to turn saved kWh into avoided carbon.
- **SEDA SEIP** has feed-in tariff statistics by state, district and technology, with CSV export and free reuse with credit ([SEIP][seip]).

[nasa]: https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=ALLSKY_SFC_SW_DWN%2CT2M&community=RE&longitude=101.518667&latitude=3.185889&format=JSON
[pvgis]: https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?lat=3.185889&lon=101.518667&peakpower=1&loss=14&outputformat=json
[gsolar-cov]: https://developers.google.com/maps/documentation/solar/coverage
[gsolar-bill]: https://developers.google.com/maps/documentation/solar/usage-and-billing
[tariff]: https://myenergystats.st.gov.my/documents/d/guest/jadual-tarif-tnb-terkini
[gef]: https://myenergystats.st.gov.my/documents/d/guest/grid-emission-factor-gef-in-malaysia-2022-2024-provisional-
[seip]: https://seip.seda.gov.my/

### Maps and buildings

- **OpenStreetMap** returned buildings around Elmina, including a City of Elmina show unit, through the `overpass.kumi.systems` server. The main `overpass-api.de` server returned 406 from our runtime ([Overpass usage][overpass]). Stay under about 10,000 requests a day.
- **Microsoft footprints** hold 7,283,908 Malaysian building polygons (548 MB) from 2016 to 2020 imagery, under ODbL ([Microsoft footprints][msft]).
- **Google Open Buildings v3** lists Malaysia, with polygons, centroids and confidence scores from May 2023 imagery ([Open Buildings][gob]).

[overpass]: https://dev.overpass-api.de/overpass-doc/en/preface/commons.html
[msft]: https://github.com/microsoft/IdMyPhBuildingFootprints
[gob]: https://sites.research.google/gr/open-buildings/

### Transport, water, waste, crime and health

- **GTFS:** Rapid KL bus static and live vehicle feeds work; the Rapid Rail live feed returned 404. BAS.MY feeds don't include Selangor ([GTFS docs][gtfs]).
- **Ridership** gives daily trips per line, including LRT Shah Alam, audited and published monthly; the latest day was 31 August 2026 ([ridership][ridership]).
- **Water:** SPAN's table gives annual use by state and sector through 2024 ([water use][span]). Air Selangor's Water Updates site exposes no API ([Water Updates][airsel]).
- **Waste:** no township or Selangor feed exists. The national recycling rate was 37.9% in 2024 ([SWCorp][swcorp]).
- **Crime:** convictions by police district through 2023. Police districts don't match administrative districts ([crime table][crime]).
- **Health:** NHMS 2023 microdata are by request only, after a one-year lock ([NHMS 2023][nhms]).

[gtfs]: https://developer.data.gov.my/realtime-api/gtfs-static
[ridership]: https://data.gov.my/data-catalogue/ridership_headline
[span]: https://data.gov.my/ms-MY/data-catalogue/water_consumption
[airsel]: https://waterupdates.airselangor.com/
[swcorp]: https://www.swcorp.gov.my/en/malaysias-national-recycling-rate-rises-to-37-9-in-2024/
[crime]: https://data.gov.my/data-catalogue/crime_district
[nhms]: https://iku.nih.gov.my/nhms-2023/

## What works at township level

- **Building or point level:** OpenStreetMap, both building-footprint sets, PVGIS, NASA POWER, Open-Meteo and Google Solar take a coordinate or a building. Their grids are coarser than one township, except the footprints.
- **District or route level only:** population, income, weather, ridership, GTFS and SEDA statistics.
- **State or national only:** CPI, water use, recycling rate, air pollution.
- Inference: no public source gives household-level energy, waste or water data for an SDP township. A team that needs that must collect its own, with consent, which also counts as real data.

## Gotchas

- Unfiltered data.gov.my calls return the oldest rows first. Add `&sort=-date` to get the latest; we confirmed this on the ridership table.
- The 4-requests-a-minute limit is per API. Cache responses during a demo instead of calling live.
- Open-Meteo's free tier is for non-commercial use only. A pitch can use it; a pilot would need a paid plan.

## Unverified and not found

- No City of Elmina boundary polygon was found; the gazetteer point is a single named place.
- OpenAQ stations and Open Charge Map chargers near Elmina are unchecked, because both need accounts.
- No current SWCorp, KPKT or Air Selangor township-level dataset or API was found.
- MyEnergyStats, JPS and the grid-factor PDF state no reuse licence or rate limit.

## See also

- [Energy, HVAC and solar](/docs/research/energy-hvac-solar.md), for what the energy numbers mean for an idea
- [Township problems](/docs/research/township-problems.md), for the statistics behind each focus area
- [Malaysia's Official Open API docs](https://developer.data.gov.my/)
