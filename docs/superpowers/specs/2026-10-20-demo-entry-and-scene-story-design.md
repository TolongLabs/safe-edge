# Demo entry and scene story design

How a judge gets from the landing page into the demo, and how the 3D scene explains the problem and the solution in its first ten seconds. It covers the landing page's ending, a new guest-only sign-in page, the scene's story mode, its controls strip and its loading screen.

Contents:

1.  [Intent](#intent)
1.  [Goals, non-goals and anti-goals](#goals-non-goals-and-anti-goals)
1.  [Constraints](#constraints)
1.  [Landing page](#landing-page)
1.  [Sign-in page](#sign-in-page)
1.  [Scene story mode](#scene-story-mode)
    1.  [First screen](#first-screen)
    1.  [While it plays](#while-it-plays)
    1.  [Details menu](#details-menu)
    1.  [Controls strip](#controls-strip)
    1.  [Loading screen](#loading-screen)
1.  [Deployment](#deployment)
1.  [Decided by the user](#decided-by-the-user)
1.  [Calls made by the designer](#calls-made-by-the-designer)
1.  [Left to the builder](#left-to-the-builder)
1.  [See also](#see-also)

## Intent

The user opened the live demo cold (20 October) and could not tell what was going on: the scene showed a scenario picker, a clock, weather, a rain reading, battery, an event log, speed, a slider, a footnote and a legend at once. Someone opening the scene should understand within ten seconds what Safe Edge solves: the problem on hand (a missing fence panel lets a child reach deep water) and the solution that follows (Safe Edge finds it, gets it fixed, and proves the fix).

The entry also feels unfinished: the landing page ends on a "Prove every edge." form that asks the visitor to pick a role, and the night footer never fills the screen.

## Goals, non-goals and anti-goals

**Goals**

- The scene's first screen states the problem and the solution in two sentences, on the spot where it happens.
- Playing the scene tells one story, Spot → Confirm → Fix → Prove, one line at a time.
- "Open the demo" leads to a sign-in page whose only working action is "Sign in as Guest".
- The visitor never picks a role; the device decides.
- Every screen in this design uses DESIGN.md's tokens and Atkinson Hyperlegible Next.

**Non-goals**

- Real authentication. There is none in this prototype.
- The Edge Inbox (#159) and the phone re-test (#82). Until they land, every guest opens the scene.
- The scene's full phone layout (#171), beyond not breaking at 390 px.
- Changing what the scenarios do, the core, or the planner.

**Anti-goals** (failure even if it works)

- A newcomer still needs the event log or the footnote to understand the story.
- The email and password fields look usable, or a click on them seems broken rather than closed.
- The scene feels alarmist: the problem is stated plainly, in calm colours, not with flashing red.
- Anything simulated shows without its "simulated" or SIMULATION label (PRD SIM-8 still holds).

## Constraints

- **Design system.** [DESIGN.md](/docs/DESIGN.md) wins for anything visual. The sign-in page and the story card are new compositions built from its tokens and components; no new Figma round.
- **Honesty.** The permanent SIMULATION badge stays. Captions describe simulated events as such where it matters.
- **Recording mode.** `scene.html?record` (#68) keeps working: the fixed camera path, steady frames and the recorder.
- **Frame budget.** The #67 Playwright test must still pass: the story card must not add per-frame work beyond today's panel.
- **Hosting.** The demo is the static Vercel build from `bun run build:demo-site` (#58): the landing page at `/`, the web app at `/demo/`.
- **Tests.** End-to-end in Playwright, no unit tests (project conventions).

## Landing page

`apps/site/index.html`.

- Remove the "Prove every edge." section (`#start`) and its form.
- "Open the demo" links to `/sign-in`: in the top bar, and in the night footer, which now ends the page with that button (the "Prove every edge." section was the page's last call to action).
- At the end of the scroll the night footer fills the whole viewport: no part of the section above it shows. Today the fixed footer is revealed under the lifting page but is shorter than the screen.
- Reduced motion keeps the same content, without the reveal.

## Sign-in page

A second page of the landing site, served at `/sign-in`.

- **Two panes.** Left: the brand pane in `bg-rail`, with the Step edge logo, "Every water edge, closed and proven." and the dawn lake art from the landing hero. Right: the form on `bg-surface`. Below 768 px the brand pane shrinks to a band above the form.
- **Email and password** are shown but closed: disabled inputs, `cursor: not-allowed` on hover, and a line under them saying accounts open after the pilot. A disabled "Sign in" button is not shown; there is nothing to submit.
- **Sign in as Guest** is the one primary button. It chooses the view from the device, without asking: a phone (coarse pointer or a viewport under 768 px) opens the reviewer's view, anything else the manager's. Until #159 and #82 land, both open the scene at `/demo/`, passing the view as `?as=manager` or `?as=reviewer` so those screens can read it later.
- A back link to the landing page.

## Scene story mode

`apps/web` scene page. Today's scenario panel, legend and controls toggle give way to a story card, a details menu and a controls strip.

### First screen

- The camera opens on fence panel 4 by the playground path (S1's story segment), with the gap visible.
- One card, bottom left: the place ("Central Park Lake, by the playground"), the problem as a headline ("A fence panel is missing. A child on the path can reach deep water."), and the solution in one line ("Safe Edge finds gaps like this, gets them fixed, and proves the fix before the edge counts as safe.").
- Two buttons: **Play the story**, with its length, and **Look around**, which hides the card and leaves the camera free with the story at its start.

### While it plays

- S1, S2 and S3 play as one continuous story in four chapters: **Spot** (the patrol and the flag), **Confirm** (the manager confirms and interim protection goes up), **Fix** (choosing the fix that closes every route, and the repair), **Prove** (a different person's re-test issues the pass).
- A card at the bottom centre shows the chapter steps, the time, one plain caption for the current moment, Pause, a progress line across the whole story, and a three-colour key: safe, not safe, unknown.
- Captions are short, written for a newcomer, one sentence each; they replace the event notes in this view.
- **Pacing.** Each caption stays on screen for at least 3 seconds: the story holds its clock on a captioned moment until the caption has had its time. Ground playback at two hours a second would otherwise flash S2's and S3's steps past in under a second.
- The camera follows the story: the gap, the drone in flight, then the fence when it is repaired.
- Map labels show only while they matter to the current caption.
- The story ends on the proven pass ("Safety pass issued, valid to …") with **Play again** and **Look around**.
- After **Look around**, a small **Play the story** button stays in the card's place to bring it back.
- Clicking a segment opens its card top left, clear of the story card and the controls strip.

### Details menu

A small menu, top right, closed by default. It holds what the old panel showed: the scenario picker for S1 to S6 (S4 to S6 play there, outside the story), the weather and the real JPS rainfall reading with its time, the drone's battery and phase, the full event log, speed, the time slider, the full legend, and the footnote about the simulation.

Deep links still work: `?scenario=<id>` opens that scenario from the details menu instead of the story, and `?segment=<id>[&distance=<m>]` opens with the camera on that segment and its card open.

**Recording mode** (`?record`) records the story, S1 to S3, with the story card on screen and the details menu and controls strip hidden. Its Record button sits in the story card in place of Play. `?record&scenario=<id>` still records one scenario.

### Controls strip

- A small strip, bottom left: "LMB rotate · MMB zoom · RMB pan", in muted text on a translucent surface.
- The orbit/map toggle goes away; the mouse buttons always do the same thing (left rotates, middle zooms, right pans; the wheel also zooms).
- On a touch screen the strip reads "Drag to rotate · Pinch to zoom · Two fingers to pan".
- Hidden in recording mode, where the camera is fixed.

### Loading screen

- Replaces the raw "Loading the Elmina map…" text: a centred card on `bg-canvas` with the logo, "Loading the Elmina simulation", and a progress bar that follows the layers and the seed as they arrive.
- Errors use the same card with the message and a Retry button.

## Deployment

After the work merges, redeploy the Vercel project `safe-edge` with `bun run build:demo-site`, adding a route so `/sign-in` serves the sign-in page. The live link stays <https://safe-edge-two.vercel.app>.

## Decided by the user

- The scene must convey the problem and the solution in its first ten seconds.
- The story-first scene in the mockup (first screen card, one-line playing card, details menu, controls strip) "makes it easier to understand".
- No working auth: email and password are for show, with a not-allowed cursor; only "Sign in as Guest" works.
- The role choice is implicit and decided internally.
- The "Prove every edge." section goes; "Open the demo" leads to `/sign-in`.
- The footer fills the whole page at the end of the scroll.
- The loading screen follows the design system.
- The controls hint is a small HUD, bottom left, naming LMB, MMB and RMB.
- No native subagents; workers only from the user's pool, never for design work, asked before each dispatch.

## Calls made by the designer

- The story is S1 → S2 → S3 as four chapters; S4 to S6 stay in the details menu.
- The device rule: a coarse pointer or a viewport under 768 px counts as a phone.
- `?as=manager|reviewer` is passed on now so the Inbox and the phone re-test can read it later.
- Mouse mapping follows OrbitControls' defaults (left rotate, middle dolly, right pan); map controls go away.
- The touch wording of the controls strip.
- The sign-in brand pane reuses the landing hero's dawn art.
- The story length shown on the button is measured from the build, not fixed.
- No Figma round, as DESIGN.md covers new compositions.
- Captions hold for at least 3 seconds each.
- Recording mode records the story by default, with Record in the story card.
- Deep links (`?scenario=`, `?segment=`) keep working; the segment card moves top left.
- After Look around, a small Play the story button brings the story back.

## Left to the builder

- How the player plays S1 to S3 as one visible run (today it plays a scenario's predecessors silently), and where the captions live (a short field on the scenario events, or a story script in the web app).
- The camera moves between chapters, within recording mode's fixed-path rules.
- The exact caption wording, kept to one sentence each and checked against PRODUCT.md's voice.
- How the footer reaches full height without breaking the reveal.
- The Playwright coverage: the landing-to-sign-in-to-scene path, the guest's view choice on desktop and phone, the story's four chapters, and the frame-time test still passing.

## See also

- [DESIGN.md](/docs/DESIGN.md)
- [PRODUCT.md](/docs/PRODUCT.md)
- [PRD: simulation](/docs/PRD.md#simulation)
- Mockups: `.superpowers/brainstorm/` (scene-story.html, sign-in.html)
