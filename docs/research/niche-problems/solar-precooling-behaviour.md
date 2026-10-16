# Would households accept solar pre-cooling, and who already does it?

Deep-dive evidence on whether households would accept solar pre-cooling, and who already offers it, researched and then fact-checked by two separate Codex runs on 16 October 2026 for [Niche township problems](/docs/research/niche-problems.md). The checker tested 48 claims: 21 confirmed, 11 corrected, 1 removed and 15 it could only see in search snippets. Lines marked "Analyst's read" are the worker's inference, not findings.

Contents:

1.  [Summary](#summary)
1.  [Air-conditioning habits in Malaysian homes](#air-conditioning-habits-in-malaysian-homes)
1.  [Comfort and building physics in a hot humid climate](#comfort-and-building-physics-in-a-hot-humid-climate)
1.  [Acceptance of automated control](#acceptance-of-automated-control)
1.  [Competition and prior art](#competition-and-prior-art)
1.  [Pilot measures](#pilot-measures)
1.  [Sources](#sources)

## Summary

- Analyst's read: A targeted opt-in pilot looks credible, but broad Malaysian household take-up is unproven. A 2022 apartment survey found lower weekday energy use while many sampled homes were unoccupied during work hours. A separate 2021 Kuala Lumpur field study reported night-time AC use, but its publisher page could not be opened; treat its figures as snippet-only. [2][r1] [3][r2]
- Analyst's read: Pre-cooling can carry some cooling into the evening, but performance depends on the building and weather. Malaysian roof evidence and Australian modelling are relevant, but the source pages for those studies were only available as indexed snippets. [6][r3] [7][r4] [8][r5]
- Analyst's read: Malaysian acceptance evidence is indirect. TNB's indexed page describes demand response for large consumers and related assets, not household AC control. Singapore's household app pilot achieved participation but modest average load reduction. Overseas studies report some acceptance with user override, alongside override and privacy concerns; two cited article pages were not directly accessible. [11][r6] [14][r7] [15][r8] [16][r9] [18][r10]
- Analyst's read: Products already schedule ACs in Malaysia and elsewhere. Malaysia's CSSB Country Star markets hybrid solar ACs for daytime cooling; Australia's Paladin controller links excess solar export to AC operation. HomeIQ offers occupancy-, humidity-, and solar-gain-aware HVAC logic, but its page does not describe a PV-surplus trigger. I did not verify a current Southeast Asian household service that combines PV-surplus-triggered AC pre-cooling with household AC control. [20](https://www.daikin.com.my/smart-control/) [23][r11] [34][r12] [35](https://homeiq.asia/perfect-climate)

[r1]: https://www.sciencedirect.com/science/article/pii/S2212095521000602
[r2]: https://journal.uts.edu.my/Home/ArticleDownload?articleId=BJOST040204
[r3]: https://www.sciencedirect.com/science/article/pii/S0378778819336448
[r4]: https://www.sciencedirect.com/science/article/pii/S0378778822005114
[r5]: https://www.sciencedirect.com/science/article/pii/S0378778825002865
[r6]: https://www.tnb.com.my/smart-grid/customer-empowerment/customer-empowerment
[r7]: https://www.ema.gov.sg/content/dam/corporate/our-energy-story/energy-demand/EMA-Our-Energy-Story-Energy-Demand-Demand-Side-Flexibility-Roadmap.pdf
[r8]: https://swlb1.aeaweb.org/articles?id=10.1257/app.20210618
[r9]: https://www.sciencedirect.com/science/article/pii/S0301421521001592
[r10]: https://www.sciencedirect.com/science/article/pii/S0301421523002306
[r11]: https://www.paladinsolarcontroller.com.au/product/dred-solar-controller-air-conditioning/
[r12]: https://www.cssb.com.my/solutions/solar-air-conds.html

## Air-conditioning habits in Malaysian homes

- **Day versus night:** Snippet-only. An indexed publisher abstract for a 2021 field study reports measurements in 19 selected Kuala Lumpur dwellings, average AC electricity use of 3.9 kWh per home per day, and a night-time peak linked to AC use during sleeping hours. The ScienceDirect page itself could not be opened. This is a small sample, not a national estimate. [2][r1]
- **Who is home:** A 2022 questionnaire study surveyed 160 apartment households in Klang Valley and the Sarawak cities of Kuching, Sibu, and Bintulu. It reported lower weekday energy use when many sampled homes were unoccupied during work hours. Non-working occupants and weekday/weekend AC use were moderately correlated with electricity bills. This apartment sample is not a national occupancy estimate. [3][r2]
- **Recent usage data:** A Malaysian room-air-conditioner market report, dated March 2024, describes a Selangor home energy survey conducted in November 2023 with 15 households. Their ACs were used about 5.4 hours per day on average. The report does not give an hourly day/night profile, and the sample is too small to represent all Malaysian households. [1][r13]
- **Temperature settings:** Snippet-only. An indexed excerpt from a 2021 Malaysian household study reports that 68.4% of households set AC temperatures between 19.1 °C and 25 °C. The same excerpt gives n=148 for a regression; it does not establish 148 as the denominator for the setpoint result. A 2023 study in university activity rooms—not homes—reports comfort across 24–26 °C and cites 24–26 °C as a recommended setting in Malaysia and Singapore. The study does not say that the lowest setting cools a room faster. [4](https://www.mdpi.com/2071-1050/13/2/818) [5][r14]
- **Evidence gap:** Analyst's read: My searches did not identify a representative 2024–2026 Malaysian survey of household daytime occupancy, work-from-home patterns, or room AC setpoints. I searched English and Malay terms for Malaysian household AC habits, daytime occupancy, thermostat settings, solar pre-cooling, and residential demand response. This search result is not proof that no such survey exists.

[r13]: https://united4efficiency.org/wp-content/uploads/2024/03/AC-Market-Assessment-Report_Final_240518.pdf
[r14]: https://mdpi-res.com/d_attachment/buildings/buildings-13-00036/article_deploy/buildings-13-00036.pdf

## Comfort and building physics in a hot humid climate

Pre-cooling means running AC while PV is available, cooling indoor air and some building mass so the room may warm more slowly after the AC backs off. A 2022 review says carry-over depends on building thermal performance and weather; it also notes that PV output may fall while cooling loads continue to rise later in the afternoon. The review page was available only as an indexed snippet. [7][r4]

Malaysia-specific roof evidence makes house type relevant. Snippet-only: an indexed 2020 study describes field measurements in one Malaysian corner-terrace house from September to December 2018. It says an HDPE roof cover reduced convective heat flux by about 70–80% in the attic and 88% in the room. This roof study does not show that pre-cooling itself saves energy. [6][r3]

Snippet-only: a 2025 Australian study used measured PV and AC profiles from about 450 households in four cities and simulated the thermal behaviour of nine building types. It estimated summer reductions of up to 0.8 kW per building in maximum demand and up to 4 kW per building in minimum demand. These are modelled results from Australian housing, not observed Malaysian savings. [8][r5]

Analyst's read: Give humidity its own guardrail. ASHRAE's 2025 hot-humid building guidance says indoor relative humidity should be kept below 60% through dehumidification; it also describes 40–60% as the preferred range for human health and comfort. Humid outside air entering a cooled house can meet cold surfaces and condense; moisture, infiltration, and surface temperatures matter when assessing mould risk. [9][r15] [9][r16]

Analyst's read: Preserve heat protection and household control alongside any grid schedule. WHO heatwave advice, dated 11 October 2024, says to protect infants and children and check on vulnerable people, especially those over 65; it suggests setting AC to 27 °C with a fan. A pilot should preserve occupant or caregiver control and avoid imposing one setpoint on households with different needs. [10][r17]

[r15]: https://handbook.ashrae.org/Handbooks/F25/SI/F25_Ch37/F25_Ch37_si.aspx
[r16]: https://handbook.ashrae.org/Handbooks/A23/IP/A23_Ch64/a23_ch64_ip.aspx
[r17]: https://www.who.int/news-room/questions-and-answers/item/heatwaves-how-to-stay-cool

## Acceptance of automated control

- **Malaysia:** Snippet-only. TNB's indexed demand-response page lists industrial or large-power customers, district cooling, batteries, and EV charging stations as target segments. Its page did not return readable text when opened, so this check could not confirm more detail. The cited page does not describe a household AC control trial. Analyst's read: Searches of TNB, Energy Commission, SEDA, and university sources in English and Malay did not identify Malaysian household AC opt-out, override, comfort-complaint, or privacy rates.
- **Related local signal:** Snippet-only. TNB's live ESG page reports that about 217,000 customers switched to ToU between July 2025 and July 2026. It reports an assessed sample of 83,163 domestic ToU customers, of whom about 94% used more than 70% of their electricity in off-peak periods. The page timed out when opened; checked 16 October 2026. The Energy Commission's 20 June 2025 notice says the Peninsular Malaysia off-peak period is 10:00 p.m.–2:00 p.m. on weekdays and all day on weekends. [12][r18] [13](https://www.st.gov.my/ms/node/766) Analyst's read: ToU uptake is evidence that some customers opt into time-based pricing; it does not establish willingness to let a utility control an AC.
- **Singapore household pilot:** EMA and SP Group ran an opt-in household demand-response pilot from September 2024 to February 2025 with 1,000 volunteer households. Users received alerts through the SP mobile app to reduce or defer use during two-hour simulated peak events; a 20% reduction from typical use was the reward threshold. EMA later reported an average participation rate of 46% per event and about 5% average reduction in overall household energy per event. Participants acted on alerts; this was not automatic thermostat control. [14][r7] [40][r19]
- **Automated control:** A 2025 randomized study of smart thermostats found that automated response to time-varying prices reduced afternoon AC use and raised indoor temperatures above participants' preferred temperatures, mainly for households home during the day; customers infrequently overrode the feature. Snippet-only: a separate North American study reports a 12.9% event override rate across 6,389 connected thermostats. [15][r8] [16][r9] Analyst's read: An event override is not the same as opting out of a program.
- **Comfort and privacy:** Snippet-only. A 2022 UK field trial in 17 thermally efficient social homes used batteries and heat pumps; all but one home had solar PV. Participants were generally accepting when comfort limits and manual override were part of the design, though some raised concerns about indoor temperature, hot water, and cost. A 2023 German household study reports that more than 76.4% had medium or high smart-meter privacy concerns and that clear data-handling information reduced tariff aversion among respondents with high concerns. Analyst's read: Neither result is a Malaysian acceptance estimate. [17][r20] [18][r10]

[r18]: https://www.tnb.com.my/sustainability/esg-stories-time-of-use-smart-energy-management
[r19]: https://www.ema.gov.sg/our-energy-story/energy-demand/residential-consumers
[r20]: https://www.sciencedirect.com/science/article/pii/S0960148122013441

## Competition and prior art

| Product or project                | Country                                        | What it does                                                                                                                                                                                                                                                        | Solar-aware?                                                                | Source                                                                                                 |
| --------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| GO DAIKIN app                     | Malaysia                                       | Remote AC operation, weekly scheduling, estimated energy-use graphs for inverter models, and pre-cooling before arrival.                                                                                                                                            | No PV trigger documented on the product page.                               | [20](https://www.daikin.com.my/smart-control/)                                                         |
| Sensibo Air                       | Global                                         | Adds app control, geofencing, and schedules to compatible remote-controlled ACs.                                                                                                                                                                                    | No PV trigger documented on the product page.                               | [21](https://sensibo.com/products/sensibo-air); [company overview](https://sensibo.com/pages/about-us) |
| Ambi Climate via SP Group HomeUP  | Singapore                                      | Learns AC use and adjusts indoor temperature; HomeUP lists smart scheduling and AC energy insights.                                                                                                                                                                 | No PV trigger documented on the service page.                               | [22](https://utilities.spdigital.sg/mktg/homeup/)                                                      |
| CSSB Country Star Solar Air Conds | Malaysia                                       | Markets hybrid solar-PV and grid-powered AC for homes and businesses, aimed at daytime cooling.                                                                                                                                                                     | Yes for solar-powered cooling; no pre-cooling automation documented.        | [34][r12]                                                                                              |
| HomeIQ Perfect Climate            | Singapore, Thailand, Malaysia (markets listed) | Residential HVAC service uses occupancy, humidity, and solar-gain logic; schedules bedroom pre-cooling before sleep.                                                                                                                                                | Solar-gain aware; no PV-generation trigger documented.                      | [35](https://homeiq.asia/perfect-climate)                                                              |
| Paladin DRED Solar Controller     | Australia                                      | Uses excess solar export to start an AC and adjust its operating level as solar surplus changes.                                                                                                                                                                    | Yes; directly solar-aware AC control.                                       | [23][r11]                                                                                              |
| SolarEdge Home Smart Switch       | Australia market                               | Switches wired appliance loads on a schedule or dynamically through the inverter to increase solar self-consumption. It is a general load switch, not a room thermostat.                                                                                            | Yes; solar-aware load control.                                              | [24][r21]                                                                                              |
| Amber SmartShift                  | Australia                                      | Uses household load, solar, and price forecasts to manage compatible batteries.                                                                                                                                                                                     | Yes for battery dispatch; it does not directly control AC comfort settings. | [25][r22]                                                                                              |
| Tesla Powerwall                   | New Zealand (support-page example)             | Its Self-Powered mode uses excess solar for the home and stores surplus; Savings mode can charge during lower-cost periods and offset peak use.                                                                                                                     | Solar-aware storage; not a solar-triggered AC pre-cooling service.          | [26][r23]                                                                                              |
| Octopus Smart Cooling             | United Kingdom                                 | Connects customers with a Trusted Partner for AC or air-to-air heat-pump installation.                                                                                                                                                                              | No solar- or price-triggered AC control documented on the service page.     | [27][r24]                                                                                              |
| WSE hybrid solar AC-DC            | Singapore                                      | Sells hybrid solar AC-DC equipment; its homepage says solar DC powers the AC directly without a battery and the system switches to grid power when sun is weak.                                                                                                     | Yes for powering cooling from solar; not a pre-cooling control service.     | [28](https://wse.sg/)                                                                                  |
| Powercor Energy Partner           | Australia                                      | A voluntary residential demand-response program used Sensibo to adjust split-system ACs for around three hours on very hot summer days. The 2020 FAQ describes the season as 1 December 2019–31 March 2020 and events on days above 36 °C between 3 p.m. and 8 p.m. | No solar trigger described in these sources.                                | [41][r25]; [42][r26]                                                                                   |

Analyst's read: Patent records show established prior art in AC pre-cooling and solar-linked thermal storage. A 2018 published application describes demand-response AC pre-cooling, and a separate patent family describes coordinating solar generation with building thermal storage. These records show earlier claimed inventions, not an active retail service or a legal clearance opinion. [29][r27] [30][r28]

An extra search found RACE for 2030's _Residential solar pre-cooling and pre-heating_ final report, dated November 2021. The report describes itself as a scoping study, not a pilot or product, and notes a significant gap in studies or trials of PV-powered, remotely controlled AC. It calls for more research. This is prior research, not evidence that no newer product exists. [39][r29]

An adjacent confirmed project is a 2024 UiTM repository record for a smart solar-louvre shading system for residential buildings in Malaysia; it is related building work, not household AC control. [32](https://ir.uitm.edu.my/id/eprint/117852/)

Analyst's read: My English and Malay searches did not identify a Malaysian hackathon or competition entry from 2022–2026 that combines PV-surplus-aware household AC pre-cooling or home AC load shifting. Search coverage cannot prove none exists.

[r21]: https://www.solaredge.com/aus/products/residential/smart-energy/solaredge-home-smart-switch
[r22]: https://help.amber.com.au/hc/en-us/articles/10014159451405-How-does-SmartShift-work
[r23]: https://www.tesla.com/en_NZ/support/energy/powerwall/mobile-app/modes-of-operationwithsolar
[r24]: https://octopus.energy/octopus-trusted-partners/smart-cooling/
[r25]: https://media.powercor.com.au/wp-content/uploads/2021/08/02104215/Powercor-Regulatory-Proposal-31-January-2020_compressed.pdf
[r26]: https://media.powercor.com.au/wp-content/uploads/2019/11/25135730/Energy-Partner-Program-2020-FAQs.pdf
[r27]: https://patents.google.com/patent/US20180100661A1/en
[r28]: https://patents.google.com/patent/US10302328B2/en
[r29]: https://www.racefor2030.com.au/content/uploads/H1-Residential-Solar-Pre-cooling-OA-report_Final-1.pdf

## Pilot measures

- Analyst's read: Recruit households with real, metered rooftop PV and compatible ACs first. Compare their usual routine with PV-responsive pre-cooling using a randomized crossover or matched-day design. Record PV generation, export/import, AC circuit energy, whole-home energy, weather, room temperature, and humidity; never infer benefits from synthetic load traces. The 2024 Malaysia report says terrace houses accounted for 39.1% of housing in 2022, so include terrace homes but record roof exposure and insulation. [1][r13]
- Analyst's read: Report total AC kWh and whole-home kWh over the full day as well as evening grid import and coincident peak kW. Track solar self-consumption as (PV generation minus export) divided by PV generation. Show the 2:00 p.m.–10:00 p.m. weekday ToU peak period separately from the PV-use result; shifting load and saving energy are different outcomes. [13](https://www.st.gov.my/ms/node/766)
- Analyst's read: Measure comfort with room temperature and relative humidity logging plus short resident ratings during afternoon, evening, and bedtime. Log chosen setpoints, AC runtime, manual overrides, complaints, and opt-outs. Compare results by whether someone is home in the day, house type, and top-floor or roof exposure. Set comfort bounds with each household and preserve manual override, with extra care for homes with young children or older residents. [9][r15] [10][r17]
- Analyst's read: Test acceptance directly: invitation-to-enrolment, continued use, override and opt-out rates, reason codes, willingness to keep control enabled, privacy trust, and preferred reward or bill-saving offer. Keep energy savings, solar self-consumption, peak reduction, comfort, and equipment/installation cost as separate outcomes. The evidence does not support promising a fixed household saving before this pilot. [14][r7] [18][r10]
- Analyst's read: SDP fit is strongest as a homeowner comfort-and-energy service that can be piloted in one township and later offered through the homeowner ecosystem. SDP's 2025 Integrated Annual Report lists Energy and Carbon, Climate Resilience, and Community Experience as material matters; Digital Transformation is a strategic priority. [19][r30]

[r30]: https://www.simedarbyproperty.com/sites/default/files/2026-04/SDP%20IAR2025%20Mobile.pdf

## Sources

1. UNEP-U4E and MGTC, _Market Assessment & Cost Benefit Analysis of High-Efficient & Climate-Friendly Air Conditioners in Malaysia_ (March 2024), including the November 2023 household survey. [Source][r13]
2. Aqilah et al., _Analysis on electricity use and indoor thermal environment for typical air-conditioning residential buildings in Malaysia_, _Urban Climate_ (2021). **SNIPPET-ONLY:** cited ScienceDirect page did not open; indexed publisher abstract checked 16 October 2026. [Source][r1]
3. Khalid and Bujang, _A Survey of Energy-Use Behaviour in Apartment Buildings in East and West Malaysia_ (published 31 July 2022). [Publisher PDF][r2]
4. Sena et al., _Determinant Factors of Electricity Consumption for a Malaysian Household Based on a Field Survey_ (2021). **SNIPPET-ONLY:** cited MDPI page did not open; indexed excerpt checked 16 October 2026. [Source](https://www.mdpi.com/2071-1050/13/2/818)
5. _Investigation of Thermal Adaptation and Development of an Adaptive Model under Various Cooling Temperature Settings for Students’ Activity Rooms in a University Building in Malaysia_ (2023). [Publisher PDF][r14]
6. Tuck et al., _Affordable retrofitting methods to achieve thermal comfort for a terrace house in Malaysia with a hot–humid climate_ (2020). **SNIPPET-ONLY:** cited ScienceDirect page did not open; indexed publisher excerpt checked 16 October 2026. [Source][r3]
7. Naderi et al., _Demand response via pre-cooling and solar pre-cooling: A review_ (2022). **SNIPPET-ONLY:** cited ScienceDirect page did not open; indexed publisher abstract checked 16 October 2026. [Source][r4]
8. Naderi et al., _Reducing greenhouse emissions from Australia’s housing stock through solar pre-cooling and pre-heating_ (2025). **SNIPPET-ONLY:** cited ScienceDirect page did not open; indexed publisher abstract checked 16 October 2026. [Source][r5]
9. ASHRAE Handbook, _Moisture Management in Buildings_ (2025) and _Avoiding Moisture and Mold Problems_ (2023). [2025 chapter][r15] [2023 chapter][r16]
10. World Health Organization, _Heatwaves: How to stay cool_ (11 October 2024). [Source][r17]
11. Tenaga Nasional Berhad, _Demand Response with Customer Participation_. **SNIPPET-ONLY:** live page returned no readable text when opened; indexed excerpt checked 16 October 2026. [Source][r6]
12. Tenaga Nasional Berhad, _Time-of-Use: Smart Energy Management_. **SNIPPET-ONLY:** live page timed out when opened; indexed excerpt checked 16 October 2026. [Source][r18]
13. Energy Commission Malaysia (Suruhanjaya Tenaga), _Jadual Elektrik Baharu: Lebih 23.6 Juta Pengguna Domestik Semenanjung Nikmati Kadar Lebih Adil_ (press release, 20 June 2025). [Source](https://www.st.gov.my/ms/node/766)
14. Energy Market Authority Singapore, _Singapore's Demand-Side Flexibility Roadmap_ (29 October 2025). [Source][r7]
15. Blonz et al., _Smart Thermostats, Automation, and Time-Varying Prices_, _American Economic Journal: Applied Economics_ (January 2025). [Source][r8]
16. _A data-driven study of thermostat overrides during demand response events_ (2021). **SNIPPET-ONLY:** cited ScienceDirect page did not open; indexed publisher result checked 16 October 2026. [Source][r9]
17. _Empirical evaluation of demand side response trials in UK dwellings with smart low carbon technologies_ (2022). **SNIPPET-ONLY:** cited ScienceDirect page did not open; indexed publisher result checked 16 October 2026. [Source][r20]
18. _Smart meter-related data privacy concerns and dynamic electricity tariffs: Evidence from a stated choice experiment_ (2023). **SNIPPET-ONLY:** cited ScienceDirect page did not open; indexed publisher result checked 16 October 2026. [Source][r10]
19. Sime Darby Property, _Integrated Annual Report 2025_ (report covers FY2025; file URL dated April 2026). [Source][r30]
20. Daikin Malaysia, _Smart Control – GO DAIKIN App_. Live product page; no publication date displayed; checked 16 October 2026. [Source](https://www.daikin.com.my/smart-control/)
21. Sensibo, _Sensibo Air_. Live product page; no publication date displayed; checked 16 October 2026. [Product](https://sensibo.com/products/sensibo-air) [Company](https://sensibo.com/pages/about-us)
22. SP Digital Singapore, _HomeUP / Ambi Climate_. Live service page; no publication date displayed; checked 16 October 2026. [Source](https://utilities.spdigital.sg/mktg/homeup/)
23. Paladin Solar Controller, _DRED Solar Controller – Wireless Air Conditioning Controller_. Live product page; no publication date displayed; checked 16 October 2026. [Source][r11]
24. SolarEdge, _Home Smart Switch_. Live product page; no publication date displayed; checked 16 October 2026. [Source][r21]
25. Amber Electric, _How does SmartShift work?_ Article updated 24 April 2026. [Source][r22]
26. Tesla, _Powerwall Modes of Operation with Solar_, New Zealand support page. No publication date displayed; checked 16 October 2026. [Source][r23]
27. Octopus Energy, _Smart cooling for your home_. Live service page; no publication date displayed; checked 16 October 2026. [Source][r24]
28. WSE Singapore, homepage section _Hybrid Solar AC-DC Air Conditioner_. Live page; no publication date displayed; checked 16 October 2026. [Source](https://wse.sg/)
29. US Patent Application US20180100661A1, _Demand response based air conditioning management systems and method_ (published 12 April 2018). [Source][r27]
30. US Patent US10302328B2, _Thermal energy storage systems and methods for use with solar power generation systems_ (published 28 May 2019). [Source][r28]
31. Universiti Malaysia Sarawak repository, _Smart Air-Conditioner Controller for Effective Energy and Cost Management_ (listed as a 2023 project report). **SNIPPET-ONLY:** repository page failed to open; the row was removed from the comparison table. [Record](http://ir.unimas.my/id/eprint/43140)
32. UiTM Institutional Repository, _Smart solar louvre shading system for residential building in Malaysia_ (2024). [Source](https://ir.uitm.edu.my/id/eprint/117852/)
33. UTHM, _Smart Solar Ventilation System For Home Using Internet Of Things (IOT)_ (2023). **SNIPPET-ONLY:** source page did not open; this project claim was omitted from the corrected report. [Record][r31]
34. CSSB Country Star, _Solar Air Conds_. Live product page; page footer shows © 2026; checked 16 October 2026. [Source][r12]
35. HomeIQ Asia, _Intelligent HVAC for the tropical residence / Perfect Climate_. Live service page; no publication date displayed; checked 16 October 2026. [Source](https://homeiq.asia/perfect-climate)
36. UiTM Institutional Repository, _Pocket Power_, listed in the 2024 Johor International Innovation Invention Competition and Symposium proceedings. **SNIPPET-ONLY:** record could not be opened; the project claim was omitted. [Record](https://ir.uitm.edu.my/id/eprint/134931/)
37. NEPTIQ, _Aeriq: Intelligent climate control for Loxone + Daikin_. **SNIPPET-ONLY:** product page could not be opened; row removed from the comparison table. [Record](https://www.neptiq.tech/en/products/aeriq)
38. NEPTIQ, company overview. **SNIPPET-ONLY:** company page could not be opened; Aeriq status and company-location claims were not retained. [Record](https://www.neptiq.tech/en)
39. RACE for 2030, _Residential solar pre-cooling and pre-heating: Final report_ (November 2021). [Source][r29]
40. Energy Market Authority Singapore, _Residential Consumers_ (undated live page; checked 16 October 2026). [Source][r19]
41. Powercor, _Regulatory Proposal 2021–2026_ (proposal dated January 2020). [Source][r25]
42. Powercor, _Energy Partner Program 2020 FAQs_ (program season 1 December 2019–31 March 2020). [Source][r26]

[r31]: https://periodical.uthm.edu.my/index.php/peat/article/view/13169
