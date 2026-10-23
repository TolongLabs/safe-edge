# Eleven-slide submission deck implementation plan

Apply the organiser flow confirmed by the team on 22 October: Team Information, then ten numbered pitch sections. The approved layout merges the old project title and team slides, and merges the old recognition and closing slides.

Contents:

1. [Goal and scope](#goal-and-scope)
1. [Implementation](#implementation)
1. [Verification](#verification)

## Goal and scope

Produce an 11-page submission deck in `docs/demo/deck/pitch-deck.html`. Keep the existing deck typography, orange template identity, factual claims, images and interactive controller. Preserve the six appendix slides in `docs/demo/deck/supporting-deck.html`. The app's design system applies to product screens; this presentation retains its organiser template and existing presentation style.

## Implementation

1. Merge old slides 3 and 4 into Team Information: project title and claim above a row of four members, with a smaller cover illustration. Retain the existing names and universities; add contact details only when supplied.
1. Retain old slides 5–13 in order. Correct Implementation to section 8 and Visual Concept to section 9. Match the confirmed title case for How It Works.
1. Merge old slides 14 and 15 into section 10: recognition argument and pilot ask on the left, working demo and repository QR links on the right, and a short thank-you. Keep the recognition argument within 100 words.
1. Remove the old two introductory template pages from the submission deck. Move appendix slides and their notes to the supporting deck. Align the main deck's notes, footer counts and persisted navigation version with the new structure.
1. Update the deck instructions, submission audit, brief/context and video slide references to the confirmed flow. Keep original organiser source transcriptions intact.

## Verification

Use the rendered deck in headless Chromium to verify the exact 11-section sequence, all images, text fit, keyboard navigation, notes and the closing QR destinations. Inspect the opening and closing slides at 1920 × 1080 and at a phone viewport. Export the submission PDF and check that it has 11 pages; export supporting evidence separately and check six pages. Run document formatting, context-link checks and repository lint. Report existing failures separately from this change.
