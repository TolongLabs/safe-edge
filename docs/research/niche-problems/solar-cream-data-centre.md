# Could a data centre buy the township's rooftop solar?

Deep-dive evidence on whether a data centre could buy a township's rooftop solar under the CREAM scheme, researched and then fact-checked by two separate Codex runs on 16 October 2026 for [Niche township problems](/docs/research/niche-problems.md). The checker tested 57 claims: 33 confirmed, 18 corrected, 0 removed and 6 it could only see in search snippets. Lines marked "Analyst's read" are the worker's inference, not findings.

Contents:

1.  [Summary](#summary)
1.  [CREAM rules](#cream-rules)
1.  [SDP's CREAM programme today](#sdps-cream-programme-today)
1.  [How data centres buy green power in Malaysia](#how-data-centres-buy-green-power-in-malaysia)
1.  [Scale comparison](#scale-comparison)
1.  [Precedents of data centres funding neighbours' solar](#precedents-of-data-centres-funding-neighbours-solar)
1.  [Homeowner barriers to roof leasing](#homeowner-barriers-to-roof-leasing)
1.  [Verdict: legally possible, practically useful?](#verdict-legally-possible-practically-useful)
1.  [Sources](#sources)

## Summary

- Analyst's read: **CREAM can supply a nearby commercial buyer only if the buyer has a registered low- or medium-voltage account.** The guideline gives no numerical minimum demand in its eligibility clause. It requires monthly energy allocations to be declared, and energy above the LGC's maximum monthly demand caused by generation-demand imbalance is uncompensated. MIDA's sustainable-data-centre guideline lists high voltage at 132 kV and above and power capacity above 21.25 MW for its hyperscale commercial single-tenant/service-provider category. An account at that voltage is not eligible as a CREAM LGC. [CREAM guideline][r1] · [MIDA data-centre guideline][r2]
- CREAM allows rooftop solar on landed homes and requires an eligible nearby LGC. The latest verified CAC rate is 9 sen/kWh. It is one CAC rate, not a separate firm-energy rate. The approximately 5 km distance rule is based on the utility substations connecting the solar plant and buyer. [ST CREAM FAQ][r3] · [ST CREAM guideline][r1] · [PETRA CAC announcement, 29 August 2025][r4]
- SDP launched its Elmina CREAM pilot on 26 September 2025. TNB's 2025 annual-report search extract describes an ongoing 4.5 MWp programme for 450 homes across Elmina and Bandar Bukit Raja. Another extract says Elmina network upgrades were preparation for home solar installations. These extracts do not establish the number of homes commissioned or operating by 16 October 2026. [TNB Integrated Annual Report 2025][r5] · [SDP launch announcement][r6]
- Analyst's read: **The rooftop programme is a neighbour benefit, not a substitute for hyperscale power procurement.** The 4.5 MWp figure is solar nameplate capacity. Bernama reported a 100 MW first-phase estimate for Google's Elmina data centre from an unnamed investment-bank research note, not a Google disclosure. [TNB Integrated Annual Report 2025][r5] · [Bernama, 26 August 2025][r7]
- Analyst's read: **CREAM can transfer green attributes to an eligible LGC by contract, but a typical hyperscale high-voltage account does not meet CREAM's buyer rule.** A nearby eligible account, such as SDP's Innovation Park, is a closer fit. [CREAM guideline][r1] · [SDP launch announcement][r6]

[r1]: https://www.st.gov.my/sites/default/files/2026-03/CREAM-GUIDELINE_FINAL_2.pdf
[r2]: https://www.mida.gov.my/wp-content/uploads/2024/12/Guideline-for-Sustainable-Development-of-Data-Centre.pdf
[r3]: https://www.st.gov.my/contents/2025/CREAM/CREAM%20FAQ_1%20_V2.pdf
[r4]: https://www.st.gov.my/sites/default/files/2026-03/siaran_mediaeng_2.pdf
[r5]: https://www.tnb.com.my/assets/annual_report/TNB_IAR_2025.pdf
[r6]: https://www.simedarbyproperty.com/press-releases/sime-darby-property-launches-nations-first-residential-solar-project-under-netr
[r7]: https://garasi.bernama.com/stories/can-selangor-handle-the-data-centre-boom

## CREAM rules

| Rule                                  | What it says                                                                                                                                                                                                                                                                                                                                                                                                                                      | Source                                                                                                                                               |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Who runs it                           | The Energy Commission (Suruhanjaya Tenaga, ST) issues the scheme rules. A Local Energy Generator and Aggregator (LEGA) owns and operates the community solar plant and contracts with a Local Green Consumer (LGC). The Single Buyer administers LEGA registration and CAC billing and settlement. The electricity utility handles last-mile supply and network services. In SDP's pilot, TNB subsidiary GSPARX is the technical partner.         | [ST CREAM guideline][r1] · [SDP launch announcement][r6]                                                                                             |
| Announcement and start                | PETRA said it would introduce CREAM on 7 February 2025. SDP announced its rollout with TNB on 28 April 2025 and launched the Elmina pilot on 26 September 2025. ST set 1 June 2025 as the application start date.                                                                                                                                                                                                                                 | [PETRA announcement, 7 February 2025][r8] · [ST CREAM guideline][r1] · [SDP rollout announcement, 28 April 2025][r9] · [SDP launch announcement][r6] |
| Eligible roofs                        | CREAM covers rooftop solar on landed residential houses in Peninsular Malaysia. Condominiums and apartments are excluded.                                                                                                                                                                                                                                                                                                                         | [ST CREAM guideline][r1]                                                                                                                             |
| Eligible aggregator                   | The LEGA must meet ST registration and licensing requirements, operate in Peninsular Malaysia, and have at least 51% local ownership. It contracts with participating homeowners and the LGC.                                                                                                                                                                                                                                                     | [ST CREAM guideline][r1]                                                                                                                             |
| Eligible green buyer                  | An LGC must be a “registered low or medium voltage consumer under any category” with the electricity utility in Peninsular Malaysia. ST's FAQ says a business may be the LGC. The guideline gives no numerical demand threshold in the buyer eligibility clause. It requires the LEGA to declare monthly output and energy allocations; energy above the buyer's maximum monthly demand caused by generation-demand imbalance is not compensated. | [ST CREAM guideline][r1] · [ST CREAM FAQ][r3]                                                                                                        |
| Plant size, feeder and quota          | A CREAM solar plant must be at least 100 kWp and no more than 2 MWp per 11 kV feeder, subject to a power-system study. The study sets export capacity, with a 100 kW minimum. ST's FAQ says participation is open without an overall quota, subject to approval and the technical and capacity rules.                                                                                                                                             | [ST CREAM guideline][r1] · [ST CREAM FAQ][r3]                                                                                                        |
| Distance                              | The plant and LGC must be within an approximately 5 km radius. ST's FAQ clarifies that the measurement is a straight line between the utility substations connecting the plant and LGC, and says the 5 km rule is strict. It is not a roof-to-building measurement.                                                                                                                                                                               | [ST CREAM guideline][r1] · [ST CREAM FAQ][r3]                                                                                                        |
| Community access charge               | The latest verified CAC is 9 sen/kWh. PETRA's 29 August 2025 rate table applies that single rate to CREAM; it does not classify the CAC as firm or non-firm energy. The guideline fixes CAC for a three-year regulatory period and allows a change of up to 15% at the start of a new period.                                                                                                                                                     | [PETRA CAC announcement, 29 August 2025][r4] · [ST CREAM guideline][r1]                                                                              |
| Contract length and homeowner payment | CREAM sets no standard roof-lease duration or rent. The homeowner–LEGA agreement sets the duration, compensation, maintenance responsibilities and other commercial terms.                                                                                                                                                                                                                                                                        | [ST CREAM guideline][r1]                                                                                                                             |
| Excess generation                     | Energy above the LGC's maximum monthly demand due to generation-demand imbalance is uncompensated and treated as free energy to the distribution system. Separately, after discontinuation of a bilateral contract, the LEGA may sell qualifying excess energy through NEDA at 8 sen/kWh, subject to system conditions; CAC does not apply to that energy.                                                                                        | [ST CREAM guideline][r1] · [ST CREAM FAQ][r3]                                                                                                        |
| Renewable attributes and certificates | Green attributes initially belong to the LEGA and may be transferred to the LGC under the bilateral supply contract. Attributes for excess energy sold to the distribution system belong to the Single Buyer. The LGC must redeem transferred attributes in Malaysia under the guideline. ST's FAQ names no approved REC registry and advises consulting relevant authorities or recognized registries.                                           | [ST CREAM guideline][r1] · [ST CREAM FAQ][r3]                                                                                                        |

[r8]: https://www.petra.gov.my/uploads/content-downloads/file_20250218091303.pdf
[r9]: https://www.simedarbyproperty.com/sites/default/files/2025-04/20250428%20-%20For%20Immediate%20Release%20-%20Sime%20Darby%20Property%20Leads%20Nation%E2%80%99s%20First%20Community%20Solar%20Rollout%20Under%20NETR%20with%20TNB.pdf

## SDP's CREAM programme today

SDP announced a residential solar rollout with TNB on 28 April 2025 and launched its Elmina pilot on 26 September 2025. SDP was named as LEGA, with GSPARX as its technical partner. The first named LGC was SDP's Innovation Park in City of Elmina, within the stated 5 km catchment. [SDP announcement, 28 April 2025][r9] · [SDP launch announcement][r6]

TNB's 2025 Integrated Annual Report search extract reports a 4.5 MWp programme involving 450 homes in City of Elmina and Bandar Bukit Raja, and calls it ongoing (**snippet only**). The same extract says Elmina network upgrades were preparation for upcoming home solar installation. It gives no town-by-town split and does not show that all 450 homes had signed or been commissioned. [TNB Integrated Annual Report 2025][r5]

SDP's 2025 sustainability report search extract says residential solar was implemented “at scale” (**snippet only**). It gives no CREAM-specific home count, commissioned capacity or exported energy. SDP says homeowners need no upfront investment and can receive income from roof leasing, but publishes no standard rent or lease duration. TNB's CREAM explainer search extract describes a proposed 6 kW offer for participating homes in Elmina Ilham Residence Phase 4 (**snippet only**). A separate TNB page's search extract refers to 223 homes with 6 kW rooftop-leasing systems, but does not identify that group as CREAM; do not count those homes as confirmed CREAM uptake (**snippet only**). [SDP Sustainability Report 2025][r10] · [SDP launch announcement][r6] · [TNB CREAM explainer][r11] · [TNB DER integration][r12]

SDP has said it is looking for additional LGCs, including petrol stations, commercial hubs and nearby schools. Each prospective LGC still needs an eligible registered account and must pass the distance test. [SDP launch announcement][r6] · [ST CREAM guideline][r1]

As of 16 October 2026, public status evidence is mixed. SDP's 2025 sustainability report calls the programme implemented “at scale” (**snippet only**); TNB's 2025 report calls the 4.5 MWp programme ongoing and describes installation preparation (**snippet only**). The Edge's 20–26 April 2026 weekly article reported little progress since the CAC reduction. [SDP Sustainability Report 2025][r10] · [TNB Integrated Annual Report 2025][r5] · [The Edge, 20 April 2026](https://theedgemalaysia.com/node/800789)

Analyst's read: I did not find a public CREAM-specific count of participating homes, confirmed commissioned capacity, exported MWh or redeemed certificates in the sources reviewed. TNB's separate leased-roof figures do not identify themselves as CREAM.

[r10]: https://www.simedarbyproperty.com/sites/default/files/2026-04/SDP%20SR2025%20%28Mobile%29.pdf
[r11]: https://www.tnb.com.my/sustainability/esg-stories-cream-community-renewable-energy
[r12]: https://www.tnb.com.my/smart-grid/der-integration

## How data centres buy green power in Malaysia

**CRESS.** The Corporate Renewable Energy Supply Scheme lets a renewable energy developer (RED) contract directly with a registered Green Consumer (GC), with electricity delivered over the Peninsular grid. The GC must have a registered medium- or high-voltage account. A RED must have at least 51% local ownership; its plant must be at least 30 MW and connect to the grid. A dedicated line between the plant and GC is not allowed. Standard System Access Charges are 20 sen/kWh for firm supply and 40 sen/kWh for non-firm supply. The guideline fixes SAC for a three-year regulatory period, with revisions only at the next period and capped at 15%. CRESS attributes belong to the RED and transfer to the GC under the bilateral contract; the GC redeems the RECs under the guideline. [ST CRESS guideline][r13] · [PETRA charge announcement][r4]

PETRA announced the CRESS Acceleration Package on 18 September 2026. For eligible projects, the RED's firm SAC is 14 sen/kWh, fixed for 10 years from commercial operation. The GC pays a separate SAC through TNB's billing system. PETRA's package material lists 4 sen/kWh for GCs in RP4, subject to review in a later regulatory period. This is not the GC's all-in electricity cost, which also depends on the bilateral energy price and other tariff charges. The package has eligibility criteria and a commercial-operation deadline of 31 December 2028. [PETRA package announcement, 18 September 2026][r14] · [ST fixed RED rate][r15] · [ST GC charge treatment][r16] · [ST cost clarification][r17] · [ST package criteria][r18]

**TNB Green Electricity Tariff (GET).** GET lets TNB customers buy renewable-energy attributes through TNB on top of their regular electricity supply. TNB's published 2025 schedule lists one-, two- and three-year premiums of 20, 19 and 18 sen/kWh for domestic and low-voltage non-domestic customers, and 5, 4 and 3 sen/kWh for medium- and high-voltage non-domestic customers. TNB says the certificates are mRECs; customers do not select a particular plant or receive dedicated physical electricity from it. The current TNB page shows monthly available quota of 0, but does not label the figure by year, so I could not verify availability for a specific 2026 enrolment period. [TNB GET](https://www.tnb.com.my/get)

**Large-scale solar and corporate PPAs.** ST's Large Scale Solar programme selects utility-scale solar projects through competitive bidding. CRESS and the Corporate Green Power Programme (CGPP) provide corporate procurement routes with different contract and delivery arrangements. [ST Large Scale Solar][r19] · [ST CGPP][r20] · [ST CRESS guideline][r13]

Google says it aims to run on 24/7 carbon-free energy on every grid where it operates by 2030. It announced its first Malaysian data centre at Elmina Business Park on 30 May 2024; that announcement did not state the facility's power demand. [Google data-centre sustainability][r21] · [Google Malaysia investment announcement][r22]

Two Google solar PPAs were announced in December 2025. Shizen Energy announced a 29.99 MWac solar project at Gurun under CGPP, with Google as buyer and planned commercial operation in 2027. TotalEnergies announced a 21-year PPA for 1 TWh of renewable electricity from Citra Energies' Kedah solar project, described as equivalent to 20 MW; its 16 December 2025 release scheduled construction to start in early 2026. Analyst's read: I did not find a later official commissioning update for either project in the sources reviewed; the December 2025 announcements alone do not establish operation by 16 October 2026. [Shizen Energy, 15 December 2025][r23] · [TotalEnergies, 16 December 2025][r24]

**Could CREAM count toward a data centre's local clean-energy claim?**

Analyst's read: The guideline lets an LGC receive CREAM green attributes if the LEGA transfers them under the bilateral contract. That could support a renewable-energy claim for the eligible LGC, but attributes must be transferred and redeemed, and the buyer account must meet the voltage and distance rules. [ST CREAM guideline][r1] · [ST CREAM FAQ][r3]

Analyst's read: A high-voltage data-centre account in MIDA's hyperscale category is not eligible to be a CREAM LGC under the current voltage rule. CREAM can support a nearby eligible SDP commercial account, but the cited rules do not establish that this account's attributes can be assigned to an unrelated high-voltage data-centre account or count toward Google's hourly 24/7 matching goal. A data-centre-specific claim should identify the contracting entity and account, attribute transfer and retirement, and the time period covered. [MIDA data-centre guideline][r2] · [Google data-centre sustainability][r21]

[r13]: https://www.st.gov.my/sites/default/files/2026-04/Guidelines-for-CRESS_2.pdf
[r14]: https://www.petra.gov.my/uploads/content-downloads/file_20260918161406.pdf
[r15]: https://www.st.gov.my/what-fixed-sac-rate-offered-red-under-cress-acceleration-package
[r16]: https://www.st.gov.my/what-sac-rate-will-be-paid-gc-under-cress-acceleration-package
[r17]: https://www.st.gov.my/does-cress-acceleration-package-guarantee-overall-electricity-cost-gc
[r18]: https://www.st.gov.my/sites/default/files/2026-10/CRESS-Acceleration-Package-Criteria.pdf
[r19]: https://www.st.gov.my/sourcing/large-scale-solar-photovoltaic
[r20]: https://www.st.gov.my/sustainability/energy-transition-programmes/corporate-green-power-programme
[r21]: https://www.datacenters.google/operating-sustainably/
[r22]: https://www.googlecloudpresscorner.com/2024-05-30-Advancing-Malaysia-Together-Google-Announces-US-2-Billion-Investment-in-Malaysia%2C-Including-First-Google-Data-Center-and-Google-Cloud-Region
[r23]: https://www.shizenenergy.net/en/2025/12/15/se_signs_ppa_google_in_malaysia/
[r24]: https://totalenergies.com/newsroom/malaysia-totalenergies-signs-new-renewable-power-agreement-with-google-to-supply-data-centers/?lang=eng

## Scale comparison

MIDA's sustainable-data-centre guideline lists the hyperscale commercial single-tenant/service-provider private category as high voltage at 132 kV and above, with power capacity above 21.25 MW. This is a category in that guideline, not a universal definition of every data centre. [MIDA data-centre guideline][r2]

TNB's 4.5 MWp CREAM figure is reported for 450 homes across Elmina and Bandar Bukit Raja (**snippet only**). Bernama reported estimates of 100 MW for Google's first Elmina phase and 200–250 MW for its second phase, citing an unnamed investment-bank research note rather than Google. A Selangor State Assembly response in 2026 said the first phase was operating in 2025 and the second was expected in 2028, but gave no power figure. Google's May 2024 announcement did not publish the facility's MW demand. [TNB Integrated Annual Report 2025][r5] · [Bernama, 26 August 2025][r7] · [Selangor State Assembly response, 2026][r25] · [Google Malaysia investment announcement][r22]

Analyst's read: Comparing 4.5 MWp with the 21.25 MW category threshold gives about 21.2%; comparing it with Bernama's 100 MW first-phase estimate gives 4.5%. Against the reported 300–350 MW combined phase estimates, it is about 1.3–1.5%. These are rough scale comparisons only. MWp is solar nameplate capacity, not round-the-clock delivered power, and Bernama's data-centre figures are secondary estimates rather than Google disclosures. [TNB Integrated Annual Report 2025][r5] · [MIDA data-centre guideline][r2] · [Bernama, 26 August 2025][r7]

[r25]: https://dewan.selangor.gov.my/question/kelestarian-tenaga-dan-air-bagi-pembangunan-pusat-data/

## Precedents of data centres funding neighbours' solar

- **Malaysia — AIMS data centre and Time Energy.** PETRA reported that Time Energy and AIMS Group signed an MoU on 23 June 2025 for a proposed CREAM arrangement aggregating residents' rooftop solar for supply to the AIMS data centre. This confirms an MoU and proposed model, not scheme approval, commissioning or operating supply. [PETRA announcement, 23 June 2025][r26]
- **United States — Frederick County, Maryland.** On 1 September 2026, Frederick Digital Campus announced a draft community-benefits proposal that included $5 million for a community-solar project. Frederick County says the County Executive rejected Catellus's application for a Development Rights and Responsibilities Agreement on 14 September. The solar project remains a proposal, not an operating benefit. [Developer proposal, 1 September 2026][r27] · [Frederick County status][r28]
- **United States — Digital Realty in Illinois.** Digital Realty's 9 September 2025 announcement search extract reports a 33.5 MWdc community-solar portfolio, with 13.4 MWdc attributed to its share, intended to support local grids and benefit Illinois residents (**snippet only**). This is a data-centre operator buying a share of community-solar output, not a rooftop-leasing scheme. [Digital Realty announcement][r29]
- **United States — Google and Cypress Creek in Arkansas.** On 14 July 2026, the companies announced construction of the Steel River solar-and-storage project. Google committed $5 million to energy-affordability initiatives that include community-solar subscriptions for low-income residents, plus school energy-efficiency projects and home improvements. This combines a large renewable-energy purchase with local benefits; it is not a nearby household-roof leasing programme. [Cypress Creek project announcement][r30]
- **Asia — Microsoft and ReNew in India.** Microsoft's February 2026 community-benefits report describes a summer 2024 agreement to buy environmental attributes from a 437.6 MW hybrid wind-and-solar project in Maharashtra, alongside green-skilling, livelihood, pollution-remediation, water-purification, energy-access and rural-electrification initiatives. This is procurement paired with community benefits, not a data-centre-specific rooftop scheme. [Microsoft community-benefits report, February 2026][r31]
- **Europe.** Analyst's read: Targeted searches did not find a European example of a data-centre operator directly buying or funding community solar for nearby residents. A verified adjacent example is Microsoft's Ireland initiative, published 16 June 2026: Microsoft, local councils and EnergyCloud said they would use surplus renewable electricity to provide free hot water to 400 social homes near current and potential data-centre operations, with 200 homes in Kildare and 200 in South Dublin. It is a community-energy benefit, not a solar-rooftop purchase. [Microsoft Ireland example, 16 June 2026][r32]

[r26]: https://www.petra.gov.my/v2/latest-news-details?id=Lawatan+Ke+Pusat+Data+AIMS+dan+Taklimat+Pelaksanaan+Program+Community+Renewable+Energy+Aggregation+Mechanism+%28CREAM%29+oleh+Syarikat+Time+Energy+Sdn+Bhd
[r27]: https://www.frederickdigitalcampus.com/news/community-benefits-agreement
[r28]: https://frederickcountymd.gov/9310/Data-Centers
[r29]: https://www.digitalrealty.com/about/newsroom/press-releases/123342/digital-realty-expands-commitment-to-clean-energy-with-renewable-investments-in-illinois
[r30]: https://cypresscreekenergy.com/news/steel-river-groundbreaking/
[r31]: https://local.microsoft.com/wp-content/uploads/2026/02/FY26-Community-Benefits-in-Renewable-Energy-White-Paper_Final_Feb2026.pdf
[r32]: https://news.microsoft.com/source/emea/features/turning-surplus-renewable-energy-into-free-hot-water-for-homes-in-kildare-and-dublin/

## Homeowner barriers to roof leasing

- **Leaks and roof damage.** The guideline leaves maintenance, property damage and liability terms to the homeowner–LEGA agreement. ST, the Single Buyer and the utility do not resolve those private disputes. The scheme sets no standard roof-repair process. [ST CREAM guideline][r1]
- **Existing roof warranties.** Analyst's read: I found no CREAM rule or public SDP homeowner term on preserving a builder's roof warranty after panel installation. TNB's separate residential solar FAQ describes guarantees for its own solar offers; those terms do not automatically apply to CREAM. [TNB solar FAQ](https://www.tnb.com.my/solar/faq)
- **Resale.** The guideline requires a new agreement if the homeowner changes. Analyst's read: this creates a transfer issue; the guideline does not promise automatic assignment of the roof lease. [ST CREAM guideline][r1]
- **Insurance.** Analyst's read: I found no CREAM-wide rule specifying who insures panels, the house, installation work, third-party injury or storm damage in the materials reviewed.
- **Strata rules.** Condominiums and apartments are excluded from CREAM, so the scheme does not provide a route for an individual unit owner to lease a strata rooftop through CREAM. This eligibility limit does not establish that all other forms of strata solar are barred. [ST CREAM guideline][r1]

Analyst's read: Before joining, a homeowner should get written terms for leak repairs, roof access, panel removal and reinstatement, insurance, rent and payment timing, and transfer on sale. CREAM's reliance on private agreements for property obligations and its new-agreement rule after an ownership change make those terms important. [ST CREAM guideline][r1] · [SDP launch announcement][r6]

## Verdict: legally possible, practically useful?

Analyst's read: **A data centre account in MIDA's hyperscale high-voltage category is not directly eligible to be a CREAM LGC under the current low- or medium-voltage buyer rule.** A nearby low- or medium-voltage commercial account can qualify if it meets the substation-based distance test and the parties complete the required contracts and approvals. SDP's Innovation Park is a concrete local example; CREAM does not require the buyer to be a data centre. [ST CREAM guideline][r1] · [MIDA data-centre guideline][r2] · [SDP launch announcement][r6]

Analyst's read: **CREAM is practically useful as a neighbour benefit and local procurement story, but the reported 4.5 MWp is small beside the secondary Elmina data-centre load estimates.** Solar nameplate capacity is not firm power, and public sources reviewed do not establish CREAM's operating home count or delivered energy. CRESS is a more suitable procurement route for a qualifying data-centre load; CREAM can serve an eligible nearby account with transparent financial and environmental benefits for participating residents. [TNB Integrated Annual Report 2025][r5] · [Bernama, 26 August 2025][r7] · [ST CRESS guideline][r13]

Analyst's read: **A local clean-energy claim is supportable for the eligible LGC if the contract transfers the attributes and they are redeemed.** The cited rules do not establish that CREAM energy can be assigned to an unrelated high-voltage data-centre account or counted as hourly 24/7 clean energy. [ST CREAM guideline][r1] · [ST CREAM FAQ][r3] · [Google data-centre sustainability][r21]

## Sources

1. [Energy Commission, CREAM Guideline][r1] — first-version guideline under registration GP/ST/No. 55/2025; applications start 1 June 2025.
2. [Energy Commission, CREAM FAQ][r3] — no issue date visible in the PDF.
3. [PETRA, CREAM announcement, Malay][r8] — dated 7 February 2025; says PETRA would introduce CREAM.
4. [PETRA / Energy Commission, community access charge announcement][r4] — dated 29 August 2025; sets CREAM CAC at 9 sen/kWh.
5. [Sime Darby Property, first CREAM rollout announcement][r9] — dated 28 April 2025.
6. [Sime Darby Property, Elmina project launch][r6] — dated 26 September 2025.
7. [Tenaga Nasional Berhad, Integrated Annual Report 2025][r5] — FY2025 report published in 2026; direct PDF extraction did not work, so the 4.5 MWp / 450-home and installation-preparation details remain snippet-only.
8. [Sime Darby Property, Sustainability Report 2025][r10] — FY2025 report; “at scale” statement remains snippet-only.
9. [TNB, CREAM explainer][r11] — current page; no publication date shown; proposed 6 kW detail remains snippet-only.
10. [TNB, Distributed Energy Resources integration][r12] — current page; no publication date shown; 223-home figure remains snippet-only and is not identified as CREAM.
11. [The Edge, CREAM progress report](https://theedgemalaysia.com/node/800789) — first appeared in the weekly issue dated 20–26 April 2026.
12. [PETRA, Time Energy and AIMS CREAM MoU, Malay][r26] — dated 23 June 2025.
13. [Energy Commission, CRESS Guideline][r13] — third version dated 29 December 2025; ST page lists the solar CRESS guideline as issued 6 January 2026.
14. [Energy Commission, CRESS Acceleration Package][r33] — current ST package page, opened 16 October 2026.
15. [Energy Commission, CRESS Acceleration Package criteria][r18] — official criteria document linked from ST's package page.
16. [TNB, Green Electricity Tariff](https://www.tnb.com.my/get) — current page; 2025 premium rates are effective from 1 July 2025.
17. [Energy Commission, Large Scale Solar][r19] — current programme page; no publication date shown.
18. [Energy Commission, Corporate Green Power Programme][r20] — current programme page; no publication date shown.
19. [Google, data-centre sustainability and 24/7 carbon-free energy][r21] — current page; Google says the 24/7 goal is for 2030.
20. [Google, Malaysia investment and data-centre announcement][r22] — dated 30 May 2024.
21. [Shizen Energy, Google solar PPA announcement][r23] — dated 15 December 2025.
22. [TotalEnergies, Google renewable power agreement][r24] — dated 16 December 2025.
23. [MIDA, Guideline for Sustainable Development of Data Centres][r2] — December 2024 PDF path; hyperscale thresholds appear in Appendix 1.
24. [Bernama, Google data-centre power estimates in Selangor][r7] — dated 26 August 2025; attributes estimates to an unnamed investment-bank note.
25. [Selangor State Assembly, data-centre sustainability response][r25] — response for the 2026 session held 20 April–4 May 2026.
26. [Frederick Digital Campus, community-benefits proposal][r27] — dated 1 September 2026.
27. [Frederick County, data-centre status][r28] — page reports the County Executive's decision on 14 September 2026.
28. [Digital Realty, Illinois community-solar announcement][r29] — dated 9 September 2025; exact capacity details are available in search extract only.
29. [Cypress Creek, Steel River project and community benefits][r30] — dated 14 July 2026.
30. [Microsoft, community benefits in renewable energy report][r31] — February 2026.
31. [Microsoft, Ireland household hot-water community-energy example][r32] — published 16 June 2026.
32. [TNB, residential solar FAQ](https://www.tnb.com.my/solar/faq) — current FAQ; no publication date shown; warranty terms apply to TNB's separate offers.
33. [PETRA, CRESS Acceleration Package announcement][r14] — dated 18 September 2026; includes the 4 sen/kWh RP4 GC charge and its review note.
34. [Energy Commission, fixed RED SAC under the CRESS Acceleration Package][r15] — current ST Q&A page, opened 16 October 2026.
35. [Energy Commission, Green Consumer SAC under the CRESS Acceleration Package][r16] — current ST Q&A page, opened 16 October 2026.
36. [Energy Commission, CRESS Acceleration Package overall-cost clarification][r17] — current ST Q&A page, opened 16 October 2026.

[r33]: https://www.st.gov.my/sustainability/energy-transition-programmes/corporate-renewable-energy-supply-scheme/cress-acceleration-package
