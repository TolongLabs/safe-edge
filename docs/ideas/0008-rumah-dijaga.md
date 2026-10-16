# Rumah Dijaga

"We help owners who don't move into their new Sime Darby Property home keep it free of mosquito breeding, overgrowth and unnoticed defects, through monthly checks by a retiree who lives nearby." It runs through the defect liability period, sold through the SDP App. _Rumah dijaga_ is Malay for "a house looked after".

**Track:** People, healthy lifestyles. **Rank:** see the [ranking](0000-ranking.md).

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

- **Many homes stand empty, often new ones.** The 2020 census's preliminary findings put "1.9 million (19.4%)" of Malaysia's living quarters as vacant. In Petaling district, which includes City of Elmina, 62.9% of vacant ones were "newly completed/ for rent or sale" ([DOSM][dosm]).
- **Empty houses are a known nuisance, and councils step back.**
  - Selangor's councils reported 4,907 abandoned houses in 2018; Shah Alam's council had 1,995, the most. Councils cut the grass "dua (2) kali dalam tempoh setahun" (twice a year) and bill owners who ignore notices ([Selangor State Assembly][dun 2018]).
  - In November 2024 the state said "Pihak Berkuasa Tempatan tidak akan memasuki rumah hak milik persendirian yang terbiar dan semak untuk membuat pembersihan" (councils will not enter abandoned, overgrown private houses to clean them) ([Selangor State Assembly][dun 2024]).
- **Dengue makes it urgent.** Selangor had 31,782 cases by week 40 of 2026, up 72.6% on 2025, with 31 deaths against 6. Petaling rose 79.2% ([JKN Selangor][jkns40]). Owners face a RM500 compound for larvae ([Selangor State Assembly][dun aedes], 2015), and a council nuisance notice for an unoccupied house goes to the owner ([Selangor State Assembly][dun 2024]).
- **Absent owners carry risks they can't see.**
  - A home insurer excludes burglary "if the premise is unoccupied for more than thirty (30) consecutive days" ([Berjaya Sompo][sompo]).
  - The 24-month defect period still runs, but nobody is there to spot a leak or let the contractor in. A developer's handover guide notes owners "may also appoint a representative to be present during the rectification period" ([Mah Sing][mahsing], _excerpt_).
- **Nobody sells this in Malaysia.** We found property managers for tenanted units, charging 8% to 12% of the monthly rent ([SuperHomes][superhomes], _excerpt_), and grass-cutting gigs, but no service that checks empty landed homes.

[dosm]: https://www.dosm.gov.my/portal-main/release-content/key-findings-population-and-housing-census-of-malaysia-2020-administrative-district
[dun 2018]: https://dewan.selangor.gov.my/question/rumah-terbiar-dan-tidak-berpenghuni/
[dun 2024]: https://dewan.selangor.gov.my/question/isu-rumah-terbiar-dan-semak/
[jkns40]: https://jknselangor.moh.gov.my/images/2026/denggi/ME40_26.pdf
[dun aedes]: https://dewan.selangor.gov.my/question/pembiakan-nyamuk-aedes/
[sompo]: https://www.berjayasompo.com.my/product/burglary
[mahsing]: https://www.mahsing.com.my/frequently-asked-questions/key-collection/
[superhomes]: https://www.superhomes.my/resources/property-management-company-malaysia

## Target user

- **Primary:** buyers of new SDP homes who don't move in at handover: investors, and owners working in another state or abroad.
- **Secondary:** their neighbours, who live beside the mosquitoes and the long grass, and local retirees, who earn as checkers.

## Solution and how it works

1.  **Offer at handover.** When keys are collected, the SDP App offers Rumah Dijaga for the defect period. After three months, SDP also flags units never registered in the community app, a proxy for empty homes, and offers it again.
2.  **Check monthly, from outside.** A vetted retiree from the township spends about 20 minutes on a checklist adapted from Japan Post's empty-house service: standing water in the porch, drains and gutters; grass; mailbox; dumping; stains or leaks visible from outside; gate and doors secure. No keys are needed. Geotagged photos go to the owner.
3.  **Fix on the spot.** The checker tips standing water and applies larvicide, books grass cutting at a fixed price, and files visible defects into SDP's defect process.
4.  **Stand in for the owner.** With the owner's written authorisation, the checker attends defect repair appointments, so absent owners don't miss them.
5.  **Check after heavy rain.** When heavy rain falls on the phase, the checker makes an extra visit for leaks and standing water.

Price is to be tested: Japan Post charges "4,280円/月（税込）" (4,280 yen a month) for one visit a month ([Japan Post][jp akiya]), and Malaysian companions earn RM13 to RM17 an hour ([The Edge][teman]).

[jp akiya]: https://www.life-support.post.japanpost.jp/akiya/
[teman]: https://theedgemalaysia.com/article/aged-care-offering-companionship-elderly

## Why it's new

| Closest analogue                                                          | What it does                                                                                                                   | What it lacks                             |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| Japan Post's empty-house watch ([Japan Post][jp akiya])                   | Monthly 7-point outside check with up to 5 photos; trialled from 2023, nationwide from January 2025 ([Impress Watch][impress]) | Japan's ageing countryside, not new homes |
| US "home watch" firms ([Propertihc][homewatch], _excerpt_)                | Regular checks of second homes                                                                                                 | Not tied to a developer or warranty       |
| Malaysian property managers ([SuperHomes][superhomes], _excerpt_)         | Manage tenanted units for a share of rent                                                                                      | Nothing for empty homes                   |
| Council clean-ups ([Selangor State Assembly][dun 2018]; [2024][dun 2024]) | Cut grass twice a year and bill owners                                                                                         | Councils won't enter private homes        |

- **We found no empty-home check for landed homes in Malaysia,** in English or Malay, and nothing like it at SDP.
- **Our read:** innovation 3. The mechanism runs in Japan; the new parts are selling it at handover, tying it to the defect period and using local retirees.

[impress]: https://www.watch.impress.co.jp/docs/news/1627688.html
[homewatch]: https://propertihc.com/2026/01/30/what-is-home-watch/

## Impact and how we measure it

- **Primary outcome:** breeding sites found and cleared at checked homes each month, against a walked count of unchecked empty homes in the same phase.
- **Defects:** defects found at empty homes inside the defect period, and repair appointments attended for absent owners.
- **Neighbours:** complaints about empty houses to the residents' association and council.
- **Uptake:** share of unoccupied units that subscribe, and renewals.
- **Baseline:** our walked count before the pilot.

## Fit with Sime Darby Property

- **Pillar:** Community Experience, and the health of the township while it fills up.
- **Value to two sides:** owners protect their asset and avoid compounds from a distance. Neighbours get a cared-for street. SDP earns a small service fee, gets defects reported inside the period and calmer streets in new phases. Retirees get paid work near home, which Selangor says it will "meneroka" (explore) ([Selangor State Assembly][dun silver]).
- **Scale:** SDP delivered 2,346 units in FY2024 ([SDP Integrated Report 2024][ir2024]), across its townships.

[dun silver]: https://dewan.selangor.gov.my/question/kebajikan-mesra-warga-emas/
[ir2024]: https://www.simedarbyproperty.com/sites/default/files/2025-05/SDP-IR2024.pdf

## Pilot

| Element       | Plan                                                                                                                                                                                                                                                                   |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where         | One City of Elmina phase in its first 24 months after handover                                                                                                                                                                                                         |
| Owner         | SDP's customer experience and township teams                                                                                                                                                                                                                           |
| Duration      | Six months                                                                                                                                                                                                                                                             |
| Cost          | Checkers' pay, a vetting check, public liability insurance, larvicide and an app module. Subscriptions offset it                                                                                                                                                       |
| Approvals     | SDP, and each owner's written authorisation. The joint management body or residents' association for entry to gated precincts. PDPA consent for photos. Sold as maintenance, not security, to stay outside the Private Agencies Act 1971 ([CommonLII][paa], _excerpt_) |
| Success       | A set share of unoccupied units subscribe, and checked homes show fewer breeding sites than unchecked ones                                                                                                                                                             |
| Decision gate | If met, offer it at every SDP handover                                                                                                                                                                                                                                 |
| Risks         | Few empty homes in the phase: pick the phase from SDP's never-moved-in list. Owners won't pay: test two prices first. Liability: no keys and no entry in version 1                                                                                                     |

[paa]: https://www.commonlii.org/my/legis/consol_act/paa1971160/

## Prototype by 23 October

- **Build:** a checklist app for checkers with geotagged photos, an owner's monthly report, and a sign-up page with two test prices.
- **Data:**
  - Our own walk of one Elmina or Denai Alam precinct, scoring each house on signs of vacancy (no car, piled-up mail, long grass, standing water), with photos.
  - JKN Selangor's weekly dengue reports, parsed for hotspots.
  - DOSM census figures by district.
- **Evidence before submission:** interview five absentee owners, found through Elmina community groups, about what they do now and what they would pay.

## Scorecard

**Rank 8 of 8** in the merged ranking, with a mean judge score of 52.3 out of 100 ([ranking](0000-ranking.md#pass-2-round-10-rank-and-stress-test)). The judges are AI agents playing SDP roles, scoring the draft against the [judging matrix](0000-ranking.md#judging-matrix).

| Scorer                  | Impact | Innovation | Feasibility | Fit | Commercial | Evidence | Weighted |
| ----------------------- | ------ | ---------- | ----------- | --- | ---------- | -------- | -------- |
| Author (round 9)        | 3      | 3          | 4           | 3   | 4          | 2        | 64       |
| SDP sustainability head | 2      | 3          | 3           | 2   | 4          | 3        | 54       |
| SDP township manager    | 2      | 3          | 3           | 3   | 3          | 3        | 55       |
| Innovation mentor       | 2      | 2          | 3           | 2   | 4          | 2        | 48       |

- **Biggest weakness:** no evidence that empty SDP homes are a problem or that owners will pay, and it is a labour and liability business rather than a technology idea.
- **The change that would raise it most:** SDP's count of never-moved-in units in one phase, and real owners committing at two prices.
- **No judge thought owners would renew** "without a visible incident".

## Risks and open questions

- **How many SDP homes are empty?** No figure is public. We found no 2024 to 2026 complaints about empty houses in Elmina, Denai Alam or Bandar Bukit Raja; our walked count must create the evidence.
- **Will investors pay?** Japan Post went nationwide, but its subscriber numbers aren't published.
- **The killer question:** "Why would an investor pay when compounds are rare?" Because dengue is up 79% in Petaling, one insurer excludes burglary cover on homes empty for over 30 days, councils won't enter, and the defect period is running out unseen.

## How the idea changed across rounds

- **Round 1:** seeded from SDP's knowledge of which owners never move in, and Japan's empty-house services.
- **Round 4:** narrowed to the defect period after research found Japan Post's service and no Malaysian equivalent. Research suggested merging it with "Kedai Jaga", a watch on seniors living alone.
- **Round 6:** paid visits to seniors already exist in Malaysia (Teman, Homage and Selangor's own Rakan Penjaga), so the merged network was dropped and the idea kept to empty homes, outside only, with no keys.
- **Round 8:** asked "How many homes are empty, and will investors pay?" Changed to pick the pilot phase from SDP's list of units never moved into, and to test two prices before the pilot.
- **Round 9:** judges scored it 48 to 55, the lowest of the eight. It is kept as a record, not a candidate.
