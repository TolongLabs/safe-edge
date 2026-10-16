# Water-supply cuts and low pressure in new and growing Selangor townships

Quick screen of water cuts and low pressure in Selangor townships, run by one Codex worker on 16 October 2026 for [Niche township problems](/docs/research/niche-problems.md). It was not fact-checked; treat its numbers as leads. Lines marked "Analyst's read" are the worker's inference, not findings.

Contents:

1.  [One-line problem](#one-line-problem)
1.  [Scale and 2024 to 2026 evidence (bullets with numbers and sources)](#scale-and-2024-to-2026-evidence-bullets-with-numbers-and-sources)
1.  [Why now (a 2025 or 2026 trigger, if any)](#why-now-a-2025-or-2026-trigger-if-any)
1.  [Who suffers and who owns the fix](#who-suffers-and-who-owns-the-fix)
1.  [SDP's lever (what SDP controls: before handover, defect period, township management, its own assets)](#sdps-lever-what-sdp-controls-before-handover-defect-period-township-management-its-own-assets)
1.  [What already exists (products, services, programmes, hackathon projects)](#what-already-exists-products-services-programmes-hackathon-projects)
1.  [Real data a prototype could use (open datasets or APIs, with URLs)](#real-data-a-prototype-could-use-open-datasets-or-apis-with-urls)
1.  [What a strong solution could be](#what-a-strong-solution-could-be)
1.  [Kill risks (3 bullets)](#kill-risks-3-bullets)
1.  [Scores (1 to 5 each, one line of reason each): Pain, SDP lever, Evidence available, Crowding (5 = very crowded). Then: Edge = Pain x Lever x Evidence / Crowding.](#scores-1-to-5-each-one-line-of-reason-each-pain-sdp-lever-evidence-available-crowding-5-very-crowded-then-edge-pain-x-lever-x-evidence-crowding)
1.  [Sources (numbered list)](#sources-numbered-list)

## One-line problem

Analyst's read: New phases can outgrow local reticulation or arrive with incomplete storage and pumping systems, while upstream outages still leave residents and businesses waiting for clear restoration information and practical backup supply.

## Scale and 2024 to 2026 evidence (bullets with numbers and sources)

- Air Selangor's 2024 sustainability table records **55 unscheduled large-pipe outages (1,691 summed disruption-hours), 21 pump-house failures (242 hours), 63 water-treatment-plant shutdowns (1,003 hours), 4 scheduled maintenance events (176 hours), and 1 reservoir issue (48 hours)**. These are operator-wide category totals; hours are not household-hours. [Air Selangor Sustainability Report 2024](https://content.airselangor.com/cmi-prod-blobstorageanon-001-sea/media/o4wnyn50/air-selangor-sustainability-report-2024-03062025-compressed.pdf)
- A search-result snippet for the **SPAN Water & Sewerage Fact Book 2024** reports **1,954 scheduled and 10,312 unscheduled interruptions** in Selangor for **2024**. _(snippet only; a copy is hosted on Scribd and I did not locate the original official PDF)_ Its scope appears broader than Air Selangor's categorized incident table above, so do not compare the counts directly. [SPAN Fact Book copy](https://www.scribd.com/document/997229858/SPAN-Water-Sewage-Factbook-2024)
- In a **2025** state assembly answer published in **2026**, Air Selangor logged **16 low-pressure complaints in Pasir Tuntong and 42 in Bukit Kuching**. The same answer lists five pipe bursts in those areas lasting **4–14 hours**. After pipe and distribution changes, reported average pressure rose from **5 to 12 mH** in Pasir Tuntong and **4 to 10 mH** in Bukit Kuching, with no further complaints reported at the answer date. _(snippet only; official assembly page text was indexed but not directly retrievable)_ [Kuala Selangor assembly answer](https://dewan.selangor.gov.my/question/tekanan-air-di-kuala-selangor/)
- In Klang, the **2025** Sementa answer attributes peak-hour low pressure in Bukit Kapar, Kampung Perepat, Kampung Sementa, Kampung Batu 4 and Kampung Rantau Panjang to demand from ongoing development exceeding the capacity of a **150 mm** reticulation pipe. _(snippet only)_ [Sementa assembly answer](https://dewan.selangor.gov.my/question/bekalan-air-mentah-4/)
- In **2025**, the Sungai Kandis answer describes low pressure at the tail end of the system around Berjaya Park, Johan Setia and Jalan Kebun, with demand from nearby development cited as a cause. It reports pipe work and an alternative supply completed by **March 2025**, followed by improved pressure in checks. _(snippet only)_ [Sungai Kandis assembly answer](https://dewan.selangor.gov.my/question/isu-paip-air-lama-dan-tekanan-air-rendah/)
- A **2024** answer on Desa Putra, Sungai Merab and Kampung Dato Abu Bakar Baginda cites high terrain and population density among the pressure challenges, with rebalancing, an alternative source and planned reservoir/pipe works as responses. _(snippet only)_ [Selangor assembly answer](https://dewan.selangor.gov.my/question/masalah-tekanan-air-yang-rendah-di-beberapa-kawasan-di-desa-putra-sungai-merab-dan-kg-dato-abu-bakar-baginda/)
- A **2024** major scheduled maintenance at the Sungai Selangor Phase 1 plant affected parts of Petaling, Klang, Gombak and Kuala Selangor, among other areas. Air Selangor deployed **182 tankers: 87 mobile and 95 static**. Full restoration was reported at **6am on 7 June 2024**; local restoration was staged as pressure returned. [Bernama](https://www.bernama.com/en/news.php?id=2297324), [tanker deployment](https://www.thestar.com.my/metro/metro-news/2024/06/03/air-selangor-to-deploy-182-water-tankers-in-klang-valley-for-three-day-scheduled-water-cut), [Media Selangor](https://mediaselangor.com/en/2024/06/218720), [The Star](https://www.thestar.com.my/news/nation/2024/06/07/water-supply-back-in-all-affected-areas-says-air-selangor)
- The same **June 2024** interruption forced businesses to conserve water or close; reporting also described water needs at a dialysis clinic and hospitals. A car-wash operator in Ara Damansara told StarMetro they had not known about the cut until contacted by a reporter. [The Star](https://www.thestar.com.my/news/nation/2024/06/05/klang-valley-folk-hope-water-supply-resumes-swiftly), [StarMetro clipping hosted by MBSJ](https://www.mbsj.gov.my/sites/default/files/Keratan%20Akhbar%2005%20Jun%202024.pdf)
- In **August 2025**, a burst old **600 mm** pipe along the LDP affected parts of Petaling Jaya and nearby commercial sites. Bernama reported **nine tankers** sent and repair complicated by other utilities crossing the work area; residents told The Star that daytime tanker visits could miss people away at work. [Bernama](https://www.bernama.com/bm/news.php?id=2455553), [The Star](https://www.thestar.com.my/metro/metro-news/2025/08/11/burst-pipe-along-ldp-causes-water-cuts-in-parts-of-petaling-jaya)
- Analyst's read: The strongest local low-pressure evidence found is for Kuala Selangor and Klang; Petaling and Gombak appear in major outage reporting. I did not find a clear **2024–2026** incident in Sepang or evidence directly tying a named SDP township's households to a specific pressure incident. The Desa Putra/Sungai Merab/Kampung Dato Abu Bakar Baginda answer is an adjacent southern Selangor case, but its district coverage is unclear. [Desa Putra/Sungai Merab assembly answer](https://dewan.selangor.gov.my/question/masalah-tekanan-air-yang-rendah-di-beberapa-kawasan-di-desa-putra-sungai-merab-dan-kg-dato-abu-bakar-baginda/) For Gombak, a **2024** answer attributes Rawang Putra apartment low pressure to the developer not completing the water tank and pumping system. _(snippet only)_ [Rawang Perdana assembly answer](https://dewan.selangor.gov.my/question/perkhidmatan-bekalan-air/)

## Why now (a 2025 or 2026 trigger, if any)

A **July 2026** NADMA report said Selangor's raw-water readiness was estimated at **nine months** amid El Niño and the dry southwest monsoon, while reservoir storage was reported above **75%** at seven dams. [NADMA](https://www.nadma.gov.my/bi/media-en/news/6696-fenomina-el-nino-bekalan-sumber-air-selangor-mampu-bertahan-9-bulan)

Analyst's read: This is a preparedness trigger, not evidence of a current household shortage.

Analyst's read: SDP's Elmina data-centre development is relevant context for long-term water planning. Air Selangor has cited a **more than 240 MLD** projected water demand from data centres as a sector-wide figure; I found no evidence connecting that estimate specifically to Elmina or linking it to local household cuts. [SDP Integrated Annual Report 2025](https://www.simedarbyproperty.com/sites/default/files/2026-04/SDP%20IAR2025%20Mobile.pdf), [Air Selangor feature](https://hydrohub.airselangor.com/publication/air-selangor-delivers-commendable-results-in-2024-strengthening-its-commitment-to-sustainable-water-management-for-the-future/)

## Who suffers and who owns the fix

Assembly answers document low pressure at end-of-network areas and apartments with incomplete tank/pump systems. _(snippet only)_ The **June 2024** reporting describes household, health-care and business impacts, including water needs at a dialysis clinic and hospitals. [Sungai Kandis assembly answer](https://dewan.selangor.gov.my/question/isu-paip-air-lama-dan-tekanan-air-rendah/), [Rawang Perdana assembly answer](https://dewan.selangor.gov.my/question/perkhidmatan-bekalan-air/), [The Star](https://www.thestar.com.my/news/nation/2024/06/05/klang-valley-folk-hope-water-supply-resumes-swiftly), [MBSJ-hosted StarMetro clipping](https://www.mbsj.gov.my/sites/default/files/Keratan%20Akhbar%2005%20Jun%202024.pdf)

Air Selangor provides source and technical requirements and accepts external reticulation at handover; developers' consultants design supply lines, pumps and service reservoirs where required. Township managers can coordinate site notices, common-area assets and resident support. [Air Selangor developer application stages](https://content.airselangor.com/cmi-prod-blobstorageanon-001-sea/media/k4hbgjsn/stages-for-water-applications-v7-finalccdapproved.pdf)

## SDP's lever (what SDP controls: before handover, defect period, township management, its own assets)

Analyst's read: SDP can check pressure and capacity assumptions before each phase opens; verify that reticulation, storage tanks, pumps, telemetry and as-built records work under peak demand; track defects through the defect period; and coordinate response through township management and its own facilities. A **2024** Rawang apartment answer shows the consequence when a developer's tank and pumping system is incomplete. _(snippet only)_ [Selangor assembly answer](https://dewan.selangor.gov.my/question/perkhidmatan-bekalan-air/)

SDP's **2025** sustainability report describes water management and increased non-potable water use across its operations. [SDP Sustainability Report 2025](https://www.simedarbyproperty.com/sites/default/files/2026-04/SDP%20SR2025%20%28Website%29.pdf)

Analyst's read: That gives SDP a starting point for a pilot on its own assets; rainwater harvesting alone would not solve municipal pressure failures.

## What already exists (products, services, programmes, hackathon projects)

- Air Selangor's Water Updates site and app publish affected areas, disruption notices, estimated restoration and recovery updates; the live site is dynamic. Tankers and static tanks are already used during major interruptions. News reports describe official WhatsApp customer-service contacts, but I did not find a public, operator-integrated community WhatsApp feed. [Water Updates](https://waterupdates.airselangor.com/?lang=en), [Air Selangor app](https://play.google.com/store/apps/details?id=com.airselangor.cmi.app), [Air Selangor maintenance guidance](https://hydrohub.airselangor.com/publication/regular-maintenance-and-upkeep-of-water-supply-assets-ensures-continuous-and-stable-water-supply-services/), [The Edge](https://theedgemalaysia.com/article/disrupted-piped-water-supply-being-restored-pengurusan-air-selangor)
- Malaysian vendors already market water-pressure, leak and tank monitoring, including [DBD Water Systems](https://www.dbdmalaysia.com/), [Premagk Technologies](https://premagk.com.my/) and [MyTank](https://mytank.cloud/). These are vendor claims; this screen did not verify deployments in SDP townships.
- Air Selangor's **2024** Data & Digital Hackathon received **149 registrations** and named **10 finalists**. Universiti Malaya's Fresh Air team won with HydroRise Sentinel, a leak-monitoring and prediction concept for the utility network. [Air Selangor Hydro Hub](https://hydrohub.airselangor.com/visual/data-digital-hackathon-2024/?lang=ms), [The Star](https://www.thestar.com.my/metro/metro-news/2024/06/06/bright-ideas-unearthed-at-hackathon)
- A **2023** UniKL student project describes household water-quality monitoring and low-pressure detection using a flow sensor and connected device. [UniKL repository](https://ir.unikl.edu.my/jspui/handle/123456789/26527)
- Not found in this quick scan: a published MYHackathon, KitaHack or university project specifically targeting household outage readiness or low pressure in Selangor townships. I checked the [MYHackathon programme](https://www.myhackathon.gov.my/maklumat-program) and [winners](https://www.myhackathon.gov.my/pemenang), [KitaHack 2026 site](https://kitahack2026.my/), UniKL repository results and the terms “low water pressure” and “tekanan air rendah”; this is not a complete competition archive search.

Analyst's read: Crowding is moderate for generic sensors, leak detection and outage notices. The narrower developer handover plus resident-response workflow appears less crowded in the sources checked.

## Real data a prototype could use (open datasets or APIs, with URLs)

- Air Selangor's live [Water Updates](https://waterupdates.airselangor.com/?lang=en) provides disruption areas and restoration progress, including low-pressure areas. The page is dynamically loaded; I found no documented public API or downloadable incident history in this screen.
- [data.gov.my's water access dataset](https://data.gov.my/data-catalogue/water_access) provides household access to treated water by state and strata, with data through **2025**; its note subsumes Kuala Lumpur and Putrajaya under Selangor. API documentation: [Open API quick start](https://developer.data.gov.my/quickstart); example: `https://api.data.gov.my/data-catalogue?id=water_access&limit=3`.
- The data.gov.my catalogue also lists state/sector water consumption through **December 2024** and state water production through **2022**. I did not find a granular public Selangor outage or pressure dataset there. [Data catalogue](https://data.gov.my/data-catalogue)
- Air Selangor's **2024** sustainability report gives operator-wide disruption counts and hours, but not building-level pressure histories. A local pilot would need SDP as-built/commissioning records and permission to collect real pressure or tank-level readings at selected assets. [Air Selangor Sustainability Report 2024](https://content.airselangor.com/cmi-prod-blobstorageanon-001-sea/media/o4wnyn50/air-selangor-sustainability-report-2024-03062025-compressed.pdf)

## What a strong solution could be

Analyst's read: Pilot a “water-ready phase” workflow at one SDP township: a student team can prototype in **7 days** using actual Air Selangor notices, a real SDP asset list and a small set of consented site readings; the live **1–2 year** pilot would join phase-level reticulation, tank and pump handover checks with resident reports of low pressure, show affected blocks and verified restoration updates, and help township managers prioritize static tanks or tanker requests for clinics and other vulnerable sites. Keep the pilot focused on assets and communications SDP controls, and agree data access with Air Selangor before making pressure predictions.

## Kill risks (3 bullets)

- Analyst's read: Upstream treatment, raw-water and public-main failures sit outside SDP's direct control; a township dashboard cannot restore supply.
- Analyst's read: No granular open outage/pressure history was found, and private asset records or Air Selangor data access may be required to validate the solution.
- Analyst's read: Generic pressure sensing and outage alerts already have vendor and hackathon activity; the pilot needs a clear handover or response advantage to avoid duplicating existing tools.

## Scores (1 to 5 each, one line of reason each): Pain, SDP lever, Evidence available, Crowding (5 = very crowded). Then: Edge = Pain x Lever x Evidence / Crowding.

- Analyst's read: Pain: **4/5** — recurring cuts, pressure complaints and household, clinic and business impacts are documented.
- Analyst's read: SDP lever: **3/5** — meaningful before handover and on common assets, limited over utility mains and treatment.
- Analyst's read: Evidence available: **4/5** — operator reports, assembly answers and live notices exist, but local pressure data is not open.
- Analyst's read: Crowding: **3/5** — existing utility tools, vendors and adjacent student concepts; less evidence of a direct township-handover competitor.
- **Edge: 16** = 4 × 3 × 4 ÷ 3.

## Sources (numbered list)

1. [Air Selangor Sustainability Report 2024](https://content.airselangor.com/cmi-prod-blobstorageanon-001-sea/media/o4wnyn50/air-selangor-sustainability-report-2024-03062025-compressed.pdf)
2. [Kuala Selangor assembly answer: low pressure](https://dewan.selangor.gov.my/question/tekanan-air-di-kuala-selangor/)
3. [Sementa assembly answer: development demand and pressure](https://dewan.selangor.gov.my/question/bekalan-air-mentah-4/)
4. [Sungai Kandis assembly answer: old pipes and pressure](https://dewan.selangor.gov.my/question/isu-paip-air-lama-dan-tekanan-air-rendah/)
5. [Selangor assembly answer: Desa Putra, Sungai Merab and Kampung Dato Abu Bakar Baginda](https://dewan.selangor.gov.my/question/masalah-tekanan-air-yang-rendah-di-beberapa-kawasan-di-desa-putra-sungai-merab-dan-kg-dato-abu-bakar-baginda/)
6. [Rawang Perdana assembly answer: water service](https://dewan.selangor.gov.my/question/perkhidmatan-bekalan-air/)
7. [Bernama: June 2024 scheduled maintenance announcement](https://www.bernama.com/en/news.php?id=2297324)
8. [The Star: June 2024 tanker deployment](https://www.thestar.com.my/metro/metro-news/2024/06/03/air-selangor-to-deploy-182-water-tankers-in-klang-valley-for-three-day-scheduled-water-cut)
9. [Media Selangor: staged restoration in June 2024](https://mediaselangor.com/en/2024/06/218720)
10. [The Star: full restoration after June 2024 works](https://www.thestar.com.my/news/nation/2024/06/07/water-supply-back-in-all-affected-areas-says-air-selangor)
11. [The Star: residents and businesses during June 2024 disruption](https://www.thestar.com.my/news/nation/2024/06/05/klang-valley-folk-hope-water-supply-resumes-swiftly)
12. [MBSJ-hosted StarMetro clipping: June 2024 water impacts](https://www.mbsj.gov.my/sites/default/files/Keratan%20Akhbar%2005%20Jun%202024.pdf)
13. [Bernama: August 2025 LDP pipe burst](https://www.bernama.com/bm/news.php?id=2455553)
14. [The Star: LDP burst and resident tanker experience](https://www.thestar.com.my/metro/metro-news/2025/08/11/burst-pipe-along-ldp-causes-water-cuts-in-parts-of-petaling-jaya)
15. [NADMA: Selangor raw-water readiness during 2026 El Niño](https://www.nadma.gov.my/bi/media-en/news/6696-fenomina-el-nino-bekalan-sumber-air-selangor-mampu-bertahan-9-bulan)
16. [SDP Integrated Annual Report 2025](https://www.simedarbyproperty.com/sites/default/files/2026-04/SDP%20IAR2025%20Mobile.pdf)
17. [Air Selangor: sustainable water management and sector data-centre demand](https://hydrohub.airselangor.com/publication/air-selangor-delivers-commendable-results-in-2024-strengthening-its-commitment-to-sustainable-water-management-for-the-future/)
18. [Air Selangor developer application stages](https://content.airselangor.com/cmi-prod-blobstorageanon-001-sea/media/k4hbgjsn/stages-for-water-applications-v7-finalccdapproved.pdf)
19. [SDP Sustainability Report 2025](https://www.simedarbyproperty.com/sites/default/files/2026-04/SDP%20SR2025%20%28Website%29.pdf)
20. [Air Selangor Water Updates](https://waterupdates.airselangor.com/?lang=en)
21. [Air Selangor app on Google Play](https://play.google.com/store/apps/details?id=com.airselangor.cmi.app)
22. [Air Selangor guidance on maintenance and alternative supply](https://hydrohub.airselangor.com/publication/regular-maintenance-and-upkeep-of-water-supply-assets-ensures-continuous-and-stable-water-supply-services/)
23. [DBD Water Systems](https://www.dbdmalaysia.com/)
24. [Premagk Technologies](https://premagk.com.my/)
25. [MyTank](https://mytank.cloud/)
26. [Air Selangor Data & Digital Hackathon 2024](https://hydrohub.airselangor.com/visual/data-digital-hackathon-2024/?lang=ms)
27. [The Star: Air Selangor hackathon finalists](https://www.thestar.com.my/metro/metro-news/2024/06/06/bright-ideas-unearthed-at-hackathon)
28. [UniKL repository: residential water system student project](https://ir.unikl.edu.my/jspui/handle/123456789/26527)
29. [MYHackathon winners](https://www.myhackathon.gov.my/pemenang)
30. [KitaHack 2026](https://kitahack2026.my/)
31. [data.gov.my water access catalogue](https://data.gov.my/data-catalogue/water_access)
32. [data.gov.my Open API quick start](https://developer.data.gov.my/quickstart)
33. [data.gov.my catalogue](https://data.gov.my/data-catalogue)
34. [SPAN Water & Sewerage Fact Book 2024 copy hosted on Scribd](https://www.scribd.com/document/997229858/SPAN-Water-Sewage-Factbook-2024)
35. [The Edge: Air Selangor customer assistance during a 2025 disruption](https://theedgemalaysia.com/article/disrupted-piped-water-supply-being-restored-pengurusan-air-selangor)
36. [MYHackathon programme information](https://www.myhackathon.gov.my/maklumat-program)
