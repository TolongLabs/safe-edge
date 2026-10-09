# Ideation suite proposal

What our ideation suite in `docs/ideas/` should hold, as proposed on 2026-10-10: a five-step framework, free tools, a file layout and a timeline to the 23 October deadline. This is a proposal, not the suite. Reconcile the research first, then build the suite and change any part of this plan.

Contents:

1.  [What the research says](#what-the-research-says)
1.  [Reconcile the research first](#reconcile-the-research-first)
1.  [The framework: Spot, Ask, Spark, Pick, Prove](#the-framework-spot-ask-spark-pick-prove)
    1.  [Why this shape](#why-this-shape)
1.  [Checks and scorecard](#checks-and-scorecard)
1.  [Tools](#tools)
1.  [Proposed layout](#proposed-layout)
1.  [Timeline](#timeline)
1.  [What to take from the reference repo](#what-to-take-from-the-reference-repo)
1.  [Open questions](#open-questions)
1.  [See also](#see-also)

## What the research says

These five points tested our hunches. Each point links its evidence.

1.  **Malaysian judges:** partly as we thought. They use the same words as judges abroad, but they ask more for proof that it works, proof that it pays and fit with the host. In our rubric, feasibility, fit and commercial value add up to 45%, and impact is 25% ([Malaysian judges](/docs/research/malaysian-judges.md#verdict-on-the-hunch)).
1.  **HVAC and solar:** mostly right for energy, and fully right for SDP. Grid electricity is 95% of SDP's Scope 1 and 2 emissions, which rose 24% from 2023 to 2025 ([Energy, HVAC and solar](/docs/research/energy-hvac-solar.md#verdict-on-the-hunch)). In the malls we checked, rooftop solar covers 8% of the electricity at best ([Green developments](/docs/research/green-developments.md#ratings-are-mostly-promises)). A solar opportunity mapper is a briefing example, so it is taken ([BRIEF, the challenge](/docs/BRIEF.md#the-challenge)). SDP already runs the CREAM roof-leasing pilot ([Green developments](/docs/research/green-developments.md#where-sdp-stands)).
1.  **IoT:** the reward is real, but no study proves that hardware wins more often. The risk is lower than usual, because round 1 is a recorded video. Use IoT only if it passes the four-part test ([IoT](/docs/research/iot.md#a-go-or-no-go-test)).
1.  **Peers:** green features and green ratings are normal now. Measured results after handover are rare. 18 of the 19 GreenRE ratings that SDP got from 2024 to 2026 are still provisional, and no SDP township is among the five Smart Township Malaysia ratings of 2025 ([Green developments](/docs/research/green-developments.md#where-sdp-stands)).
1.  **How teams ideate:** write ideas alone before you talk or open an AI tool. AI makes ideas more alike, and teams choose their best idea no better than chance, so the choice needs its own steps ([Ideation methods](/docs/research/ideation-methods.md#what-the-evidence-says)).

## Reconcile the research first

Two sets of findings exist. Merge them before you build the suite:

- [Hackathon context](/docs/CONTEXT.md), from PR #14.
- `docs/research/`, from this proposal's PR.

| Topic                    | In `CONTEXT.md`                                                                                                      | In `docs/research/`                                                                                                                                                                           |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Past winners             | [Past winners](/docs/CONTEXT.md#past-winners)                                                                        | [Past winners](/docs/research/past-winners.md)                                                                                                                                                |
| SDP's goals and gaps     | [What SDP wants](/docs/CONTEXT.md#what-sime-darby-property-wants)                                                    | [Sime Darby Property](/docs/research/sime-darby-property.md), [Green developments](/docs/research/green-developments.md)                                                                      |
| Township problems        | [Pain points](/docs/CONTEXT.md#evidence-of-township-pain-points)                                                     | [Township problems](/docs/research/township-problems.md)                                                                                                                                      |
| Products already sold    | [Already on the market](/docs/CONTEXT.md#already-on-the-market-in-malaysia)                                          | [What already exists](/docs/research/existing-solutions.md)                                                                                                                                   |
| Rules, data and pilots   | [Policy](/docs/CONTEXT.md#policy-that-shapes-feasibility), [open data](/docs/CONTEXT.md#open-data-for-the-prototype) | [Malaysian judges](/docs/research/malaysian-judges.md), [Open data](/docs/research/open-data.md), [IoT](/docs/research/iot.md), [Energy, HVAC and solar](/docs/research/energy-hvac-solar.md) |
| Deck, video and evidence | [Best practices](/docs/CONTEXT.md#best-practices-by-deliverable)                                                     | [Best practices](/docs/research/best-practices.md)                                                                                                                                            |
| Ideation methods, tools  | Not covered                                                                                                          | [Ideation methods](/docs/research/ideation-methods.md)                                                                                                                                        |

Differences found so far:

- **Two report files:** the docs cite different PDFs of SDP's Sustainability Report 2025. `CONTEXT.md` cites "SDP SR2025 (Mobile).pdf", 12.4 MB, last modified on 23 April 2026. `docs/research/` cites "SDP SR 2025 Mobile.pdf", 4.5 MB, last modified on 20 April 2026. Pick one file, then check the page numbers and figures against it.
- **Only in `CONTEXT.md`:** SDP's 69% waste diversion rate, and SDP's own waste programmes, such as the food-waste digester at Elmina Lakeside Mall.
- **Labels:** `CONTEXT.md` marks inferences "**Our read**"; `docs/research/` writes "Inference". Choose one label.

Rules used for `docs/research/`, so that new findings match:

- Sources are from 2024 to 2026. An older source is allowed only for a law or standard still in force, foundational research that nothing newer replaces, or SDP's and Kolaxus's own past events. Label its year.
- Each quote was checked against the live page. A claim that we couldn't check goes in the "Unverified and not found" section of its doc.

## The framework: Spot, Ask, Spark, Pick, Prove

The framework has five steps in plain words. Each step makes one output, and each output becomes part of the deck. The steps follow the organisers' own process, "observe, identify, understand, create, build" ([BRIEF, advice from the organisers](/docs/BRIEF.md#advice-from-the-organisers)), and add a step to choose.

| Step  | Time                  | Output                     | Deck areas it feeds                |
| ----- | --------------------- | -------------------------- | ---------------------------------- |
| Spot  | 1 hour                | Problem cards              | Problem, target user               |
| Ask   | 1 to 2 days           | Interview notes            | Problem, with evidence             |
| Spark | 2 hours               | Idea cards                 | Solution, innovation, how it works |
| Pick  | Half a day, one night | Ranked board               | Feasibility                        |
| Prove | 1 hour                | Pilot and measurement plan | Impact and its measure, pilot plan |

The eight deck areas are in [BRIEF, pitch deck](/docs/BRIEF.md#pitch-deck). Strategic fit is a judging criterion, not a deck area, so the Pick scorecard covers it.

1.  **Spot.** Each person, alone, lists annoyances from daily life in a township. Ask "why?" until you reach the root cause. Write each problem in the organisers' sentence: "We want to help _[group]_ do _[thing]_ better". Name one user in one SDP place ([CONTEXT, takeaways](/docs/CONTEXT.md#takeaways)).
1.  **Ask.** Talk to five residents about what happened to them last time, not about your idea. Drop a problem that nobody has. Record counts and quotes ([Best practices, evidence](/docs/research/best-practices.md#evidence-judges-trust)).
1.  **Spark.** Each person sketches eight ideas in eight minutes, alone. Then share them. Then let AI play eight different residents, and compare the AI ideas for overlap. Then borrow from two places that solved a similar problem, such as Tengah or CDL ([Green developments, still rare](/docs/research/green-developments.md#what-is-still-rare)).
1.  **Pick.** Remove each idea that fails a check, then score the rest privately, discuss and score again the next morning ([checks and scorecard](#checks-and-scorecard)).
1.  **Prove.** Imagine that it is 3 December and we lost, and list why. Answer the organisers' question: what improved, measured how, compared with what? Name who pays and who gains ([Green developments, who pays](/docs/research/green-developments.md#who-pays)).

The same steps work for People or Planet, for an app or hardware, and for a team of three or five. Any step can send the team back one step.

### Why this shape

- **Alone first:** people who write alone and then pool ideas get more and better ideas than groups that talk first ([Ideation methods](/docs/research/ideation-methods.md#what-the-evidence-says)).
- **AI after people:** AI raises the quality of each idea but makes the ideas more alike. Many different personas keep the range wide ([Ideation methods, AI](/docs/research/ideation-methods.md#what-ai-does-to-ideas)).
- **A real choice step:** remove ideas first, then score against the real rubric. Score privately before you discuss, because the first number spoken anchors everyone ([Ideation methods, choosing](/docs/research/ideation-methods.md#choosing-an-idea)).
- **Three rounds of five:** interview five residents on the problem, five on the chosen idea and five on the prototype. Each round can change the idea ([Best practices, evidence](/docs/research/best-practices.md#evidence-judges-trust)).

## Checks and scorecard

Remove an idea if it fails any of these checks:

1.  **Real problem:** residents in the Ask step have it.
1.  **Real data:** we can show it with data that we collected or that is open ([Open data](/docs/research/open-data.md#quick-picks)).
1.  **Not taken:** the briefing examples are taken ([BRIEF, the challenge](/docs/BRIEF.md#the-challenge)). The idea also isn't an existing app with AI added. Search in English and Malay ([Ideation methods, checking](/docs/research/ideation-methods.md#checking-that-an-idea-is-new)).
1.  **In SDP's reach:** it can run on something that SDP builds or runs ([CONTEXT, pilot sites](/docs/CONTEXT.md#candidate-pilot-sites)).
1.  **Demo by 20 October,** with a named payer.

Then score each remaining idea from 1 to 5 against the judging criteria. Score alone first.

| Criterion                | Weight | A 5 looks like                                                            |
| ------------------------ | -----: | ------------------------------------------------------------------------- |
| Impact                   |    25% | A measured outcome against a baseline, ideally SDP's own number           |
| Innovation               |    20% | A new mechanism, and searches in English and Malay find nothing like it   |
| Feasibility              |    20% | A pilot on an SDP-run site, and a demo that works from start to finish    |
| Strategic fit            |    15% | It names one SDP pillar and one figure from SDP's report                  |
| Commercial value         |    10% | A named payer, and value for residents and for SDP or a township business |
| Team, evidence and pitch |    10% | 15 interviews in three rounds, with quotes and counts                     |

The weights are from [BRIEF, how it is judged](/docs/BRIEF.md#how-it-is-judged). The "A 5 looks like" column is our inference from the research, so refine it.

## Tools

All five are free for students.

1.  **Obsidian,** opened on this repository. Open the repository root as the vault, so that our `/docs/...` links work, and test one link first. Turn off **Settings → Files and links → `Use [[Wikilinks]]`**. Give each idea note properties, such as the scores. Then one Bases table becomes the live scoreboard. Sync with the Obsidian Git plugin on laptops; its maintainer calls mobile support unstable. Obsidian Sync costs US$4 per person a month, so use it only if teammates won't use Git ([Ideation methods, Obsidian](/docs/research/ideation-methods.md#obsidian-for-a-team)).
1.  **FigJam,** for the live Spark session ([education pricing](/docs/research/ideation-methods.md#alternatives-and-education-pricing)).
1.  **Tally,** for resident surveys, with a consent line under the amended PDPA ([Best practices, personal data](/docs/research/best-practices.md#personal-data-in-surveys-and-pilots)).
1.  **Gemini Notebook,** formerly NotebookLM. Load the research docs into it, so that teammates can ask questions about them instead of reading every page ([AI research helpers](/docs/research/ideation-methods.md#ai-research-helpers)).
1.  **GitHub Issues,** for tasks, as our conventions require.

## Proposed layout

```text
docs/ideas/
├── README.md              the five steps, the timeline and roles
├── cheatsheet.md          one page of reconciled facts
├── templates/             problem card, interview note, idea card, AI resident prompts
├── 0000-ranking.md        checks, scorecard, ranking and removed ideas
├── ranking.base           the Obsidian Bases scoreboard
└── 0001-<idea>.md         one file for each idea that survives, numbered by rank
```

- **Roles in `README.md`:** a timekeeper, a researcher who runs the interviews, a builder and a storyteller who owns the deck.
- **Cheat sheet contents:**
  - the judging weights and the taken ideas;
  - SDP hooks: Innovation Park, CREAM, its malls and its provisional ratings;
  - practices that are normal and practices that are rare;
  - the best data sources, the IoT test and seven ways that a project gets paid for.
- **Idea cards** carry the properties that `ranking.base` reads, so the scoreboard updates itself.

## Timeline

| Dates               | Work                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------- |
| Sat 10 – Sun 11 Oct | Spot, and the first five interviews                                                           |
| Mon 12 – Tue 13 Oct | Spark, then Pick; sleep on the board                                                          |
| Wed 14 Oct          | Final pick and Prove; order any IoT parts that day                                            |
| Thu 15 – Tue 20 Oct | Build; five interviews on the idea, then five on the prototype; shoot the video by 20 October |
| Thu 22 – Fri 23 Oct | Polish the deck, get a review from someone outside the team, submit early                     |

Registration closes on Wednesday 21 October at 11:59 PM, and the proposal is due on Friday 23 October at 11:59 PM ([BRIEF, key dates](/docs/BRIEF.md#key-dates)).

## What to take from the reference repo

The [openagent ideas folder][openagent-ideas] ranks numbered idea files after ten rounds of ideation.

- **Keep:** one numbered file for each idea, a ranking file that records removed ideas and the reasons, scores against the real rubric, and an independent review at the end.
- **Change:** all ten rounds there were done by AI, without user interviews, and the ranking file says so itself. Our suite puts residents first and uses five steps instead of ten.

[openagent-ideas]: https://github.com/M1KUAPP/openagent/tree/main/docs/ideas

## Open questions

- Do we merge `CONTEXT.md` and `docs/research/` into one set, or keep both and link them?
- Git or Obsidian Sync: will every teammate use Git on a laptop?
- People or Planet: do we choose the track before Spot, or let Pick decide it?
- Is the "A 5 looks like" column strict enough to separate close ideas?

## See also

- [BRIEF](/docs/BRIEF.md), for the rules, dates and judging weights
- [Hackathon context](/docs/CONTEXT.md), for the team's first findings
- [Ideation methods](/docs/research/ideation-methods.md), for the evidence behind this framework
- [Green developments](/docs/research/green-developments.md), for what peers already do
