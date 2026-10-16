# Waktu Lancar

"We help City of Elmina residents in gated precincts get out of the township faster in the morning, by rewarding households that leave outside the peak." The precinct's existing gate log does the counting, so nobody opens an app. SDP first measures how much of the queue is residents, then funds the rewards with mall tenants. _Waktu lancar_ is Malay for "smooth-flowing time".

**Track:** People, mobility. **Rank:** see the [ranking](0000-ranking.md).

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

- **The daily exit is City of Elmina's loudest complaint.**
  - Focus Malaysia, April 2025, on "some 40,000 residents": "An 1km exit to my house takes an hour", and one resident called Elmina "a 'scam'" ([Focus Malaysia][focus]).
  - On X, March 2025: "Traffic jams at Denai Alam & Elmina in Shah Alam are UNBEARABLE, but Sime Darby Property is still busy building news home for profits", tagging SDP and the Prime Minister ([X][tajuddin]).
  - In September 2026 the Kota Damansara state assemblyman said Subang Bestari's congestion "sudah berlarutan lebih 15 tahun dan kini semakin teruk apabila penempatan di Elmina bertambah" (has dragged on for over 15 years and is getting worse as Elmina grows) ([Newswav][newswav]).
- **SDP's shareholders asked about it, and SDP blamed outsiders.** At the 2025 AGM a shareholder wrote that "Sime Darby Property seems not to care". SDP answered that new roads "led to a surge in external traffic, as non-residents increasingly use these routes as shortcuts to GCE and DASH highway", and listed an interchange upgrade, a planned DASH link via Elmina Ridge and "coordinated traffic measures" ([SDP AGM][agm] p. 7).
- **The road fixes are years away.** A property agent's post, with 52,300 views, says SDP's RM16 million interchange at GCE exit 3504 is built but waiting on operating talks, and the DASH link targets late 2028 ([Threads][threads], _secondary_).
- **There is no bus to switch to.** An urbanist on X: "Elmina Lakeside Mall currently has ZERO transit access" ([X][nat]). Our check of Rapid KL's GTFS feed found no trunk bus stop within 1.5 km of the mall, Elmina Valley or Elmina Central Park West.
- **Nobody knows the split.** We found no count of how much of Elmina's exit traffic is residents and how much is through traffic.

[focus]: https://focusmalaysia.my/lack-of-planning-foresight-leads-to-city-of-elminas-traffic-woes-stretches-far-and-wide-beyond-township/
[tajuddin]: https://x.com/TajuddinKamil/status/1899648539199971332
[newswav]: https://newswav.com/article/usaha-atasi-kesesakan-subang-bestari-masuk-peringkat-awal-satu-pemaju-setuj-A2609_439KCr
[agm]: https://www.simedarbyproperty.com/sites/default/files/2025-07/Pre-Meeting_Questions.pdf
[threads]: https://www.threads.com/@amir.therealtor/post/DYrqRwpDzII/trivia-pelan-naik-taraf-jalan-raya-trafik-di-city-of-elmina/
[nat]: https://x.com/Natcromancer/status/1827898116466737427

## Target user

- **Primary:** households in City of Elmina's gated landed strata precincts who drive out between 6:30 and 9:00 on weekdays. Examples include Elmina Grove, a "landed strata precinct" ([SDP][grove], _excerpt_), and Elmina Valley 4, with an "access card system, vehicle access control system, and a guarded entrance" ([Property Genie][ev4], _secondary_).
- **Secondary:** Elmina Lakeside Mall tenants, who fund the rewards and gain off-peak customers.

[grove]: https://www.simedarbyproperty.com/elmina-grove/
[ev4]: https://www.propertygenie.com.my/project/elmina-valley-4-city-of-elmina-by-sime-darby-property-berhad-v6cX5MNDwrbGCvciMVkEfC

## Solution and how it works

1.  **Measure first (weeks 1 to 4).** With residents' consent, SDP exports the exit times from one or two precincts' RFID gate logs, and reads speeds on the exit roads from TomTom's traffic API. For the first time, it knows how many cars in the morning queue come from its own precincts.
2.  **Reward the shift (weeks 5 to 12).** Opted-in households earn one entry in a weekly prize draw for each weekday they leave before 6:45 or after 8:30. The gate log does the detecting, and a WhatsApp message each Friday shows each household its entries and the week's queue time. The prizes are e-wallet credit and Elmina Lakeside Mall vouchers, paid by tenants who want the extra customers, plus SDP. Whether a weekly prize draw needs a permit is unchecked; if it does, fixed rewards replace the draw. A draw stretches a small budget: in Bangalore, Infosys's weekly raffle cost "roughly equal to the total cost of extra fuel per week" ([Stanford][instant]).
3.  **SDP goes first.** SDP books its own construction lorries and service trucks out of the 7 to 9 am window. Malaysia's peak-hour lorry ban covers PLUS, NKVE, ELITE and DUKE, but not the GCE or Elmina's roads ([Malay Mail][lorry ban]).
4.  **Publish the queue.** Every week, residents see the minutes from gate to GCE at peak, before and after.

**Why a small shift matters:** at a bottleneck, queuing cost rises with the square of the number of drivers, so 10% fewer drivers in the peak cuts total congestion cost by about 19% (our arithmetic from the standard bottleneck model, [Small 2015][small]). Every Malaysian sees the effect during school holidays.

[instant]: https://web.stanford.edu/~balaji/papers/09anincentive.pdf
[lorry ban]: https://www.malaymail.com/news/malaysia/2025/02/07/llm-widens-peak-hour-heavy-vehicle-ban-on-plus-nkve-elite-and-duke-from-february-19/165815
[small]: https://www.economics.uci.edu/files/docs/workingpapers/2014-15/14-15-06.pdf

## Why it's new

| Closest analogue                                 | What it does                                                                                                       | What it lacks                    |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| Spitsmijden, Netherlands ([VTPI][vtpi])          | Paid drivers €2 to €7 a day to avoid the peak, checked by number-plate cameras; participants cut peak trips by 50% | Government-run, on motorways     |
| INSTANT, Infosys Bangalore ([Stanford][instant]) | Weekly raffle for early arrivals; pre-peak arrivals doubled, and bus commutes fell from 71 to 54 minutes           | Employer-run, at the destination |
| Singapore's Travel Smart Journeys ([LTA][lta])   | Rail fare discounts for travelling before 7.15 am                                                                  | Rail only                        |
| Malaysian festive toll discounts ([KKR][kkr])    | Cheaper tolls at off-peak hours on holidays                                                                        | Seasonal; not tied to a township |

- **We found no township or gated-community scheme in Malaysia that rewards leaving outside the peak.**
- **Counter-evidence:** a 2024 field experiment in Bangalore found delay rises only "moderate and linear" with traffic across a city, so peak-spreading gave "limited commuter welfare benefits" ([IGC][kreindler]). Elmina's problem is a single exit bottleneck, where the queue grows faster than traffic, but the pitch must say so before a judge does.
- **Our read:** innovation 3. The mechanism exists abroad; the new parts are detection from a precinct's own gate log, funding by the developer's mall, and measuring the resident share first.

[vtpi]: https://www.vtpi.org/spitsmijden.pdf
[lta]: https://www.lta.gov.sg/content/ltagov/en/newsroom/2024/12/news-releases/travel-smart-journeys-gets-a-boost--new-rewards-and-expanded-opt.html
[kkr]: https://www.kkr.gov.my/ms/node/70855
[kreindler]: https://www.theigc.org/publications/peak-hour-road-congestion-pricing-experimental-evidence-and-equilibrium-implications

## Impact and how we measure it

- **Primary outcome:** minutes from the precinct gate to the GCE between 7:00 and 8:30, on weekdays, before and after the reward phase.
- **Behaviour:** share of participating households' weekday exits inside the peak window.
- **New knowledge:** residents' share of the exit-road flow at peak, which SDP doesn't know today.
- **Baseline:** the four-week measurement phase. **Comparison:** a second precinct that is measured but not rewarded.

## Fit with Sime Darby Property

- **Pillar:** Community Experience. It answers the complaint shareholders raised at SDP's own AGM, in the township that hosts the final on 3 December.
- **Value to two sides:** residents get time back every weekday. SDP gets its first resident-versus-through-traffic count to take to the council and highway authority, and calmer buyers for later phases. Mall tenants get customers at quiet hours.
- **Timing:** it bridges 2026 to 2028, until the interchange and the DASH link open.
- **Scale:** Denai Alam and Bukit Subang share the same exits, and the method fits any SDP township with a gated precinct.

## Pilot

| Element       | Plan                                                                                                                                                                                                                                                                  |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where         | One or two gated landed strata precincts in City of Elmina with RFID gate logs, plus one comparison precinct                                                                                                                                                          |
| Owner         | SDP's City of Elmina township team, with the precinct's joint management body and security contractor                                                                                                                                                                 |
| Duration      | 12 weeks: 4 measuring, 8 rewarding                                                                                                                                                                                                                                    |
| Cost          | Exporting gate logs, TomTom data (its free tier gives 20,000 calls a month ([TomTom][tomtom])), and a weekly prize pot shared with mall tenants                                                                                                                       |
| Approvals     | SDP, or the joint management body once formed. Opt-in consent under the PDPA. No council approval: the scheme changes no road. Not for guarded schemes on public roads, where Subang Jaya's council removed RFID barriers in October 2026 ([Media Selangor][kinrara]) |
| Success       | Shorter peak queue time than the comparison precinct, and a measurable shift in participants' exits                                                                                                                                                                   |
| Decision gate | If residents are a large share of the bottleneck flow and the queue shortens, extend to every gated precinct in Elmina, Denai Alam and Bukit Subang. If they're a small share, SDP has cheap proof that the fix lies with through traffic                             |
| Risks         | Through traffic refills the gap, which Spitsmijden's evaluators warned of ([VTPI][vtpi]). Prize fatigue: rotate prizes. Privacy: aggregate counts only                                                                                                                |

[tomtom]: https://docs.tomtom.com/pricing
[kinrara]: https://mediaselangor.com/ms/2026/10/399047

## Prototype by 23 October

- **Build:** a dashboard that reads exit counts in 5-minute bins, models the queue with the bottleneck model, runs the weekly draw from gate-log entries, and sends the Friday message.
- **Data:**
  - Our own 5-minute counts of cars leaving one Elmina precinct gate, and at the exit-road bottleneck, from 6:30 to 9:00 on three weekdays. Schools reopened on 15 October.
  - TomTom segment speeds on the exit roads.
  - Rapid KL's GTFS feed to show there is no bus to switch to.
- **Lead with the count:** the residents' share of the exit flow from our own counts goes on the second slide.
- **Evidence before submission:** ask 20 residents at the gate how flexible their departure time is, and what reward would move them 20 minutes.

## Scorecard

**Rank 6 of 8** in the merged ranking, with a mean judge score of 64.3 out of 100 ([ranking](0000-ranking.md#pass-2-round-10-rank-and-stress-test)). The judges are AI agents playing SDP roles, scoring the draft against the [judging matrix](0000-ranking.md#judging-matrix).

| Scorer                  | Impact | Innovation | Feasibility | Fit | Commercial | Evidence | Weighted |
| ----------------------- | ------ | ---------- | ----------- | --- | ---------- | -------- | -------- |
| Author (round 9)        | 4      | 3          | 4           | 4   | 4          | 3        | 74       |
| SDP sustainability head | 3      | 3          | 3           | 3   | 4          | 4        | 64       |
| SDP township manager    | 3      | 3          | 3           | 3   | 4          | 4        | 64       |
| Innovation mentor       | 3      | 3          | 3           | 4   | 3          | 4        | 65       |

- **Biggest weakness:** the prize is the whole mechanism, and SDP's own AGM answer blames through traffic. All three judges said residents wouldn't keep shifting without prizes, because school and work set departure times.
- **The change that would raise it most:** lead with the residents' share of the exit flow from the team's own counts, folded in above.
- **Worth doing anyway:** the township manager would "approve the four-week measurement phase today; it costs only a log export".

## Risks and open questions

- **What share is residents?** Unknown until we count. If it's small, rewards won't move the queue.
- **Will through traffic refill the road?** Possibly. The measurement phase shows it.
- **Can SDP read gate logs?** In precincts still under developer management, yes; after that, the joint management body decides.
- **The killer question:** "Our own AGM says outsiders cause the jam. Why pay our residents?" Because SDP doesn't yet know the split; the first four weeks tell it, for the cost of exporting a log.

## How the idea changed across rounds

- **Round 1:** seeded from the X evidence on Elmina's gridlock and SDP's 2025 AGM answer.
- **Round 4:** research found the Bangalore counter-evidence and that number-plate barriers on public roads were being removed. It narrowed to strata precincts, and absorbed "Lorry windows" (SDP's own trucks off-peak) and "Bas Taman" (pooled school vans, which already carry 27% of Selangor pupils).
- **Round 6:** precinct gates use RFID, not number-plate cameras, so the design moved to gate logs, and measurement became the first phase.
- **Round 8:** asked "Our own AGM says outsiders cause the jam. Why pay our residents?" Kept measurement as the first phase, with a decision gate that points SDP at through traffic if residents turn out to be a small share.
- **Round 9:** judges scored it 64 to 65, against the author's 74. The resident-share count moved to the front, and e-wallet credit joined mall vouchers as prizes.
