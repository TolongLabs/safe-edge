# Demo

Templates for the submission media. The pitch deck template is an HTML copy of the organisers' presentation template, so the deck can be built as code and printed to PDF.

Contents:

1.  [Pitch deck template](#pitch-deck-template)
1.  [Build the deck](#build-the-deck)
1.  [Sources](#sources)

## Pitch deck template

[`deck/pitch-deck-template.html`](/docs/demo/deck/pitch-deck-template.html) copies the organisers' template: the cover, the orange title slides and the white content slides with the Sime Darby Property logo. It keeps their 15 slides, their order and their prompt text. It leaves out their three guide slides: the deadline, what the deck should cover and the parking example.

The organisers asked teams to use every template slide and keep its flow. The [slide plan](/docs/CONTEXT.md#ten-slide-deck) says what goes on each slide.

## Build the deck

1.  Copy `deck/pitch-deck-template.html` to `deck/pitch-deck.html` in the same folder, so the `assets/` paths still work.
1.  Replace the prompt text on each slide with our content. Keep every slide and its order.
1.  Put supporting detail on appendix slides after "Thank You". Copy a content slide to make one.
1.  Open the file in Chrome or Edge. Move between slides with the arrow keys, the controls that show when you move the mouse, or a tap on either side of the screen on a phone. Press 1 to 9 to jump to slides 1 to 9 (0 is slide 10), and R to go back to the first slide. The deck reopens on the last slide shown.
1.  Write presenter notes in the `speaker-notes` block at the end of the file, one string per slide. Press N to show them.
1.  Print to PDF with margins set to "None". Each slide prints as one 1920 × 1080 page.

The template uses Metropolis and Century Gothic. Install both for an exact match. Without them, the page uses Montserrat and Questrial from Google Fonts.

## Sources

- [Presentation template][template] (`SDP_University_Hackathon_TOWNSHIP-OF-TOMORROW-Template.pptx`), shared on the organisers' Telegram channel. The images in `deck/assets/` come from it, resized and converted to WebP.

[template]: https://docs.google.com/presentation/d/1mvGUwn8Oi6let8VaZUzvJkcEpGvYPcrE/edit
