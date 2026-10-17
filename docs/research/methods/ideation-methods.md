# Ideation methods and tools

What research says about generating and choosing ideas as a team, what AI does to that process, and which tools fit a Markdown repo like ours, as of 2026-10-10. Most findings on group methods come from foundational studies older than 2024; we keep them because no newer study replaces them. The AI findings are from 2024 to 2026. This page is evidence for how we ideate; the results are in the [idea ranking](/docs/archive/ideas/0000-ranking.md).

Contents:

1.  [What the evidence says](#what-the-evidence-says)
1.  [What AI does to ideas](#what-ai-does-to-ideas)
1.  [Frameworks compared](#frameworks-compared)
1.  [Choosing an idea](#choosing-an-idea)
1.  [Checking that an idea is new](#checking-that-an-idea-is-new)
1.  [Tools](#tools)
    1.  [Obsidian for a team](#obsidian-for-a-team)
    1.  [Alternatives and education pricing](#alternatives-and-education-pricing)
    1.  [AI research helpers](#ai-research-helpers)
1.  [Unverified and not found](#unverified-and-not-found)
1.  [See also](#see-also)

## What the evidence says

- **Write alone first, then share.** People who generate ideas alone and then pool them produce more and better ideas than groups who brainstorm out loud. A 1991 meta-analysis found brainstorming groups "significantly less productive than nominal groups, in terms of both quantity and quality", with bigger losses when ideas are spoken rather than written ([Mullen et al.][mullen]). The main cause is turn-taking, which blocks people while others talk ([Diehl and Stroebe, 1987][diehl]).
- **The best structure is hybrid.** An individual round followed by a group review gave more ideas, better ideas and better selection than working together from the start ([Girotra, Terwiesch and Ulrich, 2010][girotra2010]).
- **Teams pick badly.** In one study, groups chose among their ideas no better than chance, even when they had generated more original ones ([Rietzschel et al., 2006][rietzschel]). So the choosing step needs as much structure as the generating step.
- **Volume is not enough.** The quality of the best idea depends on four things: how many ideas, their average quality, their spread, and how well the team recognises the best one ([Girotra et al., 2010][girotra2010]).
- **Take a break before choosing.** A 2009 meta-analysis found a positive incubation effect, strongest for divergent-thinking tasks such as idea generation, and smaller when the break is filled with demanding work ([Sio and Ormerod][sio]; [later review][incubation]).
- **Constraints help, but not reliably.** Across 111 studies, constraints had a significant positive link with creativity that "differed substantially" by constraint type and study design ([Damadzic et al., 2022][constraints]). Don't assume a tight deadline makes ideas better.
- **Compare two analogies, not one.** People transferred a solution to a new problem when they compared two source examples, but not reliably with one ([Gick and Holyoak, 1983][gick]).
- **Hackathon winners spend real time on the problem.** Interviews with 32 prize-winning developers found that stronger teams spent "a good part" of their time exploring the problem before converging, and valued a well-grounded problem over a complex solution ([Gama et al., 2022][gama]).

[mullen]: https://www.tandfonline.com/doi/abs/10.1207/s15324834basp1201_1
[diehl]: https://oamonitor.ireland.openaire.eu/national/search/publication?pid=10.1037%2F0022-3514.53.3.497
[girotra2010]: https://pubsonline.informs.org/doi/10.1287/mnsc.1090.1144
[rietzschel]: https://dare.uva.nl/id/50976989-753c-4d97-8796-a44b3bb3552f
[sio]: https://openresearch.surrey.ac.uk/esploro/outputs/journalArticle/Does-incubation-enhance-problem-solving-A/99512444302346
[incubation]: https://pmc.ncbi.nlm.nih.gov/articles/PMC4956660/
[constraints]: https://onlinelibrary.wiley.com/doi/full/10.1002/job.2655
[gick]: https://www.sciencedirect.com/science/article/pii/0010028583900026
[gama]: https://arxiv.org/html/2206.04744

## What AI does to ideas

- **AI makes each idea a bit better and all ideas more alike.** In a randomised study of 293 writers, access to five AI ideas raised rated novelty by 8.1% and usefulness by 9.0%. The AI-assisted stories were also more similar to each other ([Doshi and Hauser, 2024][doshi]).
- **Asking everyone the same chatbot narrows the pool.** Across five 2025 experiments, 37 of 45 diversity comparisons favoured unaided people. In one task, 94% of ChatGPT-assisted ideas overlapped, and nine people independently named their toy "Build-a-Breeze Castle" ([Wharton summary of the Nature paper][wharton-nature]).
- **The effect is small on average but real.** A 2026 meta-analysis of 19 studies found a small, significant homogenisation effect, stronger in narrowly defined tasks like ours ([homogenisation meta-analysis][homog]).
- **AI ideas look novel and then underdeliver.** Over 100 NLP researchers rated LLM research ideas more novel but slightly less feasible than expert ideas ([Si et al., 2024][si2024]). When 43 researchers then built the ideas, the LLM ideas lost more ground on novelty, effectiveness and overall rating ([Si et al., 2025][si2025]).
- **Prompting can restore variety.** Chain-of-thought prompts brought GPT-4's idea pool close to human diversity, and staged prompts asking for bold, different ideas worked best ([Meincke, Mollick and Terwiesch, 2024][meincke]). Ten different AI personas kept story diversity near the human-only baseline ([Wan and Kalman, 2026][personas]).
- **Seeing AI ideas as examples differs from outsourcing to them.** In an 800-person experiment, exposure to AI ideas as examples raised collective diversity without raising individual creativity ([dynamic experiment, 2025][dynamic]).
- **Our read:** every member writes ideas alone before anyone opens an AI tool. Then use AI with several distinct personas or resident roles, compare outputs for overlap, and check feasibility with real people, because novelty and feasibility move separately.

[doshi]: https://www.science.org/doi/10.1126/sciadv.adn5290
[wharton-nature]: https://mackinstitute.wharton.upenn.edu/2025/new-in-nature-chatgpt-decreases-idea-diversity-in-brainstorming/
[homog]: https://pure.au.dk/portal/en/publications/does-generative-ai-make-us-think-alike-a-systematic-review-and-me/
[si2024]: https://arxiv.org/abs/2409.04109
[si2025]: https://arxiv.org/abs/2506.20803
[meincke]: https://mackinstitute.wharton.upenn.edu/wp-content/uploads/2024/02/for-web-AI-idea-variance.pdf
[personas]: https://arxiv.org/abs/2504.13868
[dynamic]: https://oamonitor.ireland.openaire.eu/national/search/publication?pid=10.1145%2F3715928.3737481

## Frameworks compared

None of these has a controlled study showing it beats the others, except the limited SCAMPER result below. Times are planning estimates unless a source gives one.

| Framework                  | In plain words                                                       | Time             | Stage                | Jargon      |
| -------------------------- | -------------------------------------------------------------------- | ---------------- | -------------------- | ----------- |
| How Might We               | Turn a finding into an open question: "How might we…?"               | 5–10 min         | Frame                | Low         |
| Double Diamond             | Explore the problem wide, pick one, explore solutions wide, pick one | Days             | All                  | Low         |
| 5 Whys                     | Ask "why?" until you reach a root cause                              | 10–20 min        | Find, frame          | Low         |
| The Mom Test               | Ask about past behaviour, not opinions of your idea                  | 15–30 min a chat | Find, test           | Low         |
| Crazy 8s                   | Sketch eight ideas in eight minutes, alone                           | 8 min            | Generate             | Low         |
| SCAMPER                    | Substitute, combine, adapt, modify, reuse, eliminate, reverse        | About 20 min     | Generate             | Low–medium  |
| Analogous inspiration      | See how another field solves the same shape of problem               | 15–30 min        | Generate             | Medium      |
| Jobs to be Done            | Ask what progress a person is trying to make in a situation          | 30–60 min a chat | Find, frame          | Medium      |
| Opportunity Solution Tree  | Link one outcome to user needs, then ideas, then tests               | 30–60 min        | Find, generate, test | Medium      |
| Value Proposition Canvas   | Map a user's jobs, pains and gains against your offer                | 30–60 min        | Frame, test          | Medium      |
| Lean Canvas                | One-page business model                                              | 5 min draft      | Frame, select        | Medium–high |
| Pre-mortem                 | Imagine the project failed; list why                                 | 10–20 min        | Select, test         | Medium      |
| Working backwards (PR/FAQ) | Write the launch press release and FAQ before building               | 1 hr review      | Frame, select        | High        |
| GV Design Sprint           | Five facilitated days from question to tested prototype              | 5 days           | All                  | Medium      |

- SCAMPER marginally improved originality, but not convergent thinking, in a 2022 training study ([SCAMPER study][scamper]).
- The popular claim that a pre-mortem yields 30% more reasons isn't clean: the 1989 study found time perspective alone had little effect ([Mitchell et al.][mitchell]). A 10-session field use found 217 barriers, without a control group ([brainwriting pre-mortem][premortem]).
- Sources for the descriptions: [IDEO][ideo], [Design Council][dd], [Christensen Institute][jtbd], [Product Talk][ost], [Strategyzer][vpc], [LEANSTACK][lean], [Google Design Sprint Kit][crazy8], [Toyota][toyota], [The Mom Test][momtest], [Amazon][amazon].

[scamper]: https://eric.ed.gov/?id=EJ1349922
[mitchell]: https://onlinelibrary.wiley.com/doi/pdf/10.1002/bdm.3960020103
[premortem]: https://pmc.ncbi.nlm.nih.gov/articles/PMC6493673/
[ideo]: https://designthinking.ideo.com/process
[dd]: https://www.designcouncil.org.uk/resources/the-double-diamond/
[jtbd]: https://www.christenseninstitute.org/theory/jobs-to-be-done/
[ost]: https://www.producttalk.org/discovering-solutions/
[vpc]: https://www.strategyzer.com/library/the-value-proposition-canvas
[lean]: https://leanstack.com/lean-canvas
[crazy8]: https://designsprintkit.withgoogle.com/methodology/phase3-sketch/crazy-8s
[toyota]: https://www.toyota-europe.com/about-us/toyota-quality
[momtest]: https://www.momtestbook.com/
[amazon]: https://www.aboutamazon.com/news/workplace/an-insider-look-at-amazons-culture-and-processes

## Choosing an idea

- **Kill first, then score.** Screen out fatal flaws with pass/fail checks before any weighted ranking, as transport planners do ([FHWA decision framework][fhwa]). For us the checks come from [BRIEF](/docs/BRIEF.md): real problem, real data, not taken, within SDP's reach, demonstrable by 23 October.
- **Score against the real rubric.** A weighted matrix makes a ranking auditable, but it structures the discussion; it doesn't prove the answer ([UK Green Book guidance][mcda]). Our weights are the six judging criteria in [BRIEF, how it is judged](/docs/BRIEF.md#how-it-is-judged).
- **Score privately, then discuss, then rescore.** That is the mediating assessments protocol ([Kahneman and Sibony][map]). Anchoring is strong: a 2026 meta-analysis of 2,601 effects found g = 0.825 ([anchoring meta-analysis][anchoring]). Senior people speak last, as in Amazon's reviews ([Amazon][amazon]).
- **Use ICE or RICE only as rough sorting.** RICE is reach × impact × confidence ÷ effort, and Intercom warns it is not a hard rule ([Intercom][rice]). ICE sources disagree on averaging versus multiplying, so pick one formula first ([ICE explainer][ice]).
- **Dot voting is a quick scan.** Give each person three to five dots, vote privately when trust is low, and check whether familiar ideas won only because they were familiar ([18F][dots]).
- **Groupthink is conditional.** Cohesive teams don't decide worse on average; they do when other groupthink conditions are present ([1994 meta-analysis][cohesion]).

[fhwa]: https://ops.fhwa.dot.gov/publications/fhwahop12009/sec5.htm
[mcda]: https://www.gov.uk/government/publications/green-book-supplementary-guidance-use-of-multi-criteria-decision-analysis/use-of-multi-criteria-decision-analysis-in-options-appraisal-of-economic-cases
[map]: https://www.theuncertaintyproject.org/tools/the-mediating-assessments-protocol
[anchoring]: https://pubsonline.informs.org/doi/full/10.1287/mnsc.2023.03238
[rice]: https://www.intercom.com/blog/rice-simple-prioritization-for-product-managers/
[ice]: https://growthmethod.com/ice-framework/
[dots]: https://guides.18f.org/methods/discover/dot-voting/
[cohesion]: https://journals.sagepub.com/doi/10.1177/1046496494252003

## Checking that an idea is new

- Search the problem, the feature, the user and the setting separately, in English and Malay, across app stores, [Google Patents][patents], MyIPO, Product Hunt, Crunchbase and Google Scholar ([Apple on search relevance][appsearch], [MyIPO search manual][myipo]). An empty search result is not proof that nothing exists.
- Hackathon winners report checking Google and Product Hunt for comparable apps, then adapting ([Gama et al.][gama]).
- MLH tells organisers to bar reskins of existing AI tools ([MLH rules guide][mlh]). No study measures how judges penalise "an existing app plus AI"; our rule comes from the organisers ([BRIEF, the challenge](/docs/BRIEF.md#the-challenge)).
- [What already exists](/docs/research/landscape/existing-solutions.md) lists the Malaysian products we found.

[patents]: https://support.google.com/faqs/answer/6390996?hl=en
[appsearch]: https://developer.apple.com/app-store/search/
[myipo]: https://iponline2u.myipo.gov.my/Manual/CP/FORM/CVN/Search_latest.pdf
[mlh]: https://guide.mlh.com/general-information/judging-and-submissions/rules-for-your-hackathon

## Tools

### Obsidian for a team

- **Cost:** Obsidian is free for team use. The commercial licence is US$50 per user a year and optional: "You are not required to pay for a commercial license" ([pricing][obs-pricing]).
- **Sync:** Obsidian Sync costs US$4 per user a month billed yearly, or US$5 monthly, and every collaborator needs their own subscription. Shared vaults suit "small teams up to 20 users" ([Sync for teams][obs-sync]).
- **Git instead of Sync:** the Obsidian Git plugin can commit, pull and push on a schedule and pull on startup. Its maintainer calls mobile support "very unstable" and doesn't recommend it on phones ([obsidian-git][obs-git]).
- **Links:** Obsidian writes wikilinks by default. Turn off **Settings → Files and links → Use [[Wikilinks]]** to get standard Markdown links ([Obsidian links help][obs-links]). Folder paths start at the vault root.
- **Leading-slash links:** GitHub resolves links that start with `/` from the repository root ([GitHub docs][gh-links]), which is how our docs link. A 2023 forum thread says Obsidian resolves them from the vault root ([forum thread][obs-forum]). So open the repository root as the vault, and test one link before relying on it.
- **Bases** turns notes with properties into tables, lists, cards or maps, with filters and formulas. It shipped as an early beta in version 1.9.0 on 21 May 2025 ([1.9.0 changelog][obs-190]); 1.10.0 added grouping, summaries and list views on 1 October 2025 ([1.10.0 changelog][obs-110]; [Bases help][obs-bases]). That makes a live idea-ranking table possible without plugins.
- **Properties** are YAML fields at the top of a note, with types such as text, number, date and list ([Properties help][obs-props]).
- **Canvas** saves boards as open JSON Canvas files ([Canvas help][obs-canvas]; [JSON Canvas spec][jsoncanvas]).
- **Plugins to treat with care:** Templater can run arbitrary JavaScript and system commands ([Templater][templater]). The Kanban plugin is looking for new maintainers ([Kanban][kanban]). Excalidraw's full drawing history needs an Obsidian Sync subscription ([Excalidraw plugin][excalidraw]).

[obs-pricing]: https://obsidian.md/pricing
[obs-sync]: https://obsidian.md/help/teams/sync
[obs-git]: https://github.com/Vinzent03/obsidian-git
[obs-links]: https://obsidian.md/help/links
[gh-links]: https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax#relative-links
[obs-forum]: https://forum.obsidian.md/t/absolute-link-path-has-higher-precedence-than-relative-path/69542
[obs-190]: https://obsidian.md/changelog/2025-05-21-desktop-v1.9.0
[obs-110]: https://obsidian.md/changelog/2025-10-01-desktop-v1.10.0/
[obs-bases]: https://obsidian.md/help/bases
[obs-props]: https://obsidian.md/help/properties
[obs-canvas]: https://obsidian.md/help/plugins/canvas
[jsoncanvas]: https://jsoncanvas.org/spec/1.0/
[templater]: https://github.com/SilentVoid13/Templater
[kanban]: https://github.com/mgmeyers/obsidian-kanban
[excalidraw]: https://github.com/zsviczian/obsidian-excalidraw-plugin

### Alternatives and education pricing

| Tool            | Free for students?                                                     | Source            |
| --------------- | ---------------------------------------------------------------------- | ----------------- |
| Miro            | Student plan free for 2 years, up to 10 members                        | [Miro][miro-edu]  |
| Figma / FigJam  | "100% free for students, educators and schools"                        | [Figma][figma]    |
| Notion          | Education plan free for one member with a school email, renewed yearly | [Notion][notion]  |
| Whimsical       | Free for students and teachers after applying                          | [Whimsical][whim] |
| Mural           | No education offer found; free plan has 3 editable murals              | [Mural][mural]    |
| GitHub Projects | Free plan; the Student Pack adds GitHub Pro                            | [GitHub][ghpack]  |
| Tally           | Unlimited forms and submissions on the free plan                       | [Tally][tally]    |

[miro-edu]: https://miro.com/education
[figma]: https://www.figma.com/education
[notion]: https://www.notion.com/help/notion-for-education
[whim]: https://whimsical.com/pricing
[mural]: https://www.mural.co/pricing
[ghpack]: https://education.github.com/pack
[tally]: https://tally.so/pricing

### AI research helpers

- **NotebookLM is now branded Gemini Notebook.** Its free Standard plan allows 100 notebooks per user and 50 sources per notebook ([plans page][gnotebook]). It answers questions from the sources you upload, which suits our `docs/research/` files.
- **Claude's free plan** includes up to five Projects; usage resets on a rolling five-hour window ([Claude pricing][claude]).
- **ChatGPT Projects** are listed for Plus but not Free ([ChatGPT pricing][chatgpt]).

[gnotebook]: https://support.google.com/notebooklm/answer/16213268
[claude]: https://claude.com/pricing
[chatgpt]: https://chatgpt.com/pricing

## Unverified and not found

- No validated rule exists for how long a hackathon team should spend ideating.
- No controlled study compares most named canvases and workshop formats; the time and jargon ratings above are our judgement.
- Obsidian's official help doesn't say whether links starting with `/` resolve; only a 2023 forum thread does.
- The Obsidian Git conflict-handling page returned 404, so its conflict workflow is unchecked.
- Perplexity blocked our requests, so its free tier is unchecked.

## See also

- [BRIEF](/docs/BRIEF.md), for the judging weights and the taken ideas
- [Past winners](/docs/research/competition/past-winners.md), for what scored well before
- [What already exists](/docs/research/landscape/existing-solutions.md), for the novelty check
