# Approval path and costs for a Safe Edge pilot flight

Deck-ready facts for issues #90 and #91, checked on 20 October 2026 against the agencies' own pages. It adds JUPEM's permit terms and MBSA's drone form, which the [CAAM rules note](/docs/research/drone-integration/caam-rules.md) could not open, and draws the costs from the [hardware cost note](/docs/research/drone-integration/hardware-cost.md). The last section holds the emails to send.

Contents:

1.  [Summary](#summary)
1.  [Approvals for one VLOS patrol flight](#approvals-for-one-vlos-patrol-flight)
1.  [Costs the deck can cite](#costs-the-deck-can-cite)
1.  [MBSA's drone form](#mbsas-drone-form)
1.  [Emails to send](#emails-to-send)
    1.  [CAAM](#email-to-caam)
    1.  [JUPEM](#email-to-jupem)
    1.  [MBSA](#email-to-mbsa)
    1.  [Drone service providers](#email-to-drone-service-providers)
1.  [Sources](#sources)

## Summary

- A camera drone over Elmina Central Park needs three written approvals before it flies: CAAM's Standard Authorisation to Fly (ATF), JUPEM's aerial photography permit, and the landowner's letter. Both agencies want about two weeks: CAAM at least 14 working days, JUPEM 2 weeks. [CAAM UAS guidance][caam-uas], [JUPEM FAQ][jupem-faq]
- The published approval fees are small: RM250 per aircraft per location for up to 90 days at CAAM, and RM50 per flight day at JUPEM. [CAAM fees][caam-fees], [JUPEM FAQ][jupem-faq]
- No Malaysian drone-service provider publishes a rate for inspection work; they quote per project. Three searches on 17 October and one on 20 October found none. The deck should cite the modelled first-year costs below and say quotes are requested. [Hardware cost note](/docs/research/drone-integration/hardware-cost.md)
- MBSA runs a booking form for drone flights in its area, open to its own departments, including Landscape, and to third-party companies. It shows no fee or lead time. MBSA's own departments already book drone flights, which supports the pitch: the council flies drones for monitoring today. [MBSA drone form][mbsa-dron]
- The park sits inside Subang Airport's controlled airspace, so CAAM and Subang air traffic services must check the exact route. See [the CAAM note](/docs/research/drone-integration/caam-rules.md#4-airspace-around-city-of-elmina).

## Approvals for one VLOS patrol flight

| Approval                      | Who grants it                                  | Lead time                | Fee                                                 | What it needs                                                                                                                                                                              |
| ----------------------------- | ---------------------------------------------- | ------------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Standard ATF                  | CAAM                                           | At least 14 working days | RM250 per aircraft per location area, up to 90 days | Site KML or KMZ, risk assessment, aircraft and pilot details, landowner letter, JUPEM approval for imagery. [CAAM UAS guidance][caam-uas], [CAAM fees][caam-fees]                          |
| Aerial photography permit     | JUPEM, Director General of Survey and Mapping  | 2 weeks                  | RM50 per day, paid in eBiz                          | IDs of the applicant, pilot and photographer; company registration; the owner's letter for the area; the project owner's appointment letter if others are involved. [JUPEM FAQ][jupem-faq] |
| Landowner permission          | SDP for land it manages; MBSA for council land | Not published            | Not published                                       | A written letter, which both CAAM and JUPEM ask for. [CAAM UAS guidance][caam-uas], [JUPEM FAQ][jupem-faq]                                                                                 |
| Flight booking in MBSA's area | MBSA, through its IRIS drone form              | Not shown                | Not shown                                           | Date, start and end time, flight area and purpose, and a supporting memo or letter. [MBSA drone form][mbsa-dron]                                                                           |

JUPEM's permit applies because the drone carries a camera: its FAQ says each drone operation with a camera or any sensor counts as imaging and data capture under General Circular No. 1 of 2007, and needs the Director General's written permission. It also asks for the raw data and photos to be prepared in 3 copies before they go to JUPEM. [JUPEM FAQ][jupem-faq]

## Costs the deck can cite

These come from the [hardware cost note](/docs/research/drone-integration/hardware-cost.md#6-illustrative-first-year-cost-model), which lists every input. They are first-year models, not quotes.

| Model                                    | First-year cost | Main inputs                                                            |
| ---------------------------------------- | --------------: | ---------------------------------------------------------------------- |
| One park, weekly patrol by a hired pilot |        RM64,642 | DJI Matrice 4E RM17,960, one operator RM45,000, five CAAM ATFs RM1,250 |
| Same route, operator time shared         |        RM23,017 | Pays for the 156 hours a year on site, not a full salary               |
| One park with a Dock 3                   |        RM88,548 | Dock 3 and Matrice 4TD RM80,880, software, internet, review time       |
| A township modelled as five parks        |       RM442,740 | Five dock sets and their running costs                                 |

Add JUPEM's RM50 per flight day: about RM2,600 a year for a weekly patrol. **Analyst's read:** start the pilot with the hired-pilot model and phones (phase 0), since its approvals follow a published route; the dock needs a separate BVLOS case. See [the CAAM note's roadmap](/docs/research/drone-integration/caam-rules.md#7-pilot-approval-roadmap).

Every model excludes installation, insurance, repairs and dock licensing. Say so on the slide.

## MBSA's drone form

The [CAAM note](/docs/research/drone-integration/caam-rules.md) and the [privacy note](/docs/research/drone-integration/privacy.md) could not open MBSA's drone page on 17 October. Opened on 20 October, it reads:

- **Title:** "Borang permohonan penerbangan Dron MBSA bagi tujuan pemantauan berpusat" (the form for MBSA drone flights for central monitoring), run by the IRIS MBSA system integration centre.
- **Who applies:** an MBSA department, from a list of 21 that includes the Landscape Department (Jabatan Landskap), or a company, agency or third party.
- **What it asks:** name, phone, email, booking date, start and end time, a memo or instruction letter, and the flight area and purpose.
- **What it does:** shows a calendar of booked slots "to avoid overlapping drone operating zones", then emails MBSA's management.

**Analyst's read:** this is a booking and deconfliction step, not a permit, and it doesn't replace CAAM or JUPEM. Ask MBSA whether an operator hired by SDP must book here for a park SDP manages.

## Emails to send

Send each from a team address and sign with your name and university. A Malay version may get a faster reply from the agencies.

### Email to CAAM

**To:** CAAM's UAS unit, through the contact on its [UAS page][caam-uas] (CAAM's 2020 requirement sheet lists drone@caam.gov.my; confirm it is current).

**Subject:** Approval path for a weekly VLOS inspection flight at Elmina Central Park, Shah Alam

> Dear CAAM UAS Unit,
>
> We are a student team in Sime Darby Property's Township of Tomorrow 2026 challenge. Our proposal, Safe Edge, would inspect the fenced water edges of Elmina Central Park, Shah Alam, from a camera drone once a week, flown within visual line of sight by a hired, competent operator, in daylight. We are not planning to fly before approval.
>
> Could you confirm:
>
> 1. That the Standard ATF route applies to this operation, and that one application can cover a weekly schedule for up to 90 days.
> 2. How a route inside the Subang control zone is coordinated, and whether this adds to the 14 working days.
> 3. Which documents you would need from us and from the landowner.
>
> Thank you for your time.

### Email to JUPEM

**To:** JUPEM's Defence Geospatial Division (Bahagian Geospatial Pertahanan), through the enquiry route on [eBiz JUPEM][jupem-ebiz].

**Subject:** Aerial photography permit for weekly park-edge inspection photos, Elmina, Shah Alam

> Dear JUPEM,
>
> Safe Edge, our proposal in Sime Darby Property's Township of Tomorrow 2026 challenge, would photograph the fenced water edges of Elmina Central Park, Shah Alam, from a camera drone once a week. The photos are compared with earlier ones to find missing fence panels and similar damage; they are not used for mapping.
>
> Could you confirm:
>
> 1. Whether one permit can cover a recurring weekly flight, or each flight day needs its own application at RM50.
> 2. How the raw data should be submitted for a recurring inspection, given the 3-copy requirement.
> 3. Whether any area of Elmina needs further security clearance.
>
> Thank you.

### Email to MBSA

**To:** MBSA's Landscape Department (Jabatan Landskap), copying the IRIS integration centre that runs the [drone form][mbsa-dron].

**Subject:** Drone inspection of park water edges at Elmina Central Park

> Dear Sir or Madam,
>
> Safe Edge, our proposal in Sime Darby Property's Township of Tomorrow 2026 challenge, would inspect the fenced water edges of Elmina Central Park with a camera drone once a week, under CAAM and JUPEM approval, to find damaged fences before they put children at risk.
>
> Could you advise:
>
> 1. Whether an operator hired by Sime Darby Property must book flights through the IRIS drone form for a park it manages, and how far ahead.
> 2. Which department would receive safety findings for council-managed edges.
> 3. Whether MBSA already inspects park edges with its own drones, and who we could speak to.
>
> Thank you.

### Email to drone service providers

**To:** three Malaysian operators through their contact pages: Aerodyne Group, Sanyeong Technology and KTV Working Drone, as listed in the [hardware cost note](/docs/research/drone-integration/hardware-cost.md#3-malaysian-drone-services-rates-and-public-tenders).

**Subject:** Quote request: weekly drone inspection of a park's water edges, Elmina, Shah Alam

> Hello,
>
> We are pricing a pilot for Sime Darby Property's Township of Tomorrow 2026 challenge. Could you give an indicative quote for:
>
> - Weekly visual inspection of about 2.7 km of fenced lake edge and three smaller ponds at Elmina Central Park, Shah Alam: about 3 hours on site per visit, daylight, within visual line of sight.
> - Fixed viewpoints repeated each visit, with the photos delivered within 24 hours.
> - CAAM and JUPEM applications handled by you, or priced separately.
>
> A price per visit, or for 12 months, is enough. Thank you.

## Sources

1.  [CAAM UAS guidance][caam-uas]: Civil Aviation Authority of Malaysia; cited through the [CAAM rules note](/docs/research/drone-integration/caam-rules.md), accessed 17 October 2026.
1.  [CAAM UAS fees][caam-fees]: Civil Aviation Authority of Malaysia; cited through the CAAM rules note, accessed 17 October 2026.
1.  [JUPEM frequently asked questions][jupem-faq]: Department of Survey and Mapping Malaysia, "Products and Services" section; opened 20 October 2026.
1.  [eBiz JUPEM][jupem-ebiz]: JUPEM's online permit system, online since 3 March 2020 per its [announcement](https://www.jupem.gov.my/en/pengumuman/24); opened 20 October 2026.
1.  [MBSA IRIS drone form][mbsa-dron]: Shah Alam City Council; opened 20 October 2026. The site's TLS certificate chain is incomplete, so some tools refuse it.

[caam-uas]: https://www.caam.gov.my/public/unmanned-aircraft-system-uas/
[caam-fees]: https://www.caam.gov.my/resources/aviation-professional/unmanned-aircraft-system-uas/
[jupem-faq]: https://www.jupem.gov.my/en/carian/papar/post/31
[jupem-ebiz]: https://ebiz.jupem.gov.my/
[mbsa-dron]: https://iris.mbsa.gov.my/dron.php
