# Pre-cooling with the sun under Solar ATAP

Deep-dive evidence on pre-cooling homes with midday solar under Solar ATAP: rules, tariff maths and evidence, researched and then fact-checked by two separate Codex runs on 16 October 2026 for [Niche township problems](/docs/research/niche-problems.md). The checker tested 46 claims: 24 confirmed, 15 corrected, 2 removed and 5 it could only see in search snippets. Lines marked "Analyst's read" are the worker's inference, not findings.

Contents:

1.  [Summary](#summary)
1.  [Solar ATAP rules](#solar-atap-rules)
1.  [Worked example: self-consumption vs export](#worked-example-self-consumption-vs-export)
1.  [Air-conditioning in Malaysian homes](#air-conditioning-in-malaysian-homes)
1.  [Evidence on pre-cooling](#evidence-on-pre-cooling)
1.  [Products and services](#products-and-services)
1.  [SDP and Elmina context](#sdp-and-elmina-context)
1.  [Verdict: worth building?](#verdict-worth-building)
1.  [Sources](#sources)

## Summary

- Analyst's read: A comfort-aware pilot is worth testing. In the illustrative case below, the gross bill difference is RM10.44/month at 2 kWh/day, before bill adjustments. This is not a measured result.
- Solar ATAP started on 1 January 2026 in Peninsular Malaysia. Homes use PV behind the meter first; eligible domestic exports earn an Energy Charge credit, subject to the programme's monthly limit and billing-period expiry. [SEDA Solar ATAP guideline][r1]
- Using the tariff table published for the period 1 July 2025–31 December 2027, shifting 2 kWh/day from evening grid cooling to otherwise-exported solar gives a gross difference of RM10.44/month under the stated assumptions. The TNB tariff PDF did not open in this check; the official indexed table shows the rates used below. [TNB tariff schedule][r2]
- DOSM reports air-conditioner ownership in 68.8% of Malaysian citizen households in 2024, up from 61.7% in 2022. A 2024 market assessment also reports a small Selangor end-use sample; neither figure is a national AC electricity-use share. [DOSM 2024 survey][r3] [UNEP-U4E assessment][r4]
- Analyst's read: Overseas modelling supports testing load shifting, but I did not locate a Malaysian residential field trial pairing rooftop solar with pre-cooling. SDP reports 228 solar-and-battery homes at Elmina Ridge 1, and TNB reports three community storage units at Elmina Ilham Residence. [SDP 2024 Sustainability Report][r5] [TNB battery storage][r6]

[r1]: https://www.seda.gov.my/reportal/wp-content/uploads/2025/12/GUIDELINES-FOR-SOLAR-ACCELERATED.pdf
[r2]: https://www.mytnb.com.my/tariff/PDF/Jadual%20Tarif%20Elektrik%20Terkini%20-%202%20Julai%202025.pdf
[r3]: https://www.dosm.gov.my/uploads/release-content/file_20260330113350.pdf
[r4]: https://united4efficiency.org/wp-content/uploads/2024/03/AC-Market-Assessment-Report_Final_240518.pdf
[r5]: https://www.simedarbyproperty.com/sites/default/files/2025-05/SR2024.pdf
[r6]: https://www.tnb.com.my/sustainability/tnb-solar-panel-battery-management-strategies/

## Solar ATAP rules

| Rule                    | What it says                                                                                                                                                                                                                                                                                                                                                                                                 | Source                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Start and scope         | The programme applies in Peninsular Malaysia from 1 January 2026. PETRA executes the programme, the Energy Commission regulates it, and SEDA is the implementing agency.                                                                                                                                                                                                                                     | [SEDA guideline][r1]; [SEDA programme page](https://www.seda.gov.my/reportal/atap/) |
| Self-consumption        | Solar ATAP is designed mainly for on-site use. PV electricity consumed behind the meter reduces grid imports; excess may be exported.                                                                                                                                                                                                                                                                        | [SEDA guideline][r1], p. 12                                                         |
| Export credit           | A domestic consumer's export credit is based on the applicable Energy Charge, not the full import tariff. Non-domestic credits use Average SMP.                                                                                                                                                                                                                                                              | [SEDA guideline][r1], pp. 12–13                                                     |
| Export limit and expiry | Guideline 3.6.1(a) says: “Any excess Energy produced in a month which is not consumed by the Solar ATAP Consumer may be exported via the Supply System to the EUC.” Clause 3.6.1(b) says exported energy, up to the MAQ, may offset imports in the same Billing Period; unused credit does not carry forward and is forfeited. The guideline defines MAQ as capacity in kWac × 5 sun-hours × billing period. | [SEDA guideline][r1], pp. 9, 13                                                     |
| AFA                     | Clause 3.6.1(d) says: “The value of the credit cannot be used to offset the Automatic Fuel Adjustment (AFA) as stated in the tariff schedule.” AFA is a monthly adjustment and may appear as a surcharge or rebate.                                                                                                                                                                                          | [SEDA guideline][r1], p. 13; [ST tariff determination guideline][r7]                |
| Household system limit  | Maximum domestic PV installation capacity is 5 kW for single-phase and 15 kW for three-phase supply. The guideline defines kW as an AC rating; kWp is the PV panel DC peak rating.                                                                                                                                                                                                                           | [SEDA guideline][r1], pp. 9, 14                                                     |
| Contract term           | The programme term is up to 10 years from commencement. After the term, the PV system may operate for self-consumption only.                                                                                                                                                                                                                                                                                 | [SEDA guideline][r1], p. 14                                                         |
| SuRIA Home solar rebate | As of 16 October 2026, eligible Malaysian-citizen domestic Solar ATAP customers who had not received a SolaRIS cash rebate could apply for RM600/kWac, up to RM3,000. Allocation was first-come, first-served from 1 June to 31 December 2026, or until funds ran out; the PV system had to be commissioned by 31 December 2026. This is a solar-adoption rebate, not a pre-cooling saving.                  | [SEDA SuRIA Home notice][r8], 4 June 2026                                           |

[r7]: https://www.st.gov.my/en/eng/general/add_counter/1009/download/read_count
[r8]: https://www.seda.gov.my/government-introduced-sustainable-rebate-incentive-assistance-suria-home/

## Worked example: self-consumption vs export

The TNB tariff table lists these general domestic variable charges for monthly use up to 1,500 kWh: 27.03 sen/kWh Energy Charge, 4.55 sen/kWh Capacity Charge, and 12.85 sen/kWh Network Charge. The schedule says it applies from 1 July 2025 through 31 December 2027. The direct TNB PDF endpoint did not open; its indexed text shows these rates. Treat the source values as snippet-only in this check. [TNB tariff schedule][r2]

| Item                                                                                |            Value in this example |
| ----------------------------------------------------------------------------------- | -------------------------------: |
| Listed variable import charges avoided by using 1 kWh of PV directly                | 27.03 + 4.55 + 12.85 = 44.43 sen |
| Domestic export credit for 1 kWh, if eligible and fully used in that billing period |                        27.03 sen |
| Gross difference between using that kWh and exporting it                            |        44.43 − 27.03 = 17.40 sen |

The 44.43 sen figure excludes AFA, SST, KWTBB, the fixed retail charge, and EEI. SEDA's net-offset formula says imported energy remains subject to applicable taxes and charges and that incentives such as EEI may be adjusted as exports offset imports. The AFA credit exclusion is separate: ATAP credits cannot offset AFA. [SEDA guideline][r1], pp. 13, 23; [ST tariff explanation](https://www.st.gov.my/ms/node/766)

**Scenario assumptions:** This is an illustrative 5–6 kWp terrace-house PV case, not a household measurement or a panel size supplied by the sources. Assume the inverter complies with the relevant ATAP AC limit, the PV kWh would otherwise be exported and earn a fully used credit, each kWh of pre-cooling displaces one kWh of evening grid cooling, and monthly use remains at or below 1,500 kWh. Panel rating alone does not determine hourly surplus or cooling performance.

| Solar cooling shifted each day | Monthly shifted energy (30-day arithmetic) | Gross difference over export credit |
| -----------------------------: | -----------------------------------------: | ----------------------------------: |
|                      1 kWh/day |                                     30 kWh |                        RM5.22/month |
|                      2 kWh/day |                                     60 kWh |                       RM10.44/month |
|                      3 kWh/day |                                     90 kWh |                       RM15.66/month |

Calculation: shifted kWh × RM0.174/kWh. These are scenario results, not measured savings. If pre-cooling uses more energy than it displaces later, savings shrink or reverse. If an export credit would expire unused, its opportunity cost is lower than the full-credit case.

There are two current bill details to keep separate from that gross calculation:

- ST's 2026 performance booklet lists domestic EEI eligibility at 1,000 kWh/month and below, with rebates up to 25 sen/kWh. BNM's 31 March 2026 review describes the cutoff as less than 1,000 kWh/month. The sources differ at exactly 1,000 kWh. [ST Performance Booklet][r9] [BNM Economic and Monetary Review 2025][r10]
- TNB's 2 October 2026 notice says domestic use of 800 kWh/month or less is exempt from AFA, the RM10 retail charge, and 8% service tax for September–December 2026. September's adjustment was credited pro rata in October. This temporary protection changes eligible customers' actual bills; it does not change the gross per-kWh comparison above. [TNB notice][r11]

For the domestic Time-of-Use tariff, the energy charge is 28.52 sen/kWh at peak and 24.43 sen/kWh off-peak for monthly use up to 1,500 kWh. Capacity and network charges remain 4.55 and 12.85 sen/kWh. Peak is 2–10 pm Monday to Friday; off-peak is 10 pm–2 pm weekdays and all day on weekends and public holidays. [TNB tariff schedule][r2] [ST Performance Booklet][r9]

Thus, 12–2 pm pre-cooling avoids 41.83 sen/kWh in listed variable import charges, while 2–10 pm imports cost 45.92 sen/kWh before other bill items. Analyst's read: the public ATAP guideline does not clearly state how export credits settle against each domestic ToU time band, so confirm that settlement with TNB before modelling a ToU home.

[r9]: https://www.st.gov.my/sites/default/files/2026-03/ST_Performance-Booklet_v2i-%28ZM%29.pdf
[r10]: https://www.investmalaysia.gov.my/media/c42pvntg/bank-negara-malaysia-economic-and-monetary-review-2025.pdf
[r11]: https://www.tnb.com.my/announcements/peningkatan-aras-perlindungan-hingga-800kwj-pelanggan-terima-kredit-pro-rat

## Air-conditioning in Malaysian homes

DOSM's 2024 Basic Amenities Survey reports air-conditioner ownership in 68.8% of Malaysian citizen households, compared with 61.7% in 2022. The report was released on 24 December 2025 and the statistic measures household ownership, not the share of residential electricity consumed by air-conditioning. [DOSM 2024 report][r3]

A 2021 field study measured 19 dwellings in one low-cost Kuala Lumpur apartment complex in Desa Rejang. It reported average total electricity use of 14.5 kWh/day and air-conditioning use of 3.9 kWh/day, or 26.9% by arithmetic. Most air-conditioning use occurred during sleeping hours. This small sample is not a national estimate. [Urban Climate study][r12]

A separate 2021 measurement study of 20 dwellings in Kuala Lumpur and Selangor reported that 75% used air-conditioning almost daily for 5–6 hours. The sample's mean use was 0.93 kWh/day in daytime and 3.43 kWh/day at night. This supports night cooling as a practical target, but the sample is small and older. [Energy and Environment study][r13]

A March 2024 UNEP-U4E market assessment reports a November 2023 IIEC survey of 15 households in Selangor. In that sample, room air-conditioning averaged 41% of household electricity use, fans 8%, and refrigerators/freezers 22%; room AC use averaged about 5.4 hours a day. The assessment says cooling appliances together accounted for 40%–70% of sampled household electricity use. These results add local end-use evidence, but the 15-household sample is not nationally representative. [UNEP-U4E assessment][r4]

Analyst's read: The DOSM ownership statistic and small regional studies do not establish a nationally representative share of household electricity used for air-conditioning. I did not find such a national end-use estimate in the sources reviewed.

[r12]: https://www.sciencedirect.com/science/article/pii/S2212095521000602
[r13]: https://www.beei.org/index.php/EEI/article/view/2299

## Evidence on pre-cooling

- **Australia, 2025 modelling (snippet-only):** The publisher page did not open in this check. Its indexed text describes hourly PV, AC, and net-load data from about 450 households across four Australian capital cities, combined with simulations of nine building types. It reports modelled peak-demand reductions up to 0.8 kW per building and minimum-demand mitigation up to 4 kW per building; comfort was not a significant constraint in the simulated cases. These are Australian model results, not Malaysian household savings. [Building and Environment paper][r14]
- **United States, 2014 simulation (snippet-only):** The eScholarship page returned only a short display in this check. Its indexed paper text says all strategies increased annual cooling energy; shorter, warmer windows generally gave better peak-to-penalty ratios, while longer, cooler schedules could remove a larger share of peak cooling load. This shows that peak reduction does not automatically mean lower annual energy or bills. [LBNL paper](https://escholarship.org/uc/item/4x28r51q)
- **Japan, 2019 measured ZEH cases:** The study measured 10 cases in one net-zero-energy house: four summer and six winter cases. In one six-hour winter radiant preheating case, PV self-consumption increased by 2.1 kWh while battery discharge and grid purchases fell by 3.9 kWh. Winter preheating supports the thermal-storage concept but is not direct evidence for Malaysian summer AC pre-cooling. [Architectural Institute of Japan paper][r15]
- **Singapore, 2022 office simulation:** The paper is in _Sustainable Energy, Grids and Networks_, not _Energy and Buildings_. It modelled demand response in a five-zone small-office building using MATLAB–EnergyPlus co-simulation. The model reported up to 56.67% AC demand curtailment for one hour while keeping modelled temperature deviations within 1°C. This is a commercial-building simulation, not a live household trial. [Publisher page][r16]
- **Malaysia:** Analyst's read: I did not locate a measured Malaysian residential trial that uses rooftop solar to pre-cool before a tariff peak and reports energy, bill, peak, and comfort outcomes. This is a search result, not proof that no such trial exists.
- **Humidity and condensation:** A 2016 article in UTM Press's _Jurnal Teknologi_, written by IIUM-affiliated authors, reports a hot-humid building study. The studied building ran 24-hour cooling in one part, and found overcooling with condensation and mould risk on non-air-conditioned sides of the envelope. It does not show that ordinary pre-cooling causes mould. It supports measuring humidity and cool surface temperatures in a Malaysian pilot. [Journal of Teknologi study][r17]

Analyst's read: The useful hypothesis is a short, shallow pre-cool that stores some cooling in the building fabric, then lets the thermostat relax during peak hours. Pilot settings should respond to room temperature and humidity, with resident override. Overseas models do not justify a fixed schedule or guaranteed Malaysian bill savings.

[r14]: https://www.sciencedirect.com/science/article/pii/S0378778825002865
[r15]: https://www.jstage.jst.go.jp/article/aije/84/755/84_73/_article/-char/ja
[r16]: https://www.sciencedirect.com/science/article/abs/pii/S2352467722000728
[r17]: https://journals.utm.my/jurnalteknologi/article/view/8309

## Products and services

| Product                                 | What it does                                                                                                                                                                                                       | Sold in Malaysia?                                                                                         | Price                                                                                                               | Source                                                                                                               |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Daikin Smart Control / SMARTO           | GO DAIKIN supports remote control, weekly schedules, and usage graphs on supported units.                                                                                                                          | Official Malaysian pages.                                                                                 | SMARTO Standard RM0; Pro RM11.99 per air-conditioner/year after the listed two-year free Pro period.                | [Daikin Smart Control](https://www.daikin.com.my/smart-control/) [SMARTO pricing](https://www.daikin.com.my/smarto/) |
| Panasonic Comfort Cloud                 | Remote control, pre-cooling, monitoring, and weekly timer with up to six operations a day; supports built-in Wi-Fi and optional-adaptor setups.                                                                    | Malaysia App Store and support pages are available.                                                       | App is free. The cited model page now redirects to a general product page, so its prior RM2,041 listing is removed. | [Panasonic setup][r18] [App features][r19] [Product listing][r20]                                                    |
| Midea SmartHome                         | Official Malaysia pages describe remote control, schedules, energy monitoring, scenes, and integration of appliances with solar and battery storage.                                                               | Official Malaysia pages are available.                                                                    | No controller or app price is stated on the cited service page; hardware price varies by model.                     | [Midea SmartHome](https://www.midea.com/my/smarthome) [Midea Malaysia control features][r21]                         |
| Sensibo Air                             | The official product page describes a Wi-Fi infrared controller with app control and schedules for compatible ACs.                                                                                                 | Malaysia marketplace listing and local availability are snippet-only; the cited Shopee page did not open. | The previous RM636.66 local price is removed because it could not be checked.                                       | [Sensibo product](https://sensibo.com/products/sensibo-air) [Malaysia seller listing][r22]                           |
| Broadlink RM4 Mini                      | Wi-Fi infrared blaster for compatible ACs and other IR devices.                                                                                                                                                    | A Malaysian Lazada listing was visible.                                                                   | RM69.90 on the listing checked 16 October 2026; marketplace prices can change.                                      | [Broadlink product][r23] [Malaysia listings][r24]                                                                    |
| myTNB / TNB smart meter                 | TNB says smart-meter customers can view half-hourly usage data through myTNB. The cited monitoring page does not describe AC dispatch.                                                                             | TNB customers with the relevant smart meter/account.                                                      | No separate device-control price listed.                                                                            | [TNB data analytics][r25]                                                                                            |
| Solaroo app                             | Monitors solar-system performance and savings. The cited page does not advertise automatic AC control.                                                                                                             | For Solaroo customers.                                                                                    | No public app price listed.                                                                                         | [Solaroo app](https://solaroo.com/solaroo-app/)                                                                      |
| Amber SmartShift                        | Battery optimisation uses forecast household demand, solar generation, and wholesale prices. It does not directly schedule an AC in the cited description.                                                         | Australia-focused. Analyst's read: Malaysian availability was not verified in the sources checked.        | No Malaysia price.                                                                                                  | [Amber SmartShift help][r26]                                                                                         |
| Octopus Flux / Intelligent Octopus Flux | Flux is a UK solar-and-battery tariff. Standard Flux users schedule battery charging and discharge themselves; Intelligent Flux automates compatible batteries. The cited pages do not describe direct AC control. | UK service. Analyst's read: Malaysian availability was not verified in the sources checked.               | Tariff and battery dependent; no Malaysia price.                                                                    | [Octopus Flux](https://octopus.energy/smart/flux/) [Intelligent Flux][r27]                                           |
| Tesla Powerwall app                     | Time-Based Control and Savings Mode manage Powerwall charging and discharge against solar and tariff settings; they do not directly control an AC in the cited guide.                                              | Analyst's read: Malaysian utility and tariff support was not verified in the sources checked.             | Powerwall and installation pricing varies; no Malaysia app-only price.                                              | [Tesla Savings Mode guide][r28]                                                                                      |

Analyst's read: I did not locate a Malaysian residential service that automatically detects PV surplus and schedules AC pre-cooling, or a household ToU coach tied to AC controls, in the sources reviewed on 16 October 2026. TNB's ToU and smart-meter information are useful inputs, not proof that no such service exists. [TNB ToU information][r9] [TNB smart-meter data][r25]

[r18]: https://www.panasonic.com/my/air-solutions/product-top/comfort-cloud/how-to-set-up-comfort-cloud.html
[r19]: https://apps.apple.com/my/app/panasonic-comfort-cloud/id1348640525
[r20]: https://www.panasonic.com/my/consumer/air-solutions/air-conditioner/cs-xpu13wkh-1.html
[r21]: https://www.midea.com/my/news/best-smart-air-conditioner-control-save-nergy-and-monitor-usage-from-your-phone
[r22]: https://shopee.com.my/Sensibo-Air_Ready-Stock-%28Smart-Aircon-Controller%29_Homekit_Google-Assistant_Alexa-Compatible-i.132815885.4395388902
[r23]: https://www.ibroadlink.com/productinfo/762674.html
[r24]: https://www.lazada.com.my/tag/broadlink-rm4-mini/
[r25]: https://www.tnb.com.my/smart-grid/data-analytics
[r26]: https://help.amber.com.au/hc/en-us/articles/10014159451405-How-does-SmartShift-work
[r27]: https://octopus.energy/intelligent-flux-faqs/faq-powerwall-signup/
[r28]: https://www.tesla.com/support/energy/powerwall/mobile-app/savings-mode-user-guide

## SDP and Elmina context

Sime Darby Property's Sustainability Report 2024 covers FY2024 and says 228 homes in Elmina Ridge 1 were equipped with rooftop solar and battery storage, with total installed capacity of 1 MWp. [SDP Sustainability Report 2024][r5]

**Snippet-only:** The 2025 Sustainability Report PDF did not open in this check. Its indexed text says advanced roof insulation was implemented across the Elmina residential portfolio and that selected homes in Elmina Ridge phases 1 and 2 have rooftop solar and batteries. Separately, SDP's July 2025 launch release says all 221 Elmina Ridge 2 homes have solar, battery storage, EV-charging readiness, and glass mineral-wool roof insulation. [SDP Sustainability Report 2025][r29] [Elmina Ridge 2 release][r30]

TNB reports three Community Energy Storage System units at Elmina Ilham Residence, with battery capacities from 76.8 to 170 kWh. It says rooftop solar generation is stored for local community use and network stability. The TNB page opened for this check does not state that these units reduce transformer peak loading. [TNB battery storage][r6]

SDP's July 2026 release for Tiara Residences 1 in Bukit Jelutong describes 59 homes with solar, integrated batteries, and EV-point readiness. The release says it achieved 85% take-up during its 27 June 2026 launch weekend. [Tiara Residences release][r31]

### Heat outlook

MetMalaysia's long-range outlook, last updated 5 October 2026, says El Niño was at a moderate level and forecast to persist until May 2027. It gives more than 90% probability of reaching the very strong category over late-2026/early-2027 forecast periods and flags slightly below-average rainfall in several northern, southern, and interior areas of Peninsular Malaysia, eastern Sarawak, and eastern Sabah. These are forecasts, not observations. [MetMalaysia Long-Range Weather Outlook][r32]

Bernama reported on 13 October 2026 that MetMalaysia's Director-General expected scorching conditions in March–May 2027 and said temperatures could exceed 41°C. Malaysia's cited record is 40.1°C at Chuping on 9 April 1998. These are forecasts, not observed 2027 temperatures. [Bernama report][r33]

Analyst's read: Elmina is a strong place to test because it has solar-equipped homes, batteries, roof insulation, and neighbourhood storage. A household pre-cooling pilot should coordinate with TNB if it measures community-storage or feeder effects. House-level bill and comfort results can be measured separately.

[r29]: https://www.simedarbyproperty.com/sites/default/files/2026-04/SDP%20SR2025%20%28Mobile%29.pdf
[r30]: https://www.simedarbyproperty.com/press-releases/sime-darby-propertys-elmina-ridge-2-achieves-90-take-phase-1-upon-soft-launch
[r31]: https://www.simedarbyproperty.com/press-releases/sime-darby-property-unveils-tiara-residences-1-bukit-jelutong-secures-85-take-during
[r32]: https://www.met.gov.my/data/climate/tinjauancuacajangkapanjang_en.pdf
[r33]: https://web26.bernama.com/en/general/news.php?id=2619514

## Verdict: worth building?

Analyst's read: Build a pilot, not a large-scale product promise yet. Under the general-tariff example, the gross difference is 17.40 sen for each kWh of solar that would otherwise earn a fully used export credit, or RM10.44/month at 2 shifted kWh/day. This is before EEI, AFA, tax, and other bill effects, and assumes one-for-one cooling displacement.

Analyst's read: Start with opt-in solar homes and real interval data. Record PV generation and export, grid imports, AC-circuit energy, room temperature and relative humidity, and resident overrides. Compare pre-cooling days with matched control days. Report comfort and kWh during the weekday 2–10 pm peak. Use a conservative thermostat change and stop rules for discomfort or damp surfaces. Do not use synthetic household data to claim impact.

Analyst's read: For SDP, the strongest strategic case is a small, measurable retrofit service that turns rooftop solar into cooler evening homes while reducing peak imports. The SuRIA Home rebate may affect eligible solar adoption costs, but it does not establish the payback of a pre-cooling controller. Commercial viability still needs measured installation cost, controller compatibility, participation, and net savings after bill adjustments.

## Sources

1. [SEDA, Guidelines for Solar ATAP][r1], dated 30 December 2025.
2. [SEDA, Solar ATAP programme page](https://www.seda.gov.my/reportal/atap/), current page; it lists the guideline as of 30 December 2025 and the contract updated 1 April 2026.
3. [TNB, Electricity tariff schedule][r2], published/file dated 2 July 2025; tariff period shown as 1 July 2025–31 December 2027.
4. [Suruhanjaya Tenaga, tariff reform announcement](https://www.st.gov.my/ms/node/766), 20 June 2025.
5. [Bank Negara Malaysia, Economic and Monetary Review 2025][r10], released 31 March 2026.
6. [DOSM, Basic Amenities Survey Report Malaysia 2024][r3], released 24 December 2025; survey year 2024.
7. [Urban Climate, field measurements in Kuala Lumpur][r12], 2021.
8. [Energy and Environment, residential AC measurements][r13], Vol. 10, No. 1 (2021).
9. [Building and Environment, Australian residential pre-cooling modelling][r14], 2025; publisher page was snippet-only in this check.
10. [Lawrence Berkeley National Laboratory, pre-cooling simulations](https://escholarship.org/uc/item/4x28r51q), 2014; page display was snippet-only in this check.
11. [Architectural Institute of Japan, measured ZEH cases][r15], 2019.
12. [Sustainable Energy, Grids and Networks, Singapore office demand-response simulation][r16], September 2022.
13. [UTM Press, condensation and mould in a hot-humid building][r17], 18 April 2016; authors are IIUM-affiliated.
14. [Panasonic Comfort Cloud setup][r18].
15. [Daikin Malaysia Smart Control and SMARTO](https://www.daikin.com.my/smart-control/) and [SMARTO pricing](https://www.daikin.com.my/smarto/).
16. [Midea Malaysia SmartHome](https://www.midea.com/my/smarthome).
17. [Sensibo Air product](https://sensibo.com/products/sensibo-air); its cited Malaysian seller page did not open.
18. [Broadlink RM4 Mini product][r23] and [Malaysia listings][r24], accessed 16 October 2026.
19. [TNB smart-meter data analytics][r25].
20. [Solaroo app](https://solaroo.com/solaroo-app/).
21. [Amber SmartShift][r26], updated 24 April 2026.
22. [Octopus Flux](https://octopus.energy/smart/flux/) and [Intelligent Flux][r27].
23. [Tesla Powerwall Savings Mode][r28].
24. [SDP Sustainability Report 2024][r5], FY2024; approved 26 March 2025.
25. [SDP Sustainability Report 2025][r29], published in 2026; PDF was snippet-only in this check.
26. [TNB battery management and community storage][r6].
27. [SDP, Elmina Ridge 2 launch release][r30], 3 July 2025.
28. [SDP, Tiara Residences 1 launch release][r31], 6 July 2026.
29. [MetMalaysia, Long-Range Weather Outlook][r32], updated 5 October 2026.
30. [Bernama, MetMalaysia heat outlook report][r33], 13 October 2026.
31. [UNEP-U4E, Malaysia air-conditioner market assessment][r4], March 2024; household field survey conducted November 2023.
32. [Suruhanjaya Tenaga, Performance Booklet][r9], 2025 performance booklet, published in 2026.
33. [TNB, domestic bill protection at 800 kWh][r11], 2 October 2026.
34. [SEDA, SuRIA Home rebate notice][r8], 4 June 2026.
35. [ST, Guidelines on Electricity Tariff Determination under IBR for Peninsular Malaysia 2025][r7].
