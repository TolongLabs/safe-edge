# Niche township problems

Which township problems matter but few rival teams will pitch, as of 16 October 2026. We simulated how rivals would use AI, counted which problems they would land on, then researched and fact-checked six problems they missed. The six evidence packs are in [niche-problems/](/docs/research/niche-problems/), and the 240 simulated rival ideas are in [Rival ideas](/docs/research/niche-problems/rival-ideas.md).

This is a draft for the team to read before we pick a direction. Scores are our judgement on checked evidence, not measurements.

Contents:

1.  [Takeaways](#takeaways)
1.  [Method](#method)
    1.  [Simulating the rivals](#simulating-the-rivals)
    1.  [Edge score](#edge-score)
    1.  [Opportunity score in the survey](#opportunity-score-in-the-survey)
1.  [Crowding map](#crowding-map)
1.  [Ranking](#ranking)
1.  [The top three](#the-top-three)
    1.  [Children drowning in township waters](#children-drowning-in-township-waters)
    1.  [Death in the township](#death-in-the-township)
    1.  [Living next to a data centre](#living-next-to-a-data-centre)
1.  [Deep dives on the shortlist](#deep-dives-on-the-shortlist)
    1.  [Drowning, in depth](#drowning-in-depth)
    1.  [Data-centre neighbours, in depth](#data-centre-neighbours-in-depth)
    1.  [Link between the two](#link-between-the-two)
    1.  [Solar pre-cooling, in depth](#solar-pre-cooling-in-depth)
    1.  [A data centre buying rooftop solar](#a-data-centre-buying-rooftop-solar)
1.  [Dropped or held back](#dropped-or-held-back)
1.  [The team's ranking through the crowding lens](#the-teams-ranking-through-the-crowding-lens)
1.  [How to use this](#how-to-use-this)
1.  [Corrections to earlier claims](#corrections-to-earlier-claims)
1.  [Unverified and not found](#unverified-and-not-found)
1.  [See also](#see-also)

## Takeaways

**Our read**, each backed by a section below:

1.  **AI rivals converge hard.** In 24 simulated runs, shade and heat on walking routes came up in 19, accessibility maps in 18, and flood or drain alerts, water reuse and biodiversity monitoring in 17 each ([crowding map](#crowding-map)).
1.  **Our earlier ideas sit in crowded clusters.** All four ideas in `docs/archive/ideas/` fall under shade, flood or renovation debris.
1.  **Asking AI for "niche" ideas gives a second crowd:** noise, tree survival, light pollution and dengue.
1.  **Children drowning in township drains and ponds ranks first** by a wide margin: high pain, an SDP lever, little prior work ([ranking](#ranking)).
1.  **Death in the township and data-centre neighbours follow.** Each has a fresh 2026 trigger and almost no prior hackathon work.

## Method

### Simulating the rivals

More than 1,000 students will paste the same brief into an AI chatbot, and AI makes ideas more alike; see [Ideation methods, what AI does to ideas](/docs/research/methods/ideation-methods.md#what-ai-does-to-ideas). So we did what they would do and counted the results.

- **Models:** Codex (gpt-6-luna, max effort) and Gemini 3.8 Flash (high effort), each run as a fresh session with no web access.
- **Prompt:** the challenge brief from the official page, followed by one of four requests: no track chosen, People track, Planet track, or "unique, niche, out-of-the-box" ideas.
- **Volume:** 4 requests × 3 runs × 2 models = 24 runs of 10 ideas, or 240 ideas.
- **Count:** for each problem cluster, how many of the 24 runs mention it, found by keyword search over titles, problems and solutions.

### Edge score

> Edge = Pain × SDP lever × Evidence ÷ Crowding

Each term is scored 1 to 5. Crowding is the worst of three checks: how often rivals' AI produced it, how many products already exist, and how often it appears in past hackathons. Ideas that fail a basic check are cut first: no real data, taken by the organisers, or outside SDP's reach. Like RICE, the score sorts; it doesn't decide.

### Opportunity score in the survey

Ulwick's opportunity score finds underserved needs: Opportunity = Importance + (Importance − Satisfaction), using the share of respondents who rate each 4 or 5 out of 5, scaled to 0 to 10. Above 10 means underserved ([Strategyn][strategyn]). Adding a grid of problems to the practitioner survey lets the industry tell us whether our niche is underserved, which also counts as evidence. A [PDMA review][pdma] criticises subtracting satisfaction from importance, so treat the score as a ranking aid.

[strategyn]: https://strategyn.com/quantify-your-customers-unmet-needs
[pdma]: https://www.pdma.org/review_what_customer

## Crowding map

Runs that mention each cluster, out of 24 in total and out of 6 for each request. Keyword counts are rough and come from two model families; treat them as relative.

| Cluster                                  | All 24 | No track | People | Planet | Niche |
| ---------------------------------------- | -----: | -------: | -----: | -----: | ----: |
| Shade and heat on walking routes         |     19 |        5 |      3 |      5 |     6 |
| Accessibility and barrier-free maps      |     18 |        5 |      6 |      1 |     6 |
| Flood, drain or retention-pond alerts    |     17 |        5 |      0 |      6 |     6 |
| Water leaks, irrigation, rainwater       |     17 |        5 |      0 |      6 |     6 |
| Biodiversity corridor monitoring         |     17 |        5 |      1 |      5 |     6 |
| First and last mile shuttles             |     14 |        4 |      4 |      4 |     2 |
| Solar sharing                            |     14 |        4 |      1 |      6 |     3 |
| Food and organic waste                   |     14 |        4 |      1 |      6 |     3 |
| Neighbour connection, skill swap         |     13 |        5 |      6 |      1 |     1 |
| Night safety on paths                    |     12 |        5 |      5 |      0 |     2 |
| Older people living alone                |     11 |        3 |      6 |      0 |     2 |
| Recycling sorting and rewards            |      9 |        4 |      0 |      5 |     0 |
| Renovation and building-material reuse   |      9 |        2 |      0 |      3 |     4 |
| Noise and quiet hours                    |      6 |        0 |      3 |      0 |     3 |
| Tree survival                            |      6 |        1 |      0 |      2 |     3 |
| Light pollution                          |      5 |        0 |      0 |      0 |     5 |
| Dengue and mosquitoes                    |      3 |        0 |      0 |      1 |     2 |
| Drowning                                 |      1 |        0 |      0 |      0 |     1 |
| Lightning, data centres, death or burial |      0 |        0 |      0 |      0 |     0 |

The "niche" request doesn't escape the crowd: 6 of its 6 runs still produced shade, accessibility, flood, water and biodiversity ideas.

## Ranking

| Problem                              | Pain | Lever | Evidence | Crowding |     Edge |
| ------------------------------------ | ---: | ----: | -------: | -------: | -------: |
| Children drowning in township waters |    5 |     4 |        3 |        2 | **30.0** |
| Death in the township                |    4 |     3 |        3 |        2 | **18.0** |
| Living next to a data centre         |    4 |     4 |        3 |        3 | **16.0** |
| Living inside an unfinished township |    4 |     5 |        3 |        4 |     15.0 |
| Lightning in township open spaces    |    4 |     4 |        3 |        4 |     12.0 |
| Struggling local businesses          |    4 |     4 |        3 |        4 |     12.0 |
| Solar pre-cooling (added later)      |    2 |     4 |        3 |        3 |      8.0 |

Crowding for the unfinished township, lightning and local businesses is driven by existing products, not by rival AI ideas: construction-monitoring dashboards, commercial lightning detectors, and business grants and kiosks. Solar pre-cooling was added after the team shortlisted it; its pain score is low because the saving is about RM5 to RM16 a month ([in depth](#solar-pre-cooling-in-depth)).

## The top three

### Children drowning in township waters

- **Severity:** the Fire and Rescue Department reported 371 child and teen drowning deaths from 2023 to August 2026, 49 of them aged 0 to 6 ([The Star, 16 October 2026][star-drown]). Across all ages, 616 of 1,020 incidents were in rivers and irrigation canals and 82 in lakes and mining ponds (same source).
- **Recent Selangor cases:** a 10-year-old in Bandar Puncak Alam and a 9-year-old in Bandar Mahkota Cheras died after falling into drains in 2026, and the state ordered a review of high-risk drains ([NST][nst-puncak]; [Sinar Harian][sinar]). Two brothers were swept from a Kajang drain in December 2025; one was found in a retention pond ([Bernama][bernama-kajang]). A 5-year-old drowned in a Petaling Jaya flood-retention pond in February 2024; early reports said 6 ([Malay Mail][mm-pj]).
- **Rules:** the stormwater manual (MSMA) recommends gentle pond slopes and says slopes steeper than 1V:4H may need a fence or rail; it is a design guide, not a blanket fence rule ([MSMA][msma]).
- **Gap:** computer-vision drowning detection exists for swimming pools, with its own ISO standard, but we found no deployment on township drains or ponds, and no Malaysian hackathon winner on this.
- **SDP lever:** SDP desilts drains and maintains flood infrastructure in handed-over areas, and runs water assets such as Sakura Lake in Elmina West and the Bandar Bukit Raja Wetland Townpark ([pack](/docs/research/niche-problems/drowning/drowning.md#sdps-exposure-and-lever)).
- **Risks:** custody of each drain or pond splits between council, JPS, SDP and strata bodies; deaths are too rare to measure in a short pilot; and it sits beside the crowded flood cluster. Pitch child safety at water edges, never rain alerts.

[star-drown]: https://www.thestar.com.my/news/nation/2026/10/16/371-youngsters-lost-to-drowning
[nst-puncak]: https://www.nst.com.my/amp/news/nation/2026/04/1429671/boy-swept-away-bandar-puncak-alam-found-drowned
[sinar]: https://www.sinarharian.com.my/article/778393/edisi/selangor-kl/kes-lemas-jatuh-longkang-mb-arah-siasatan-tingkat-keselamatan-kawasan-berisiko
[bernama-kajang]: https://bernama.com/en/news.php?id=2499672
[mm-pj]: https://www.malaymail.com/news/malaysia/2024/02/27/police-child-found-drowned-in-pj-flood-retention-pond/120326
[msma]: https://wplb.water.gov.my/assets/msma-2nd-edition.pdf

### Death in the township

- **Scale:** Malaysia recorded 199,807 deaths in 2025, up 0.4% ([DOSM, 15 October 2026][dosm-vital]). The population is ageing, so the long-run need grows.
- **Developer duty:** PLANMalaysia's 2023 guide pairs an on-site Muslim cemetery with developments of 100 hectares (250 acres) or more and at least 10,000 residents; smaller ones contribute to a cemetery trust fund. Its sizing example is 0.3 acre per 1,000 residents ([PLANMalaysia][planm-cem]).
- **Capacity:** Selangor's 2024 cemetery study, using 2023 JAIS figures, projects the Bandar Baru Salak Tinggi cemetery in Sepang, near Serenia City, to be full in 2027 ([Selangor study][sel-cem]). Kuala Lumpur's Islamic burial grounds had about 34,496 plots left in June 2023, expected to last until around 2032 ([Malay Mail][mm-hulu]).
- **Fresh triggers:** in August 2026 Selangor kept its rule that large developments set aside cemetery land and floated two-tier graves ([The Star][star-burial]). National guidance for non-Muslim cemeteries, crematoria and columbaria was still being finalised on 8 October 2026 ([Hansard][hansard]).
- **Gap:** adjacent services exist (Bereev, Allay, Singapore's AfterLifeSG memorial), but we found no township-level product that joins cemetery capacity, wake logistics and bereaved residents.
- **Risks:** councils, state religious bodies and kariah committees hold key roles, so SDP's lever is weaker. Our team's bereavement GovTech win is an edge, but the idea must be new and township-level, not a repeat.

[dosm-vital]: https://www.dosm.gov.my/portal-main/release-content/vital-statistics-malaysia2026
[planm-cem]: https://www.planmalaysia.gov.my/portalassets/docs/Pekeliling_Ketua_Pengarah_Perancangan_Bandar_dan_Desa_Bil_7_Tahun_2023_-_GPP_Tempat_Perkuburan_Islam.pdf
[sel-cem]: https://www.selangor.gov.my/selangor/modules_resources/bookshelf/Slide_Presentation_Kajian_Perkuburan_Islam_Negeri_Selangor_2024/Slide_Presentation_Kajian_Perkuburan_Islam_Negeri_Selangor_2024.pdf
[mm-hulu]: https://www.malaymail.com/news/malaysia/2026/07/09/hannah-yeoh-hulu-semenyih-muslim-cemetery-plan-has-been-in-the-works-since-2005/226898
[star-burial]: https://www.thestar.com.my/metro/metro-news/2026/08/07/selangor-to-identify-new-land-for-muslim-burial-grounds
[hansard]: https://hansard.parlimen.gov.my/hansard/dewan-rakyat/2026-10-08?q=Insuran

### Living next to a data centre

- **Backlash:** in Kota Damansara, the council had about 290 formal objections by 21 July 2026 and a coalition claimed over 500 households; the proposal was withdrawn on 28 July ([The Star][star-kd1]; [The Star][star-kd2]). Johor residents reported dust, night noise and falling water pressure, and one site got a 14-day stop-work order in August 2025 ([The Straits Times][st-johor]).
- **Rules:** PLANMalaysia Circular 4/2024 sets a planning reference for data centres, and the council cited a 50 m buffer from homes ([PLANMalaysia][planm-dc]). Selangor charges data centres RM5.31/m³ for water and requires three days of storage.
- **SDP exposure:** two hyperscale data centres at Elmina Business Park cover 126 acres with a total lease value of RM7.6 billion over 20 years ([SDP briefing][sdp-q4]). Google's first Elmina facility was expected to start operating within nine months of 20 August 2026 ([Media Selangor][media-sel]), so a pre-operation baseline is possible now.
- **Gap:** public neighbour monitoring exists only as plans abroad: Oracle's Project Jupiter and a University of Colorado dashboard due in spring 2027. We found no Elmina baseline and no Malaysian hackathon prior.
- **Risks:** SDP and Google may treat site data as sensitive; low-cost sensors may not prove compliance; monitoring without a remedy looks performative.

[star-kd1]: https://www.thestar.com.my/metro/metro-news/2026/07/27/outcry-over-pj-data-centre-plan
[star-kd2]: https://www.thestar.com.my/metro/metro-news/2026/07/30/controversial-kota-damansara-data-centre-proposal-withdrawn
[st-johor]: https://www.straitstimes.com/asia/se-asia/whatll-become-of-our-village-johoreans-choke-on-dust-noise-as-data-centres-move-in-next-door
[planm-dc]: https://stag.planmalaysia.gov.my/index.php/announcements/view/74
[sdp-q4]: https://www.simedarbyproperty.com/sites/default/files/2025-03/Q4FY2024-Financial-Results-Briefings.pdf
[media-sel]: https://mediaselangor.com/en/2026/08/390529

## Deep dives on the shortlist

The team shortlisted drowning and data-centre neighbours. Six more research-and-check runs went deeper on each, three per idea. Details and sources are in the linked packs.

### Drowning, in depth

- **Incidents:** news reports give 21 incident clusters in Selangor and Kuala Lumpur township water from January 2023 to October 2026, 18 with a confirmed death. Children swept from drains into rivers recur, sometimes 6 to 10 km downstream, and two of them died retrieving a ball ([incidents](/docs/research/niche-problems/drowning/drowning-incidents.md#incident-table)).
- **Bandar Botanik:** one death is verified, a 15-year-old who drowned while swimming alone in an artificial lake on 1 October 2026, in a Gamuda Land township. Reports of several teenagers were not found.
- **Design rules:** the stormwater manual says drains deeper than 0.6 m beside footpaths or roads must be covered, fast flows need a 1.2 m handrail or full grating, and detention ponds should slope no steeper than 1:4, ideally 1:6 ([prevention](/docs/research/niche-problems/drowning/drowning-prevention.md#design-standards-malaysia-then-abroad)).
- **What works:** barriers and immediate resuscitation are rated effective; supervision, swimming skills and rescue training are promising; signs alone have weak evidence.
- **Precedent:** Singapore's Alkaff Lake uses a water-level sensor that switches on beacons and spoken warnings in four languages as the water rises after rain. Nothing similar was found in Malaysia.
- **Costs:** chain-link fence about RM54 a metre, a ring buoy about RM290, a water-level sensor about RM2,327. Dublin loses about 15 ring buoys a week to theft, so theft-alarmed buoys exist.
- **Custody:** the developer is responsible until formal handover; ponds go to JPS with as-built drawings, and JPS may refuse ponds converted into recreation. No court ruling on a child drowning in a township drain was found ([custody](/docs/research/niche-problems/drowning/drowning-custody.md#legal-duties-and-handover)).
- **SDP water bodies:** Sakura Lake Park (21 acres) and Infinity Lake Park (8 acres) in Elmina, Serenity Park in Serenia City (8 acres), Ainsdale Lake Park (11 acres), and wetlands at Bandar Bukit Raja and Pagoh. The current operator of each isn't public.
- **Our read:** treat a drain-to-pond catchment as one system: map every water edge and who owns it, add level-triggered local warnings, and place theft-alarmed rescue kit. Measure hazards closed, alert response time and near misses, because deaths are too rare to measure in a pilot.

### Data-centre neighbours, in depth

- **Malaysian complaints are mostly about construction:** dust, red-soil runoff and coughs at Kundang, Rawang, where residents said more than 5,000 people were affected (July 2025); the Gelang Patah protest, whose organisers said they spoke for nearly 1,000 residents (February 2026); a Cyberjaya petition about 20-hour construction noise; and the Kota Damansara objections ([residents](/docs/research/niche-problems/data-centres/data-centre-residents.md#malaysian-cases)).
- **Elmina:** on public maps, the Google data centre sits about 1 km from Aman Putri homes and from SK Merbau Sempak school. One Elmina resident told Bernama in August 2025 he worried about water allocation; no petition or council complaint was found.
- **Status:** SDP finished and handed over the first building, with rent from Q2 FY2026; Google said in August 2026 it was not operating yet and expected to within nine months. Both statements hold.
- **Water:** Selangor allocates 53 million litres a day across the Elmina phases through a dedicated pipeline from the Bukit Tadun balancing pond, against 0.2 million litres actually used in March 2026. Google uses evaporative cooling; Selangor encourages but doesn't require reclaimed water. Johor already supplies 12 million litres a day of reclaimed water to data centres ([rules](/docs/research/niche-problems/data-centres/data-centre-rules.md#google-and-elmina-specifics)).
- **Rules:** PLANMalaysia's guideline asks for a 50 m buffer from homes in commercial zones, with a noise-based exception whose wording is unclear. The environment department's night limit for low-density homes is 50 dBA, and no Malaysian limit for low-frequency hum was found.
- **Abroad:** a 2026 Phoenix study measured downwind air up to 2.2°C warmer, detectable 500 m away. In Frederick County, Maryland, a data-centre developer proposed a community-benefit package on 1 September 2026 that included a $5 million community-solar project, but the County Executive rejected the application on 14 September ([good neighbour](/docs/research/niche-problems/data-centres/data-centre-good-neighbour.md#community-benefit-models); [Frederick County][frederick]).
- **Gap:** no published host-community agreement combines independent monitoring, resident oversight, complaint deadlines, grants and bill relief tied to measured results. No working tropical waste-heat reuse was found; server heat is too cool for absorption chillers without heat pumps, so drop that direction.
- **Our read:** the strongest mechanism is a measured baseline now, while Elmina's second data centre is under construction until 2027, plus a host-community agreement with measured triggers.

[frederick]: https://frederickcountymd.gov/9310/Data-Centers

### Link between the two

Google's Malaysian water-replenishment work includes a Taman Aman lake project with MBPJ ([Media Selangor][media-sel-water]). That is the Petaling Jaya flood-retention pond where a 5-year-old drowned in February 2024. Data-centre community money already reaches township water bodies.

[media-sel-water]: https://mediaselangor.com/en/2026/08/390837

### Solar pre-cooling, in depth

The idea: use midday rooftop solar to cool a home before the 2 pm peak, instead of exporting the power. Three research-and-check runs looked at the money, the market and the people ([tariff and evidence](/docs/research/niche-problems/solar-precooling/solar-precooling.md), [market](/docs/research/niche-problems/solar-precooling/solar-precooling-market.md), [behaviour and competition](/docs/research/niche-problems/solar-precooling/solar-precooling-behaviour.md)).

- **The rule is real:** Solar ATAP, from 1 January 2026, credits home exports at the energy charge only, and unused credit lapses each month.
- **The saving is small:** a kWh used at home avoids 44.43 sen of listed charges, while exporting it earns 27.03 sen, a gap of 17.40 sen. Shifting 1 to 3 kWh a day is worth about RM5 to RM16 a month, before fuel adjustments, tax and rebates.
- **The timing is wrong for most homes:** Klang Valley studies find air-conditioning runs mostly in sleeping hours, and many homes are empty on weekday afternoons. A US simulation found pre-cooling can raise yearly cooling energy.
- **SDP's solar homes already have batteries:** Elmina Ridge 1 (228 homes), Elmina Ridge 2 (221) and Tiara Residences 1 in Bukit Jelutong (59) ship with solar and batteries, which already soak up the midday surplus.
- **The market is thin so far:** Solar ATAP had 6.61 MW installed across all customer types by 30 April 2026.
- **Prior art exists abroad:** Australia's Paladin controller already starts an air-conditioner from surplus solar, and Daikin, Panasonic and Midea apps already schedule cooling in Malaysia. No Malaysian service combines the two, and no hackathon entry was found.
- **Our read:** weakest of the three shortlisted ideas. Its best remaining angle is comfort during the El Niño heat of early 2027, not bill savings.

### A data centre buying rooftop solar

We tested whether Google's Elmina data centre could buy residents' rooftop solar under CREAM, as a neighbour benefit ([pack](/docs/research/niche-problems/data-centres/solar-cream-data-centre.md)). It can't, as framed:

- CREAM buyers must hold a low- or medium-voltage account; a hyperscale data centre connects at 132 kV or more.
- The 5 km limit is measured between the substations serving the roofs and the buyer.
- It isn't new: Time Energy and the AIMS data centre signed a memorandum for this model in June 2025.
- The Edge reported little CREAM progress in April 2026.

Drop it from the data-centre idea.

## Dropped or held back

- **Living inside an unfinished township, held back.** Dengue reached 65,979 cases by week 35 of 2026, against 39,616 a year earlier, with deaths up from 32 to 62 ([Bernama][bernama-dengue]). MetMalaysia expects a strong El Niño, and temperatures of 41°C or more are forecast for March to May 2027 ([Bernama][bernama-elnino]). SDP controls its sites, and a contractor's project director we consulted can advise on site practice. But local vendors already sell construction dashboards with air and noise sensors ([pack](/docs/research/niche-problems/unfinished-township.md#what-already-exists)).
- **Lightning, dropped.** A study of 2008 to 2017 recorded about 12.5 deaths a year ([UNITEN][uniten]). Malaysian suppliers already sell detection networks and sirens, and golf clubs run stop-play protocols ([pack](/docs/research/niche-problems/lightning.md#what-already-exists)).
- **Struggling local businesses, dropped.** NAPIC's 5,699 unsold completed shops in H1 2025 are developer overhang, not rental vacancy, and no public shop-vacancy data exists for SDP townships. Grants, government kiosks and online marketplaces already operate ([pack](/docs/research/niche-problems/local-businesses.md#what-already-exists)).
- **Not yet researched:** families moving in before schools and clinics open, water-supply cuts, new addresses missing from maps, monkey conflict at the forest edge, and tenants' green-rating proof.

[bernama-dengue]: https://bernama.com/en/news.php?id=2605035
[bernama-elnino]: https://web26.bernama.com/en/general/news.php?id=2619514
[uniten]: https://irepository.uniten.edu.my/entities/publication/a7781ced-0c18-4a98-a750-eebb9a309060/full

## The team's ranking through the crowding lens

The [idea ranking](/docs/archive/ideas/0000-ranking.md) scores eight ideas from two ideation rounds. Mapping each onto the rival simulation shows which ones rivals' AI would also reach. Counts are runs out of 24, from keyword matches checked by hand.

| Team rank | Idea                                          | Nearest rival cluster                  | Rival runs |
| --------: | --------------------------------------------- | -------------------------------------- | ---------: |
|         1 | Lepas Hujan: leak checks in the defect period | Defect reporting                       |          2 |
|         2 | Kolam Sedia: flood ponds kept low             | Flood, drain or retention-pond alerts  |         17 |
|         3 | Jiran Projek: grades for building-site edges  | Construction dust, dengue              |          2 |
|         4 | Jiran Siaga: flood evacuation buddies         | Flood alerts                           |         17 |
|         5 | Teduh: trees where people walk in the sun     | Shade and heat on walking routes       |         19 |
|         6 | Waktu Lancar: off-peak exit rewards           | Guardhouse queues                      |          2 |
|         7 | Handover Loop: renovation debris              | Renovation and building-material reuse |          9 |
|         8 | Rumah Dijaga: checks of empty new homes       | None found                             |          0 |

- **Our read:** the second round's ideas (Lepas Hujan, Jiran Projek, Waktu Lancar, Rumah Dijaga) all sit in open ground; three of the first round's sit in the most crowded clusters.
- **Jiran Projek overlaps our unfinished-township pack,** which found local vendors already selling construction dashboards with air and noise sensors. Its open ground is the published grade and the fix loop, not the sensors.

## How to use this

- **With practitioners we consult:** ask open questions on township pain points and their own ideas first, then show the top three. Showing our list first would anchor their answers.
- **In the practitioner survey:** add an importance and satisfaction grid with these rows: drowning at drains and ponds, death and cemetery planning, data-centre neighbours, living beside construction, plus flood and recycling as popular controls. Shuffle the rows.
- **In the pitch:** the rival simulation is evidence for the innovation criterion. "We asked AI 24 times; it never suggested this" is a checkable claim.

## Corrections to earlier claims

- **Lightning:** "the Klang Valley gets about the third most lightning strikes in the world" is not established. TNB says Malaysia is among the top three; a 2021 satellite study ranks Kuala Lumpur first among capitals ([pack](/docs/research/niche-problems/lightning.md#trend-and-triggers)).
- **Drowning:** NST's "one child or teen drowns every three days" could not be opened, and its 619 figure counts incidents, not deaths. The checked figure, 371 deaths from January 2023 to August 2026, works out to about one every 3.6 days.
- **Google's Elmina data centre:** resolved. SDP completed and handed over the building, with rent from Q2 FY2026, as [Sime Darby Property](/docs/research/landscape/sime-darby-property.md#portfolio-at-a-glance) says; Google was still fitting it out in August 2026 and expected to operate within nine months.

## Unverified and not found

- The crowding counts use keyword matching over two model families. ChatGPT's web app, Claude and DeepSeek weren't sampled.
- No public site-level data was found for drownings, wakes, data-centre impacts or construction-edge exposure. Each pilot would need SDP or council records.
- Worker scores in the packs come before our own ranking; where they differ, the ranking above is ours.

## See also

- [Rival ideas](/docs/research/niche-problems/rival-ideas.md), the 240 simulated ideas
- Evidence packs: [drowning](/docs/research/niche-problems/drowning/drowning.md), [death](/docs/research/niche-problems/death.md), [data-centre neighbours](/docs/research/niche-problems/data-centres/data-centre-neighbours.md), [unfinished township](/docs/research/niche-problems/unfinished-township.md), [lightning](/docs/research/niche-problems/lightning.md), [local businesses](/docs/research/niche-problems/local-businesses.md)
- Deep dives: [drowning incidents](/docs/research/niche-problems/drowning/drowning-incidents.md), [drowning prevention](/docs/research/niche-problems/drowning/drowning-prevention.md), [drowning custody](/docs/research/niche-problems/drowning/drowning-custody.md), [data-centre residents](/docs/research/niche-problems/data-centres/data-centre-residents.md), [data-centre rules](/docs/research/niche-problems/data-centres/data-centre-rules.md), [data-centre good neighbour](/docs/research/niche-problems/data-centres/data-centre-good-neighbour.md)
- Solar: [pre-cooling tariff and evidence](/docs/research/niche-problems/solar-precooling/solar-precooling.md), [pre-cooling market](/docs/research/niche-problems/solar-precooling/solar-precooling-market.md), [pre-cooling behaviour and competition](/docs/research/niche-problems/solar-precooling/solar-precooling-behaviour.md), [CREAM and data centres](/docs/research/niche-problems/data-centres/solar-cream-data-centre.md)
- [SDP townships](/docs/research/niche-problems/sdp-townships.md), a table of 27 current and 10 older townships, not yet fact-checked
- [Idea ranking](/docs/archive/ideas/0000-ranking.md), the team's eight ranked ideas
- [Township problems](/docs/research/landscape/township-problems.md), for the mainstream problem statistics
- [Ideation methods](/docs/research/methods/ideation-methods.md), for why AI narrows ideas
