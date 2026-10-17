# Pitch, evidence and feasibility

How to build the deck and video, gather evidence judges trust, measure impact, and answer feasibility and money questions in Malaysia, as of 2026-10-10. The organisers' own submission rules and slide list are in [BRIEF, what to submit](/docs/BRIEF.md#what-to-submit) and aren't repeated. Practitioner advice is labelled as such; two canonical guides older than 2024 are kept and dated.

Contents:

1.  [The deck](#the-deck)
1.  [The 5-minute video](#the-5-minute-video)
1.  [Evidence judges trust](#evidence-judges-trust)
1.  [Measuring impact](#measuring-impact)
1.  [Personal data in surveys and pilots](#personal-data-in-surveys-and-pilots)
1.  [Feasibility and approvals](#feasibility-and-approvals)
1.  [Who pays](#who-pays)
1.  [Preparing for questions](#preparing-for-questions)
1.  [Unverified and not found](#unverified-and-not-found)
1.  [See also](#see-also)

## The deck

- **Readers skim.** DocSend's 2025 data shows investors spend "less than 3 minutes reviewing pitch decks", and that companies "can no longer get by with a 'Minimum Viable PowerPoint'" ([DocSend, April 2025][docsend]). Judges reading 200 or more submissions likely behave the same; that is our read.
- **Ten slides is a known ceiling.** Guy Kawasaki's 10/20/30 rule: "ten slides, last no more than twenty minutes, and contain no font smaller than thirty points", because a person "cannot comprehend more than ten concepts in a meeting" ([Kawasaki, 2005][kawasaki]). Our cap is the same: 10 main slides, with an appendix allowed.
- **One problem through every slide.** The organisers' slide 25 walks one parking example through all eight areas ([BRIEF, pitch deck](/docs/BRIEF.md#pitch-deck)).
- **Say what it is first.** One judge writes that teams who "opened with context", including "a problem statement that took forty seconds to arrive at the product", lost ground, while those who scored well "opened with a plain declarative: this is a tool that does X for Y" ([judge's notes, 2026][devto]). Practitioner advice.

[docsend]: https://www.dropbox.com/resources/docsend-pitch-deck-research
[kawasaki]: https://guykawasaki.com/the_102030_rule/
[devto]: https://dev.to/kurbaitaev/what-judges-actually-score-notes-from-a-year-of-hackathon-judging-3p4l

## The 5-minute video

- **Show it working early.** A judge's bar: "You have to be able to show something working within about 90 seconds" ([JetBrains, June 2026][jetbrains]).
- **Make the demo about half the runtime.** AngelHack suggests the first 30 seconds for team, problem and a one-line solution, then the demo, then technology and next steps, and recording a backup ([AngelHack, August 2026][angelhack]). Organiser advice.
- **Make judges feel the problem.** "You need to get your audience of judges sharing your frustration with the problem" ([JetBrains][jetbrains]).
- **Show the solution, not the team.** Testers can be outsiders ([BRIEF, video and prototype](/docs/BRIEF.md#video-and-prototype)).
- **Don't overbuild.** The same judge warns that overbuilding guarantees "nothing in your demo works end to end", and that "a hackathon rewards the working demo, not the clean architecture nobody sees" ([JetBrains][jetbrains]).

[jetbrains]: https://blog.jetbrains.com/ai/2026/06/how-to-win-a-hackathon-notes-from-the-judging-table/
[angelhack]: https://angelhack.com/blog/10-tips-to-help-you-rock-your-next-hackathon-demo/

## Evidence judges trust

- **The organisers want validation with people, not AI output:** end users, investors and the people affected (Dr Lam, 24:09 to 24:26), and real data (Dina, 55:40) ([BRIEF, how it is judged](/docs/BRIEF.md#how-it-is-judged)).
- **Specific beats general.** "Specificity tells me whether you talked to anyone or guessed" ([judge's notes, 2026][devto]).
- **Malaysian rubrics ask for it outright:** IEEE Innovation Nation Malaysia wants a market or impact survey, and UMK's ITeLIC'25 scores "Evidence" ([Malaysian judges](/docs/research/competition/malaysian-judges.md#what-malaysian-rubrics-reward)).
- **How many test users:** in a qualitative usability study, five users per round find "almost as many usability problems" as many more, and rounds should repeat; quantitative studies need at least 20 ([Nielsen Norman Group, 2012][nng]). That sizes prototype tests; it doesn't prove demand. A canonical method, kept despite its age.
- **How to ask:** The Mom Test's rules are to talk about the person's life rather than your idea, ask about specific past events rather than opinions, and listen more than you talk ([book summary][momtest]).
- **Our read:** three rounds of five residents, each round changing the idea, fits our deadline. Report past behaviour as counts and quotes; five per round finds usability problems but doesn't prove demand.

[nng]: https://www.nngroup.com/articles/how-many-test-users/
[momtest]: https://mtlynch.io/book-reports/the-mom-test/

## Measuring impact

- **Answer the organisers' question:** what improved because of the idea, measured how, compared with what (Dr Lam, 08:26; [BRIEF, advice](/docs/BRIEF.md#advice-from-the-organisers)).
- **Carbon:** multiply saved electricity by Peninsular Malaysia's 2024 grid emission factor, 0.740 kg CO2e per kWh. The factor is provisional, and the Energy Commission warns it "may not reflect the GHG intensity of electricity unclaimed via REC or other contractual instruments" ([grid emission factor][gef]). The trend was 0.769 in 2022 and 0.760 in 2023.
- **Scope 2 rules may change:** the GHG Protocol's 2015 Scope 2 guidance is still in force; a public consultation on revising it closed on 31 January 2026 ([GHG Protocol][ghg-scope2]).
- **Use SDP's own baseline where possible.** SDP reports Scope 1 and 2 emissions, energy, water and waste by year ([Sime Darby Property](/docs/research/landscape/sime-darby-property.md#performance-against-the-targets)), so an idea can state its effect as a share of SDP's own numbers.

[gef]: https://myenergystats.st.gov.my/documents/d/guest/grid-emission-factor-gef-in-malaysia-2022-2024-provisional-
[ghg-scope2]: https://ghgprotocol.org/scope-2-guidance

## Personal data in surveys and pilots

- **The amended PDPA is fully in force.** The 2024 amendments started in three stages: 1 January, 1 April and 1 June 2025 ([commencement order][pub522]).
- **Penalties rose** for breaching the data protection principles, from RM300,000 or two years to RM1 million or three years ([Act A1727][a1727]).
- **New duties:** controllers and processors must appoint a data protection officer, and must notify the Commissioner of a breach "as soon as practicable" ([Act A1727][a1727]). The DPO duty applies above thresholds such as 20,000 data subjects or regular systematic monitoring ([DPO manual][dpo]).
- **Scope and research use:** the Act covers personal data used "in connection with commercial transactions", and allows processing "to prepare statistics or research" if the data isn't used for anything else ([Linklaters summary][linklaters]). Get written consent anyway; that is our recommendation.
- **Cameras:** CCTV images of identifiable people are personal data ([PDP FAQ][pdp-faq]).

[pub522]: https://www.pdp.gov.my/ppdpv1/wp-content/uploads/2024/12/PENETAPAN-TARIKH-PERMULAAN-KUAT-KUASA.pdf
[a1727]: https://www.pdp.gov.my/ppdpv1/wp-content/uploads/2024/11/Act-A1727.pdf
[dpo]: https://www.pdp.gov.my/ppdpv1/wp-content/uploads/2025/07/Manual_Pengguna_Pendaftaran_DPO_EN.pdf
[linklaters]: https://www.linklaters.com/en/insights/data-protected/data-protected---malaysia
[pdp-faq]: https://www.pdp.gov.my/ppdpv1/en/faq/

## Feasibility and approvals

- **Who must agree:** the local council for physical works, the JMB or management corporation for strata common property, and SDP for its own assets. Details are in [Malaysian judges, who must agree](/docs/research/competition/malaysian-judges.md#who-must-agree-to-a-township-pilot).
- **Strata law may change:** on 10 August 2026 the housing minister said amendments to the Strata Management Act 2013 are being considered, to strengthen JMB and management corporation accountability ([The Star][sma-review]).
- **Organisers' bar:** implementable within one or two years; estimate cost, effort and approvals, and check compliance and safety; a big pilot cost needs a big impact ([BRIEF, how it is judged](/docs/BRIEF.md#how-it-is-judged)).
- **Developers want proof and low upkeep:** they wait for proven outcomes, judge technology on return and building fit, and worry about maintenance after handover ([Malaysian judges, what developers need](/docs/research/competition/malaysian-judges.md#what-developers-need-before-a-pilot)).

[sma-review]: https://thestar.com.my/news/nation/2026/08/10/govt-mulls-amending-strata-management-act-to-strengthen-accountability-of-jmbs-mcs-says-nga

## Who pays

- **Maintenance fees are fragile.** In March 2025 Bernama reported unpaid strata maintenance fees at "worrying levels" ([Bernama][arrears]). **Our read:** a service paid from maintenance fees competes with arrears.
- **Pilots, then funding:** CapitaLand says "if innovators can prove that their solutions will work in our properties, the funding will follow" ([Past winners](/docs/research/competition/past-winners.md#developer-and-township-challenges-abroad)).
- **Third-party finance exists:** UEM Sunrise's The Beat 2.0 solar runs on a power purchase agreement with no developer capital ([Energy, HVAC and solar](/docs/research/landscape/energy-hvac-solar.md#what-peer-developers-do)); Solar ATAP allows zero-upfront leases ([Energy, HVAC and solar](/docs/research/landscape/energy-hvac-solar.md#home-solar-economics)); SDP raised green sukuk for its data centres ([Sime Darby Property](/docs/research/landscape/sime-darby-property.md#reporting-pressure-on-sdp)).
- **SDP can pay for what it runs:** malls, leisure assets and the Innovation Park sit on SDP's own books ([Sime Darby Property](/docs/research/landscape/sime-darby-property.md#who-runs-a-township-after-handover)).

[arrears]: https://www.bernama.com/en/news.php?id=2401051

## Preparing for questions

- **Likely questions:** who pays, what you actually built, and what breaks first at scale ([judge's notes, 2026][devto]); cost, approvals, maintenance and data security for Malaysian developers ([Malaysian judges](/docs/research/competition/malaysian-judges.md#what-developers-need-before-a-pilot)).
- **Privacy is often scored:** Philadelphia's public pilot programme scores "Attention to privacy and data security" ([City of Philadelphia][phila]).
- **Admit known weaknesses.** One judge reports that teams naming their own weak spots scored higher ([judge's notes, 2026][devto]). Practitioner observation.
- **Our read:** build an appendix with one slide per likely question, so the 5-minute Q&A on 14 November becomes pointing, not inventing.

[phila]: https://www.phila.gov/programs/pitch-and-pilot

## Unverified and not found

- No research measures how long judges spend per slide or how much of a video they watch.
- The often-quoted "85% of problems found by five users" isn't in NN/g's 2012 article, but its 2000 article says it: "After the first study with five participants has found 85% of the usability problems" ([NN/g, 2000](https://www.nngroup.com/articles/why-you-only-need-to-test-with-5-users/)). It covers usability problems, not demand.
- No 2024 or later Malaysian evidence of a green premium for certified homes or offices was found.
- How Malaysian proptech startups charge developers, and revenue-share models, weren't found.
- The PDPA's 72-hour breach limit comes from the 2025 guideline, seen only in a search excerpt; the Act says "as soon as practicable".

## See also

- [BRIEF, what to submit](/docs/BRIEF.md#what-to-submit), for the deck's eight areas
- [Malaysian judges](/docs/research/competition/malaysian-judges.md), for local rubrics and norms
- [Township problems](/docs/research/landscape/township-problems.md), for baseline numbers
