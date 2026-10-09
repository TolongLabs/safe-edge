# Idea ranking

Four candidate solutions for our Township of Tomorrow entry, ranked after a ten-round ideation against the judging matrix and the brief's rules, as of 10 October 2026. This is evidence for the team's pick in [issue #18][i18], not the pick itself. Each idea has its own file, numbered by its rank here.

[i18]: https://github.com/TolongLabs/sdp-hack/issues/18

Contents:

1.  [Ranking](#ranking)
1.  [Recommendation](#recommendation)
1.  [Scoring method](#scoring-method)
    1.  [Judging matrix](#judging-matrix)
    1.  [Gates](#gates)
    1.  [Who scored this](#who-scored-this)
    1.  [Assumptions](#assumptions)
1.  [The ten rounds](#the-ten-rounds)
    1.  [Round 1: diverge](#round-1-diverge)
    1.  [Round 2: gates](#round-2-gates)
    1.  [Round 3: first score](#round-3-first-score)
    1.  [Round 4: novelty and evidence](#round-4-novelty-and-evidence)
    1.  [Round 5: re-diverge](#round-5-re-diverge)
    1.  [Round 6: check the new ideas](#round-6-check-the-new-ideas)
    1.  [Round 7: pilot and prototype](#round-7-pilot-and-prototype)
    1.  [Round 8: red team](#round-8-red-team)
    1.  [Round 9: independent panel](#round-9-independent-panel)
    1.  [Round 10: rank and stress-test](#round-10-rank-and-stress-test)
1.  [Cut ideas](#cut-ideas)
1.  [Next steps for the team](#next-steps-for-the-team)
    1.  [What changed from the suite proposal](#what-changed-from-the-suite-proposal)
1.  [Open questions](#open-questions)
1.  [See also](#see-also)

## Ranking

| Rank | Idea                | Track  | Judges /100 | Verdict                                                                            |
| ---: | ------------------- | ------ | ----------: | ---------------------------------------------------------------------------------- |
|    1 | [Jiran Siaga][i1]   | People |        69.3 | Tied lead. Highest impact, a risk to life; the trigger and liability are its risks |
|    2 | [Kolam Sedia][i2]   | Planet |        68.7 | Tied lead. SDP can approve it alone; first on first-place votes and at 50% fit     |
|    3 | [Teduh][i3]         | Planet |        65.3 | Cheapest to build and prove; small, slow impact                                    |
|    4 | [Handover Loop][i4] | Planet |        59.7 | No lever after handover; only worth it if contractors confirm the price case       |

Mean judge scores by criterion, out of 5, with the weights from the [brief]:

| Idea          | Impact 25% | Innovation 20% | Feasibility 20% | Fit 15% | Commercial 10% | Evidence 10% |
| ------------- | ---------: | -------------: | --------------: | ------: | -------------: | -----------: |
| Jiran Siaga   |        4.0 |            3.0 |             3.0 |     4.0 |            3.0 |          3.7 |
| Kolam Sedia   |        3.0 |            3.0 |             3.7 |     4.3 |            4.0 |          3.0 |
| Teduh         |        2.7 |            2.3 |             4.0 |     4.0 |            3.7 |          3.7 |
| Handover Loop |        3.0 |            2.7 |             3.0 |     3.3 |            3.0 |          3.0 |

[i1]: 0001-jiran-siaga.md
[i2]: 0002-kolam-sedia.md
[i3]: 0003-teduh.md
[i4]: 0004-handover-loop.md
[winners]: /docs/research/past-winners.md#malaysian-hackathons-2024-to-2026
[brief]: /docs/BRIEF.md

## Recommendation

- **Pick [Jiran Siaga][i1] or [Kolam Sedia][i2]; they are tied.**
  - They are about 0.7 points apart, and they swap places if strategic fit weighs 50% (see [round 10](#round-10-rank-and-stress-test)).
  - Two of the three judges, both playing SDP roles, put Kolam Sedia first. The mean puts Jiran Siaga first because its impact is higher.
  - Both target Bandar Bukit Raja, which SDP rates at key acute flood risk. Residents there blamed SDP for the November 2024 flood.
- **Settle the tie by Wed 14 Oct** with the tests in [issue #18][i18]:
  - **Jiran Siaga** passes if a residents' association agrees to a timed drill on one street.
  - **Kolam Sedia** passes if SDP's Bandar Bukit Raja team confirms which pond outlets can be controlled and shares one pond's records.
  - **If neither passes,** default to Jiran Siaga: impact is the heaviest criterion, and its demo runs on public data.
  - **The choice also sets the track:** People or Planet.
- **Pitch one idea, not both.** The two share data, and Kolam Sedia's pond sensors can feed Jiran Siaga's trigger. Show the other idea only as a scale-up in the appendix: "If you try to solve everything, you solve nothing" ([brief]).
- **[Teduh][i3] is the fallback** if the team wants the cheapest build and evidence, at the cost of impact.
- **Drop [Handover Loop][i4]** unless contractor interviews prove it beats MBSA's RM290 bin on price.
- **Innovation is every finalist's weakest or joint-weakest criterion.** At best each is new in Malaysia but exists abroad, which scores 3. The deck has to show why it is new here, as the brief advises.
- **Flood ideas have won before.** Recent Malaysian hackathons crowned USM's "Smart Manhole" and APU's MySelamat flood-rescue planner ([past winners][winners]). Either flood idea must show how it differs from them.

## Scoring method

### Judging matrix

Each idea scores 1 to 5 on the six judging criteria from slide 26 ([brief]). The weighted score is the sum of score × weight ÷ 5, out of 100.

| Criterion (weight)                        | 5                                                                                                                           | 3                                                                | 1                                                      |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------ |
| Impact and sustainability value (25%)     | A severe harm (life, home, car, health) or a large quantity for thousands of residents, with an outcome metric and baseline | A moderate outcome for hundreds, or a proxy metric               | Awareness only, or unmeasurable                        |
| Innovation and differentiation (20%)      | Mechanism not found anywhere                                                                                                | Exists abroad, new in Malaysia                                   | Already in Malaysia, at SDP, or on the briefing slides |
| Feasibility and deliverability (20%)      | SDP alone can approve it on its own asset; months, low cost; no rule change                                                 | Needs one outside party to agree (council, JMB, RA, police, JPS) | Needs a law or licence change                          |
| Strategic fit and theme relevance (15%)   | One track, closes a gap SDP admits, moves a number SDP reports                                                              | One track, ties to a pillar                                      | Off-theme                                              |
| Commercial and value multiplication (10%) | Value to SDP or a township business and to residents; scales to other townships                                             | Value to one side                                                | A cost with no return                                  |
| Team, evidence and pitch quality (10%)    | Real baseline and user evidence obtainable before 23 October; one-sentence story is clear                                   | Secondary data only                                              | No data obtainable                                     |

The innovation anchors follow the brief's conflict on the innovation bar: "new in Malaysia" scores 3, and "not found anywhere" scores 5.

### Gates

An idea that fails a gate is cut, whatever its score. The gates come from the brief's rules and [CONTEXT]'s takeaways:

1.  **Not taken:** not one of the briefing's examples (slides 16 and 18).
1.  **Not a re-skin** of something SDP or the Malaysian market already runs ([CONTEXT], "Already done by SDP" and "Already on the market in Malaysia").
1.  **Within SDP's reach:** SDP can pilot it on its own asset or process ([CONTEXT], "Who decides in a township").
1.  **No unrouted blocker:** no licence or law blocks it without a named route through.
1.  **Buildable:** one coder can demo the core flow on real data by 23 October.
1.  **Specific:** one named user in one named SDP place.

[CONTEXT]: /docs/CONTEXT.md

### Who scored this

- **One Claude Code session on Claude Opus 5.5** did most of the work:
  - generated the ideas, wrote the anchors and gates;
  - scored rounds 3 and 9;
  - wrote the idea docs.
- **Seven research agents** on the same model did rounds 4 and 6. Each fetched the sources it cites.
- **Three judge agents on Claude Sonnet 5.5** scored the four drafts in round 9. They used the anchors above, without seeing the author's scores.
- **Two fact-check agents on Claude Sonnet 5.5** then checked the docs' quotes, numbers and dates against the cited pages, and their corrections were applied.
- **No human has scored the ideas, and no resident has been interviewed.** Treat a gap of a few points as a tie.

### Assumptions

- **Team:** 3 to 5 students, at least one of whom codes ([brief]). The team can travel to City of Elmina and Bandar Bukit Raja for interviews before 23 October.
- **Track:** not chosen yet. The ideation covered both.
- **Weights:** strategic fit is 15%, as the brief acts on. The 50% figure from the briefing is tested in [round 10](#round-10-rank-and-stress-test).

## The ten rounds

### Round 1: diverge

33 seeds came from four lenses:

- the gaps SDP admits;
- the evidence of township pain points;
- assets and processes SDP owns: key handover, the developer management period, malls, flood ponds and the tree pledge;
- the 14 focus areas on slides 15 and 17.

17 seeds are Planet ideas and 16 are People ideas; all are listed under [Cut ideas](#cut-ideas).

### Round 2: gates

The [gates](#gates) cut 16 seeds, and 3 merged into survivors, leaving 14.

### Round 3: first score

The 14 survivors were scored against the [judging matrix](#judging-matrix) from the brief and CONTEXT alone. The top 10, scoring 64 to 79, advanced.

### Round 4: novelty and evidence

Five research agents took the top 10 by theme: waste, flood, safety, shops and nature. For each idea they found:

- the closest analogues in Malaysia and abroad;
- problem evidence and pilot facts;
- open data for a prototype;
- the hardest question a judge would ask.

Round 4 then cut three ideas whose mechanism already runs in Malaysia or at SDP, weakened four others and sent Handover Loop back to be rebuilt.

### Round 5: re-diverge

New seeds built on what round 4 found:

- **Pond operations:** SDP's own Bandar Bukit Raja flood ponds, and its admission that "failure to maintain systems may reduce resilience over time", gave this new idea.
- **Handover Loop, rebuilt:** renovating at handover is normal, and renovation is the most-cited cause of illegal dumping, so the idea was rebuilt around debris disposal.
- **Considered and dropped:**
  - a digital as-built logbook for safe renovation (thin evidence);
  - guard welfare rounds for older residents (Selangor's YAWAS pilot, planned from June 2026, already sends fall alerts to family or security staff ([Media Selangor][yawas]));
  - heat refuges in malls (56 heat-related cases nationally between 1 January and 3 May 2026 ([CONTEXT]), so the burden is low);
  - water-cut resilience (outside SDP's reach).

[yawas]: https://mediaselangor.com/en/2026/01/340028

### Round 6: check the new ideas

Two more research agents checked the round 5 ideas, and both survived in narrower form:

- **Pond operations:** drawing ponds down before each storm fails, because thunderstorm warnings come too late. Outlet monitoring and seasonal levels survive.
- **Handover Loop:** a compulsory deposit is likely unlawful under the housing regulations, and Shanghai already mandates drop points for renovation waste.

### Round 7: pilot and prototype

Each survivor got:

- a pilot on SDP land or with SDP's partners, with an owner, a duration, approvals and cost items;
- a prototype a single coder can build on real data by 23 October.

These are in each idea doc's "Pilot" and "Prototype by 23 October" sections.

### Round 8: red team

Each survivor faced its killer question and was then killed, changed, merged or parked:

- **Jiran Siaga:** the trigger moved to local signals, because no gauge sits on Sungai Puloh.
- **Kolam Sedia:** narrowed to outlet health and seasonal levels.
- **Teduh:** shade siting merged with sapling survival.
- **Handover Loop:** dropped the deposit and the extension designs. The reuse exchange and the fit-out opt-out had gone in round 4.
- **Killed:** Flood car refuge and Shoplot sandbox.
- **Parked:** Day-one address.

### Round 9: independent panel

Three judge agents each played one role:

- SDP's head of sustainability;
- an SDP township general manager;
- an external innovation mentor.

Each read only the brief, CONTEXT and the four drafts, and scored with the [judging matrix](#judging-matrix). Their weighted scores, with the author's round 9 scores shown but not counted:

| Idea          | Author | Sustainability head | Township manager | Innovation mentor | Judges' mean |
| ------------- | -----: | ------------------: | ---------------: | ----------------: | -----------: |
| Jiran Siaga   |     72 |                  70 |               68 |                70 |         69.3 |
| Kolam Sedia   |     72 |                  72 |               69 |                65 |         68.7 |
| Teduh         |     65 |                  71 |               67 |                58 |         65.3 |
| Handover Loop |     58 |                  56 |               63 |                60 |         59.7 |

Each judge named every idea's biggest weakness and the one change that would raise its score most. Those answers are in each idea doc's "Scorecard". Three were folded into the drafts:

- Kolam Sedia now leads with outlet faults caught.
- Teduh now leads with measured sun exposure.
- Handover Loop now labels its modelled handover data.

### Round 10: rank and stress-test

The ranking uses the judges' mean, a rule set before they reported. Two checks test how stable it is:

- **First-place votes:** the sustainability head and the township manager each ranked Kolam Sedia first. The mentor ranked Jiran Siaga first.
- **50% strategic fit:** in the briefing, strategic fit was put at 50% (Dina, 37:04), against 15% on slide 26. With fit at 50% and the other weights scaled down in proportion, the judges' mean criterion scores give:

| Idea          | Slide 26 weights | Fit at 50% |
| ------------- | ---------------: | ---------: |
| Kolam Sedia   |             68.7 |       76.1 |
| Jiran Siaga   |             69.3 |       73.7 |
| Teduh         |             65.3 |       71.4 |
| Handover Loop |             59.7 |       62.5 |

The top two swap, and the bottom two hold. Hence the tie in the [recommendation](#recommendation).

## Cut ideas

Merged into a survivor in round 2:

- **Fit-out opt-out,** where buyers decline fittings they will replace: into Handover Loop. It was dropped in round 4: South Korea's "minus option" had 1 taker in 507 homes at its first complex in 2008, though about 12% took it at one complex in 2016 ([Edaily][minus], _secondary_).
- **Living flood map** from pond sensors and forecasts: into Flood car refuge. Its sensors live on in [Kolam Sedia][i2].
- **Shade at feeder stops:** into [Teduh][i3].

[minus]: https://m.edaily.co.kr/News/Read?newsId=01193926612649904&mediaCodeNo=257

Cut in round 2 by a [gate](#gates), on our read of the brief and CONTEXT:

- **Drain watch** (residents report drain and pump faults): too close to the "one reporting channel" example and the councils' complaint apps.
- **Compost to corridor:** SDP already composts at KLGCC and KL East Mall.
- **Rainwater and greywater retrofit:** homeowner hardware, and rainwater harvesting is already in PLANMalaysia's guideline ([CONTEXT]).
- **Solar for schools through CREAM:** a matching tool resembles the "solar opportunity mapper" example.
- **Mall tenant energy league:** building-management vendors already sell it.
- **EV charger sharing between neighbours:** reselling electricity needs a licence.
- **School gate drop-off slots:** schools answer to the education ministry.
- **Safe routes to school audit:** common practice, and on council roads.
- **New-neighbour cohorts:** community apps and residents' WhatsApp groups already do it.
- **Demand-responsive feeder bus:** Rapid KL On-Demand exists, and routes need licences (the SITEC lesson in [CONTEXT]).
- **Parcel lockers:** the "secure parcel collection" example.
- **Lost and found, caregiver respite hub, park programming from sensors, health kiosks in malls, teen hangout spaces:** no specific township problem, or outside SDP's business.

Cut in round 3 on score:

- **Path sense:** phone motion sensors map kerbs for wheelchairs and prams (62).
- **Solar-hours shift** for Solar ATAP homes (61): weak evidence, and the tariff arithmetic is unchecked.
- **Night-flow leak check** during the defect liability period (61): thin evidence that hidden leaks are common.
- **Heat-safe construction sites** (60): it serves workers, not residents, and SDP already uses AI for site safety.

Killed in round 4:

- **Construction surplus exchange:**
  - WCT already transfers waste and surplus to its other sites for reuse ([WCT][wct] p. 93).
  - The only construction-site diversion SDP describes is oil palm biomass at four sites, with no breakdown by material ([SR2025] p. 77).
- **Kettle check** (smart-plug alerts for older people living alone):
  - Seoul already alerts welfare officials when an older person's appliance use drops ([FutureIoT][seoul]). Selangor's YAWAS pilot plans fall alerts to family or security staff ([Media Selangor][yawas]).
  - Amanita is a police crime network, not a welfare one.
- **Sound census** (acoustic biodiversity monitoring):
  - SDP already uses specialist surveys and camera traps.
  - A global test found BirdNET performs worst in Africa and Asia ([University of Copenhagen][birdnet test]), and its models are licensed for non-commercial use only ([BirdNET][birdnet]).

Killed or parked in round 8:

- **Flood car refuge (killed):**
  - In November 2022, MBSA opened the Sri Muda Modern Market multi-storey car park for residents to park in during floods ([Malay Mail][srimuda], _secondary_).
  - We found no SDP mall or multi-storey car park in Bandar Bukit Raja (our search).
- **Shoplot sandbox (killed):**
  - SDP sells its shop offices. Temu 1 is "completed and fully occupied" ([The Edge][temu], _secondary_), and JUMPA sold out in a day ([SDP][jumpa]).
  - SDP's own 2021 programme already turned "vacant or underutilised commercial complexes" into community centres ([The Edge][eep], _secondary_).
- **Day-one address (parked):**
  - Google already accepts address uploads from housing developers ([Google][gmcp]), and a national address system is due by 2027 ([Bernama][nas], _secondary_).
  - Reopen it only if a test shows Google, Waze and Grab can't find most Elmina homes. Nominatim, the OpenStreetMap search, found 0 of 12 real addresses in our test.

[wct]: https://www.wct.com.my/pdf/Sustainability%20Statement%202025.pdf
[SR2025]: https://www.simedarbyproperty.com/sites/default/files/2026-04/SDP%20SR2025%20%28Website%29.pdf
[seoul]: https://futureiot.tech/seoul-expands-iot-based-smart-plug-program/
[birdnet test]: https://curis.ku.dk/ws/files/529531919/A_global_assessment_of_BirdNET_performance.pdf
[birdnet]: https://github.com/birdnet-team/BirdNET-Analyzer
[srimuda]: https://www.malaymail.com/news/malaysia/2022/11/08/shah-alam-council-cops-tell-sri-muda-residents-to-park-vehicles-on-elevated-ground-following-flood-alert/38328
[temu]: https://theedgemalaysia.com/node/722978
[jumpa]: https://www.simedarbyproperty.com/press-releases/strong-demand-investors-and-homebuyers-powers-sime-darby-propertys-success-elmina
[eep]: https://theedgemalaysia.com/article/sime-darby-property-virtual-run-raises-over-rm50000-underprivileged-communities
[gmcp]: https://cities.google/google-maps-content-partners
[nas]: https://www.bernama.com/en/news.php?id=2497923

## Next steps for the team

The ten rounds were desk research by AI. These steps put residents and the team's own judgement back in, before and after the pick in [issue #18][i18]. Name four roles first: a timekeeper, a researcher who runs the interviews, a builder and a storyteller who owns the deck.

1.  **Ask, by Tue 13 Oct.** Interview five residents in each area of the top two:
    - Ask about what happened to them last time, not about our idea ([evidence judges trust][evidence]).
    - Record counts and exact quotes.
    - Drop a problem that nobody has.
    - Collect consent for personal data, as the PDPA requires ([personal data][pdpa]).
1.  **Pick, by Wed 14 Oct.**
    - Each member scores the finalists alone with the [judging matrix](#judging-matrix) before anyone speaks, because the first number said aloud anchors everyone.
    - Discuss, then score again the next morning ([choosing an idea][choosing]).
    - Apply one more gate: residents in the Ask step must have the problem.
1.  **Prove, on Wed 14 Oct.**
    - Imagine it is 3 December and we lost, and list why.
    - Answer the organisers' question: what improved, measured how, compared with what?
    - Name who pays and who gains ([who pays][payers]).
    - If the pick needs hardware, such as Kolam Sedia's sensor, run the [IoT test][iot] and order parts that day.
1.  **Build, from Thu 15 to Tue 20 Oct.** Run five interviews on the idea, then five on the prototype. Shoot the video by 20 October.
1.  **Submit, on Thu 22 to Fri 23 Oct.** Get a review from someone outside the team, and submit early. Registration closes at 11:59 PM on Wed 21 October ([brief]).

[evidence]: /docs/research/best-practices.md#evidence-judges-trust
[pdpa]: /docs/research/best-practices.md#personal-data-in-surveys-and-pilots
[choosing]: /docs/research/ideation-methods.md#choosing-an-idea
[payers]: /docs/research/green-developments.md#who-pays
[iot]: /docs/research/iot.md#a-go-or-no-go-test

### What changed from the suite proposal

The team's ideation suite proposal, from PR #16, is folded in here and deleted.

- **Kept:**
  - one numbered file per idea, and a ranking that records cut ideas and why;
  - scores against the real rubric, with checks that remove ideas first;
  - an independent review at the end;
  - the resident-first steps above.
- **Changed:**
  - Ten AI rounds replaced the proposal's five steps (Spot, Ask, Spark, Pick and Prove) for generating ideas. The proposal's Ask, Pick and Prove steps now come after the shortlist, as the steps above.
  - The "A 5 looks like" column became the three-anchor [judging matrix](#judging-matrix).
- **Dropped:**
  - the cheat sheet, templates and the Obsidian scoreboard, because the ranking table is the scoreboard;
  - the proposal's tool list, apart from consent for surveys.
- **Reconciled:**
  - All docs now cite the Sustainability Report 2025 file that SDP's sustainability page links. Its text matches both earlier files page for page, so page numbers didn't change.
  - [CONTEXT] and `docs/research/` now share the "Our read" label for inference.
  - 17 facts that [CONTEXT] and `docs/research/` stated differently were checked against their sources and corrected on the wrong side. Examples: SDP's 2025 emissions rise is partly a wider reporting boundary, its NPS is published, and CREAM covers 450 homes in two townships.

## Open questions

- **Do residents and SDP confirm the problems?** No resident or SDP staff member has been interviewed for any idea. The deciding tests are in [issue #18][i18].
- **Does the team score the top two the same way?** Nobody on the team has scored them yet; the Pick step above settles it.

## See also

- [BRIEF][brief]: rules, dates, deliverables and judging weights.
- [CONTEXT]: past winners, SDP's strategy and gaps, Malaysian context and pitch practice.
- [Research](/docs/research/): the team's vetted research, including [past winners][winners] and [what already exists](/docs/research/existing-solutions.md).
