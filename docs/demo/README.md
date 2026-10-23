# Demo

Submission media and their source templates. The submission deck has 11 slides and prints to PDF; six supporting slides live in a separate deck. [`director-script.md`](/docs/demo/director-script.md) holds the video's narration and what each segment shows, and [`video.md`](/docs/demo/video.md) says how two agent sessions record the prototype and assemble the video.

The current submission PDF is [`deck/pitch-deck.pdf`](/docs/demo/deck/pitch-deck.pdf). Regenerate it from the HTML after changing the slides.

Contents:

1.  [Pitch deck template](#pitch-deck-template)
1.  [Build the deck](#build-the-deck)
1.  [Example deck](#example-deck)
1.  [Sources](#sources)

## Pitch deck template

[`deck/pitch-deck-template.html`](/docs/demo/deck/pitch-deck-template.html) copies the organisers' template: the cover, the orange title slides and the white content slides with the Sime Darby Property logo. It keeps their 15 slides, their order and their prompt text. It leaves out their three guide slides: the deadline, what the deck should cover and the parking example.

The user confirmed the organiser's flow on **22 October 2026**: Team Information, then ten numbered sections from The Problem to Why Your Team Should Win. The submission deck follows that 11-slide flow, merges the project title into Team Information and the closing links into section 10, and keeps supporting evidence separate. The [slide plan](/docs/CONTEXT.md#eleven-slide-submission-deck) lists each section. The original HTML template remains a reference; its extra cover pages and repeated section numbers are not the submission structure.

## Build the deck

1.  Open [`deck/pitch-deck.html`](/docs/demo/deck/pitch-deck.html), the deck.
1.  Keep the confirmed 11-slide flow, the orange identity and the white content background with the Sime Darby Property logo top right. Number the content sections 1 to 10: Implementation is 8, Visual Concept is 9 and Why Your Team Should Win is 10. Keep the original template unchanged as a source reference.
1.  Change the layouts, text and pictures under each heading in the style of the [example deck](#example-deck). Keep it short: one headline per slide, a few cards, and big numbers with a source line in monospace. Slide 1 combines the project title, one-line claim and team; Hee Zi Jie (AlaskanTuna) is the leader. Email and phone details are omitted at the user's instruction. Slide 11 carries the recognition argument, pilot ask and QR links for the demo and code.
1.  Mark each item the video pushes in on with `data-focus="<id>"`; the [video's slide export](/docs/demo/video.md#slides) reads them, and the director script names them.
1.  Keep the six evidence slides in [`deck/supporting-deck.html`](/docs/demo/deck/supporting-deck.html), numbered 1 to 6. Export them separately; the submission deck has no appended pages.
1.  Pictures live in `deck/assets/`:
    - `screens/`: screenshots of the demo build, captured with Playwright at 2× scale and saved as WebP. Every app screenshot keeps the app's own Simulation label.
    - `art/`: white-clay 3D renders with one orange accent, in the example deck's style, made with Codex's image tool and saved as WebP. Slides with a full-height art panel lay `sdp-logo.webp` over it, at the logo's place on the template background, so the logo stays visible.
    - `team/`: the four team portraits.
    - `mark.svg`: the Safe Edge mark, copied from the web app.
1.  Open the file in Chrome or Edge. Move between slides with the arrow keys, the controls that show when you move the mouse, or a tap on either side of the screen on a phone. Press 1 to 9 to jump to slides 1 to 9 (0 is slide 10), and R to go back to the first slide. The deck reopens on the last slide shown.
1.  Write presenter notes in the `speaker-notes` block at the end of the file, one string per slide. Press N to show them.
1.  Print each deck to PDF with margins set to "None". Check that the pitch PDF has **11 pages** and the supporting PDF has **six pages**. Each slide prints as one 1920 × 1080 page. Submit PDF files only; teams that already submitted PPT/PPTX must resubmit the deck as PDF. Written supporting materials also use PDF; submit demos, prototypes and other digital materials as online links accessible without a permission request. [Source: organiser reminder supplied by the user on 22 October](/docs/sources/organiser-submission-reminder.md).

The template's own slides use Metropolis; without it, the page uses Montserrat from Google Fonts. Our slides use Geist and Geist Mono, as the example deck does.

## Example deck

[`example-pitch-deck.html`](/docs/demo/example-pitch-deck.html) is a finished 11-slide deck from an earlier hackathon, with its names replaced by placeholders. Use it as the reference for design and visual assets; our submission follows the confirmed 11-slide organiser flow. Open it in Chrome or Edge; it uses the same controls as our deck.

Copy these from it:

- **One family of visual assets:** 3D renders of white clay objects with a single orange accent, on white. The same style serves as the large art panels and the small card icons.
- **A split layout:** text on the left, a large art panel or screenshot on the right.
- **Numbers as cards:** an icon, a big number, a one-line claim and its source in a monospace line underneath.
- **Steady chrome:** the logo top left and a "02 / 11 · Section" tag on every slide.
- **Closing QR cards** for the code and live demo, placed inside section 10 of our submission deck.

Its images are embedded in the HTML as base64, so the file needs nothing else. Make our own renders in the same style; the orange accent already matches the organisers' template.

## Sources

- [Presentation template][template] (`SDP_University_Hackathon_TOWNSHIP-OF-TOMORROW-Template.pptx`), shared on the organisers' Telegram channel. The images in `deck/assets/` come from it, resized and converted to WebP.
- [Submission reminder](/docs/sources/organiser-submission-reminder.md), supplied by the user on 22 October 2026; PDF and link requirements.
- The user-confirmed organiser flow, 22 October 2026; the [submission audit](/docs/research/competition/pitch-deck-submission-audit.md) distinguishes this clarification from independently checked public sources.

[template]: https://docs.google.com/presentation/d/1mvGUwn8Oi6let8VaZUzvJkcEpGvYPcrE/edit
