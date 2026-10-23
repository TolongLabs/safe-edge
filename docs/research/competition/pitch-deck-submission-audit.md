# Pitch deck submission audit

Updated on **22 October 2026**. The submission follows the **11-slide organiser flow confirmed by the user**: Team Information, then ten numbered pitch sections. The deck must be submitted as **PDF**, and the presentation video as an accessible **YouTube link**, under the organiser reminder supplied by the user. The reminder is [archived verbatim](/docs/sources/organiser-submission-reminder.md); its original post URL and publication time were not supplied.

Contents:

1.  [Original public-source rules](#original-public-source-rules)
1.  [User-supplied organiser clarifications](#user-supplied-organiser-clarifications)
1.  [Deck structure before and after correction](#deck-structure-before-and-after-correction)
1.  [Current submission form](#current-submission-form)
1.  [Evidence limits](#evidence-limits)

## Original public-source rules

The **9 October 2026** briefing's [slide 23 image](/docs/sources/opening-briefing/slides/23.webp) explicitly states: “Maximum 10 main slides. Appendix allowed for supporting details.” [Slides 24 and 25](/docs/sources/opening-briefing/slides.md#slide-24-what-your-pitch-deck-should-cover) repeat the ten-slide core limit and direct secondary detail to an appendix. No total-page cap or appendix-page cap appears in these slides. The [transcript at 28:46](/docs/sources/opening-briefing/transcript.md) notes uncertainty over the spoken word “minimum”; the visible slide is the stronger evidence.

The eight required topics are the problem, target user, solution, innovation, how it works, impact, feasibility and implementation. The briefing required the deck, a five-minute video or live demo, and a prototype/code/repository link by **11:59 PM, 23 October 2026**. Supporting documents were optional. [Sources: briefing slides 23 and 24](/docs/sources/opening-briefing/slides.md#slide-23-submission-deadline).

The live [organiser presentation template][template] was read through Google Drive on 22 October. Metadata identifies `SDP_University_Hackathon_TOWNSHIP-OF-TOMORROW-Template.pptx`, created on **13 October 2026** and last modified on **22 October 2026 at 09:36 UTC**. File timestamps do not establish when a rule changed. Its guide pages still repeat the ten-slide core limit. Its ten numbered content pages add a visual concept and an explanation of why the team should win, with a **100-word limit** for that answer. Five unnumbered template pages cover branding, event, project title, team and closing thanks. The template does not explicitly exempt all five from the main-slide limit. The original [HTML template](/docs/demo/deck/pitch-deck-template.html) remains a reference, including its repeated section numbers.

[template]: https://docs.google.com/presentation/d/1mvGUwn8Oi6let8VaZUzvJkcEpGvYPcrE/edit

## User-supplied organiser clarifications

On **22 October 2026**, the user confirmed the organiser's intended flow: **Team Information, then sections 1 to 10, 11 slides total**. Implementation is section 8, Visual Concept is 9, and Why Your Team Should Win is 10. This supersedes the team's earlier assumption that all five unnumbered template pages should remain in the submission deck. The [section plan](/docs/CONTEXT.md#eleven-slide-submission-deck) records the full order.

The user also supplied an [organiser submission reminder](/docs/sources/organiser-submission-reminder.md) on the same date. It specifies PDF-only decks, resubmission as PDF for teams that already uploaded PPT/PPTX, presentation videos on YouTube, optional written supporting materials as PDFs, and optional demos/prototypes/other digital materials as online links. Every link must open for judges without requesting permission. The deadline is **Friday, 23 October 2026, 11:59 PM Malaysia Time**.

For this submission, follow the later reminder's YouTube requirement and optional supporting-material categories rather than the briefing's alternative live-demo wording and required prototype/code component. The reminder does not change the briefing's five-minute video duration. The user confirmed **Hee Zi Jie (AlaskanTuna)** as team leader and instructed the team to omit email and phone details from the deck; those omissions are intentional, not an unresolved request.

## Deck structure before and after correction

The [deck merged in PR #251][merged-deck] had **21 slide sections**, counted from the HTML. It contained ten numbered content slides, five unnumbered template pages, and six appendix slides. The earlier audit correctly identified that the 21-page total alone did not prove a breach; the uncertain assumption was the exemption for all five unnumbered pages.

| Artifact                                                | Pages | Structure                                                                                   |
| ------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------- |
| PR #251 deck                                            | 21    | Five unnumbered template pages, ten numbered content pages, six appendix pages              |
| [Submission deck](/docs/demo/deck/pitch-deck.html)      | 11    | Team Information with project title, then sections 1 to 10; closing links inside section 10 |
| [Supporting deck](/docs/demo/deck/supporting-deck.html) | 6     | Evidence pages numbered 1 to 6, exported as a separate PDF                                  |

The corrected submission removes the separate branded cover and event title, merges the project title into Team Information, and merges the closing thanks and QR links into section 10. It does not append the supporting pages to the main PDF. The original source template is retained separately. [Implementation and export instructions](/docs/demo/README.md#build-the-deck).

[merged-deck]: https://github.com/TolongLabs/safe-edge/blob/e9ce36c701deb53e77ef22dd2fcefb85d77d127a/docs/demo/deck/pitch-deck.html

## Current submission form

The current [official submission page][submission] says there is one submission per team and the leader submits for everyone. Its embedded [Tally form][form] was inspected on 22 October without entering information or submitting anything.

| Field                | Current form requirement                     |
| -------------------- | -------------------------------------------- |
| Presentation slides  | Required; one uploaded file                  |
| Pitching video       | Required link; instruction specifies YouTube |
| Prototype and GitHub | Separate optional link fields                |
| Additional files     | Optional; at most three files                |

The deck-upload field defines no explicit page limit, accepted file extension or custom size limit. The user-supplied reminder supplies the **PDF-only** instruction that the public form configuration does not state. The form's required YouTube link and optional prototype/repository fields agree with the reminder. The absence of a custom file-size setting does not establish unlimited upload size. [Sources: official page][submission], [embedded form][form], [reminder](/docs/sources/organiser-submission-reminder.md).

[submission]: https://simedarbyproperty.com/universityhackathon/submission/
[form]: https://tally.so/embed/dWBpqV

## Evidence limits

The opening briefing, live template, official submission page and public form were independently checked. The **11-slide flow and reminder are user-supplied organiser communications**, not independently verified public waivers. No original post URL or publication timestamp was supplied for either clarification. Record 22 October as the date the user supplied them, not their publication date.

The current [official SDP terms][terms] do not define a numerical slide count or a cover-page exemption. The archived briefing and original template remain unchanged as historical source material; the team follows the later user-supplied clarification for the actual submission structure and formats.

[terms]: https://simedarbyproperty.com/universityhackathon/terms-and-conditions/
