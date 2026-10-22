# Demo

Templates for the submission media. The pitch deck template is an HTML copy of the organisers' presentation template, so the deck can be built as code and printed to PDF. [`director-script.md`](/docs/demo/director-script.md) holds the video's narration and what each segment shows, and [`video.md`](/docs/demo/video.md) says how two agent sessions record the prototype and assemble the video.

Contents:

1.  [Pitch deck template](#pitch-deck-template)
1.  [Build the deck](#build-the-deck)
1.  [Example deck](#example-deck)
1.  [Sources](#sources)

## Pitch deck template

[`deck/pitch-deck-template.html`](/docs/demo/deck/pitch-deck-template.html) copies the organisers' template: the cover, the orange title slides and the white content slides with the Sime Darby Property logo. It keeps their 15 slides, their order and their prompt text. It leaves out their three guide slides: the deadline, what the deck should cover and the parking example.

The organisers asked teams to use every template slide and keep its flow. The [slide plan](/docs/CONTEXT.md#ten-slide-deck) says what goes on each slide.

## Build the deck

1.  Open [`deck/pitch-deck.html`](/docs/demo/deck/pitch-deck.html), the deck.
1.  Keep what the template fixes: the cover, the event slide, the orange title and Thank You backgrounds, the white content background with the Sime Darby Property logo top right, every template slide in its order, and each slide's heading as written ("7. Feasibility", "7. Implementation" and "7. Visual Concept" all keep the template's number 7).
1.  Change the rest freely, in the style of the [example deck](#example-deck): the layouts, the text and the pictures under each heading. Keep it short: one headline per slide, a few cards, and big numbers with a source line in monospace. Slide 3 carries the title and one-line claim beside the cover render; the Thank You slide carries the tagline and QR codes for the live demo and the code.
1.  Mark each item the video pushes in on with `data-focus="<id>"`; the [video's slide export](/docs/demo/video.md#slides) reads them, and the director script names them.
1.  Put supporting detail on appendix slides after "Thank You". Copy a content slide to make one.
1.  Pictures live in `deck/assets/`:
    - `screens/`: screenshots of the demo build, captured with Playwright at 2× scale and saved as WebP. Every app screenshot keeps the app's own Simulation label.
    - `art/`: white-clay 3D renders with one orange accent, in the example deck's style, made with Codex's image tool and saved as WebP. Slides with a full-height art panel lay `sdp-logo.webp` over it, at the logo's place on the template background, so the logo stays visible.
    - `team/`: the four team portraits.
    - `mark.svg`: the Safe Edge mark, copied from the web app.
1.  Open the file in Chrome or Edge. Move between slides with the arrow keys, the controls that show when you move the mouse, or a tap on either side of the screen on a phone. Press 1 to 9 to jump to slides 1 to 9 (0 is slide 10), and R to go back to the first slide. The deck reopens on the last slide shown.
1.  Write presenter notes in the `speaker-notes` block at the end of the file, one string per slide. Press N to show them.
1.  Print to PDF with margins set to "None". Each slide prints as one 1920 × 1080 page.

The template's own slides use Metropolis; without it, the page uses Montserrat from Google Fonts. Our slides use Geist and Geist Mono, as the example deck does.

## Example deck

[`example-pitch-deck.html`](/docs/demo/example-pitch-deck.html) is a finished 11-slide deck from an earlier hackathon, with its names replaced by placeholders. Use it as the reference for design and visual assets; our deck still keeps the organisers' slides and their order. Open it in Chrome or Edge; it uses the same controls as our deck.

Copy these from it:

- **One family of visual assets:** 3D renders of white clay objects with a single orange accent, on white. The same style serves as the large art panels and the small card icons.
- **A split layout:** text on the left, a large art panel or screenshot on the right.
- **Numbers as cards:** an icon, a big number, a one-line claim and its source in a monospace line underneath.
- **Steady chrome:** the logo top left and a "02 / 11 · Section" tag on every slide.
- **A dark closing slide** with QR codes for the code and the live demo.

Its images are embedded in the HTML as base64, so the file needs nothing else. Make our own renders in the same style; the orange accent already matches the organisers' template.

## Sources

- [Presentation template][template] (`SDP_University_Hackathon_TOWNSHIP-OF-TOMORROW-Template.pptx`), shared on the organisers' Telegram channel. The images in `deck/assets/` come from it, resized and converted to WebP.

[template]: https://docs.google.com/presentation/d/1mvGUwn8Oi6let8VaZUzvJkcEpGvYPcrE/edit
