# Demo entry and scene story implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A judge goes from the landing page through a guest-only sign-in into a scene that explains the problem and the solution in its first ten seconds.

**Architecture:** The landing site (`apps/site`) loses its last section, gains a full-screen night footer with the demo button, and gets a second page, `/sign-in`. The scene page (`apps/web`) replaces its scenario panel with a story card driven by one player that plays S1 to S3 visibly and holds on captioned events; the old panel's content moves into a details menu. Browser tests run against the same prebuilt site that deploys to Vercel.

**Tech Stack:** Bun workspaces, Vite 8, React 19, Three.js 0.186, GSAP, Playwright 1.64.1, Vercel Build Output API v3.

**Spec:** [docs/superpowers/specs/2026-10-20-demo-entry-and-scene-story-design.md](/docs/superpowers/specs/2026-10-20-demo-entry-and-scene-story-design.md)

## Global Constraints

- Visuals follow [DESIGN.md](/docs/DESIGN.md): its colour tokens, Atkinson Hyperlegible Next, radii 4/8/12/16, solid surfaces.
- The permanent SIMULATION badge stays; every simulated marker keeps a chip (PRD SIM-8).
- `scene.html?record` keeps its fixed camera, steady frames and recorder (#68).
- `e2e/scene-frame-time.e2e.ts` keeps passing on a GPU (#67).
- Tests are end-to-end (Playwright) or integration (`bun test`), never unit tests.
- A change is done when `bun run lint`, `bun run typecheck`, `bun run check:browser` and `bun run test` pass.
- Commit headers follow commitlint: at most 50 characters.
- Fail loudly: no catch-all fallbacks.
- Copy is plain, calm and short; no alarm colours beyond the pass-state tokens.

## Review Focus

- **A narrow phone (390 px) on the sign-in page and the scene.** The two panes stack and nothing scrolls sideways. Owned by Task 3 and Task 5.
- **Leaving the tab during the story.** The caption hold uses a timer: a hidden tab must not jump chapters or replay a caption on return. Owned by Task 5.
- **Pausing during a caption hold.** A user's Pause during the 3-second hold must stay paused; the timer must not resume it. Owned by Task 5.
- **The scene's data failing to load.** The loading card turns into an error card with Retry, and Retry loads again. Owned by Task 4.
- **Rewinding the story** (Play again, or the time slider in details). Captions, markers and chapter state start over and do not keep later chapters' labels. Owned by Task 5.

---

### Task 1: Browser tests run against the prebuilt demo site

**Files:**

- Create: `scripts/serve-demo-site.ts`
- Modify: `playwright.config.ts`
- Modify: `e2e/scene-frame-time.e2e.ts`, `e2e/recording.e2e.ts`
- Create: `e2e/demo-site.e2e.ts`

**Interfaces:**

- Consumes: `bun run build:demo-site <dir>` from #58 (`scripts/build-demo-site.ts`), which writes `<dir>/.vercel/output/{static,config.json}`.
- Produces: Playwright's `baseURL` is the demo site root: the landing page is `/`, the scene is `demo/scene.html`. Later tasks' tests use these paths.

- [ ] **Step 1: Write the failing test** `e2e/demo-site.e2e.ts`: `test('the demo site serves the landing page and the scene', …)` that opens `/` and expects `page` to have the title `Safe Edge · every water edge, closed and proven`, then opens `demo/` and expects a `canvas` within 90 s. It must run headless (no GPU skip).
- [ ] **Step 2: Run it to make sure it fails.** Run: `env -u WSL_DISTRO_NAME CI=1 bunx playwright test e2e/demo-site.e2e.ts`. Expected: FAIL (the preview serves only `apps/web`, so `/` is the web placeholder).
- [ ] **Step 3: Implement `scripts/serve-demo-site.ts <dir> [port]`**, serving `<dir>/.vercel/output/static` on `127.0.0.1` (default port 4173) and applying `config.json`'s `routes` in order: a route with `src`/`dest` rewrites the path when its regex matches, `{ handle: 'filesystem' }` serves the file, a path ending in `/` serves its `index.html`, anything else is 404. Change `playwright.config.ts`'s `webServer.command` to build into `join(tmpdir(), 'safe-edge-demo-site')` with `bun run build:demo-site` and then run the server. Point `url` at `http://127.0.0.1:4173/`. Keep `reuseExistingServer: false` and every other option. Change the two existing tests' paths from `scene.html?…` to `demo/scene.html?…`.
- [ ] **Step 4: Run the tests.** Run: `env -u WSL_DISTRO_NAME CI=1 bunx playwright test`. Expected: `demo-site` passes, the other three skip. On the WSL GPU (`MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA DISPLAY=:0 bun run e2e`), all four pass.
- [ ] **Step 5: Commit** (`test: run browser tests on the demo site`), adding `.superpowers/` to `.gitignore` in the same commit.

### Task 2: The landing page ends on a full-screen night footer

**Files:**

- Modify: `apps/site/index.html` (remove `section.start`, lines ~498-518; top-bar button at line 96; footer at line ~522)
- Modify: `apps/site/src/main.ts:125-145` (footer fit and reveal), `apps/site/src/main.ts:~291` (night-art scroll trigger)
- Modify: `apps/site/src/style.css` (`.start` and `.dialog*` rules removed; `.footer`, `.night`, `.has-reveal` rules)
- Create: `e2e/landing.e2e.ts`

**Interfaces:**

- Produces: every "Open the demo" link has `href="/sign-in"`; the footer holds one of them.

- [ ] **Step 1: Write the failing tests** in `e2e/landing.e2e.ts`, run at 1440 × 900 and at 390 × 844 (`isMobile`):
  - `there is no "Prove every edge." section`: `page.getByRole('heading', { name: 'Prove every edge.' })` has count 0.
  - `every "Open the demo" link goes to /sign-in`: all `getByRole('link', { name: 'Open the demo' })` have `href` `/sign-in`, there are 2, and one is inside `footer`.
  - `the end of the scroll shows only the footer`: after `window.scrollTo(0, document.documentElement.scrollHeight)` and a 1 s settle, `footer.getBoundingClientRect()` has `top <= 1` and `bottom >= innerHeight - 1`, and `document.elementFromPoint(innerWidth / 2, 10)` is inside `footer`.
- [ ] **Step 2: Run them to make sure they fail.** Run: `env -u WSL_DISTRO_NAME CI=1 bunx playwright test e2e/landing.e2e.ts`. Expected: FAIL on all three.
- [ ] **Step 3: Implement.**
  - Remove `section.start` and its styles.
  - Point the top-bar button at `/sign-in`, and add an "Open the demo" `a.button.button--ink` to `.footer-in`.
  - Give `.footer` `min-height: 100svh`, as a column whose `.night` grows to fill the space above `.footer-in`.
  - Make the reveal (`has-reveal`) apply at 900 px and wider whatever the footer's height, with `--footer-h` still set from `offsetHeight`.
  - Key `data-shown` and the night-art scroll trigger on `main`'s bottom instead of `.start`.
  - Round the bottom corners of `main`'s last child in reveal mode.
  - Under 900 px the footer flows after `main`, still a full screen tall.
- [ ] **Step 4: Run the tests.** Same command. Expected: PASS at both sizes. Also scroll through once in reduced motion (`page.emulateMedia({ reducedMotion: 'reduce' })`) to check the content still reaches the footer.
- [ ] **Step 5: Commit** (`feat(site): end the landing page on the footer`).

### Task 3: A guest-only sign-in page

**Files:**

- Create: `apps/site/sign-in.html`, `apps/site/src/sign-in.ts`, `apps/site/src/sign-in.css`, `apps/site/public/dawn.svg`
- Modify: `apps/site/vite.config.ts` (two inputs: `index.html`, `sign-in.html`)
- Modify: `scripts/build-demo-site.ts` (route `^/sign-in/?$` → `/sign-in.html`, before `/demo/`'s route)
- Create: `e2e/sign-in.e2e.ts`

**Interfaces:**

- Consumes: Task 2's `/sign-in` links. DESIGN.md tokens as CSS custom properties, like `style.css`'s.
- Produces: Guest navigates to `/demo/?as=manager` or `/demo/?as=reviewer`. The scene ignores `as` for now; #159 and #82 read it later.

- [ ] **Step 1: Write the failing tests** in `e2e/sign-in.e2e.ts`:
  - `the landing page's button opens /sign-in`: click the top bar's "Open the demo" and expect the URL to end in `/sign-in` and a heading "Sign in".
  - `email and password are shown but closed`: `getByLabel('Email')` and `getByLabel('Password')` are disabled, each has computed `cursor` `not-allowed`, and the text `Accounts open after the pilot.` is visible. There is no button named "Sign in".
  - `a guest on a computer opens the manager's view`: at 1440 × 900, click "Sign in as Guest" and expect the URL `/demo/?as=manager`, then a `canvas`.
  - `a guest on a phone opens the reviewer's view`: at 390 × 844 with `isMobile` and `hasTouch`, the same click gives `/demo/?as=reviewer`.
  - `the two panes stack on a phone`: at 390 px, `document.documentElement.scrollWidth` is 390, and the brand pane's bottom is above the form's top.
- [ ] **Step 2: Run them to make sure they fail.** Run: `env -u WSL_DISTRO_NAME CI=1 bunx playwright test e2e/sign-in.e2e.ts`. Expected: FAIL (404 on `/sign-in`).
- [ ] **Step 3: Implement the page**, two panes per the spec:
  - **Brand pane:** `bg-rail`, the `mark-rail.svg` logo with "SAFE EDGE", "Every water edge, closed and proven.", "Elmina · simulated data", and `dawn.svg`. That SVG is a static copy of the hero's dawn layers, without the animation.
  - **Form pane:** `bg-surface`, with "Sign in", disabled Email and Password inputs, "Accounts open after the pilot.", a divider, and the primary button "Sign in as Guest".
  - **The view choice**, in `src/sign-in.ts`: `const phone = matchMedia('(pointer: coarse)').matches || innerWidth < 768`, then `location.assign(`/demo/?as=${phone ? 'reviewer' : 'manager'}`)`.
  - **Back link:** "← Back to Safe Edge", to `/`.
  - Below 768 px the brand pane becomes a band above the form.
- [ ] **Step 4: Run the tests.** Same command. Expected: PASS.
- [ ] **Step 5: Commit** (`feat(site): add the guest sign-in page`).

### Task 4: Loading card, controls strip and segment card

**Files:**

- Create: `apps/web/src/LoadingCard.tsx`, `apps/web/src/ControlsHint.tsx`
- Modify: `apps/web/src/ElminaScene.tsx` (status rendering, the orbit/map toggle at lines ~138-142 removed, the controls strip added)
- Modify: `apps/web/src/SegmentCard.tsx:75-77` (top left: `top: 56`, `left: 12`)
- Create: `e2e/scene-shell.e2e.ts`

**Interfaces:**

- Produces:
  - `LoadingCard({ state }: { state: { kind: 'loading'; loaded: number; total: number } | { kind: 'error'; message: string; onRetry: () => void } })`.
  - `ControlsHint({ hidden }: { hidden: boolean })`.
  - `ElminaScene`'s load reports progress: `loaded` counts each of the four layers and the seed as it arrives, out of a `total` of 5.

- [ ] **Step 1: Write the failing tests** in `e2e/scene-shell.e2e.ts`:
  - `the scene loads behind a branded card`: on `demo/scene.html`, `getByRole('status')` contains "Loading the Elmina simulation" and a `progressbar`. It is gone once a `canvas` shows.
  - `a failed load says so and retries`: `page.route('**/seed-*.json', r => r.abort())` once, expect `getByRole('alert')` with "did not load" and a button "Retry". Remove the route, click Retry, and expect the `canvas`.
  - `the controls strip replaces the toggle`: there is no button matching `/controls: switch to/`, and the text `LMB rotate · MMB zoom · RMB pan` is visible near the bottom left (its box's `left < 40` and `bottom > innerHeight - 40`).
  - `a touch screen gets touch wording`: with `hasTouch` and `isMobile`, the text `Drag to rotate · Pinch to zoom · Two fingers to pan` is visible.
  - `recording mode hides the strip`: on `demo/scene.html?record`, neither wording shows.
- [ ] **Step 2: Run them to make sure they fail.** Run: `env -u WSL_DISTRO_NAME CI=1 bunx playwright test e2e/scene-shell.e2e.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **LoadingCard:** a centred card on `bg-canvas`, with the logo, "Loading the Elmina simulation" and a `<progress>`, carrying `role="status"`. The error variant uses `role="alert"`, says "The Elmina simulation did not load: …", and has Retry, which re-runs the load.
  - **ControlsHint:** the touch wording when `matchMedia('(pointer: coarse)')` matches, otherwise the mouse wording. It sits bottom left in 12 px muted text on `rgb(251 252 251 / 0.85)` with radius 8.
  - **ElminaScene:** keeps orbit controls only. Delete the toggle and its `mode` state, and leave `setControlMode` in the scene package unused.
- [ ] **Step 4: Run the tests.** Same command. Expected: PASS.
- [ ] **Step 5: Commit** (`feat(scene): brand the loading card and controls`).

### Task 5: The scene tells the story

**Files:**

- Modify: `packages/sdk/src/scenario.ts` (`ScenarioEvent.story`, `StoryChapter`), `packages/sdk/src/player.ts` (`from`, `holdOnStory`, `start`, `end`), `packages/sdk/src/index.ts`
- Modify: `data/elmina/scenarios/s1-after-rain-patrol.json`, `s2-choosing-a-fix.json`, `s3-proving-the-fix.json` (add `story` to the events listed below)
- Modify: `packages/scene/src/scene.ts` (`focus`, the `setMarkers` option), `packages/scene/src/markers.ts` (compact chips)
- Create: `apps/web/src/usePlayback.ts`, `apps/web/src/StoryCard.tsx`, `apps/web/src/DetailsMenu.tsx`
- Modify: `apps/web/src/ScenarioPanel.tsx` → its sync moves into `usePlayback.ts`; its controls, event log, weather and footnote become `DetailsMenu.tsx`; delete the file once empty
- Modify: `apps/web/src/ElminaScene.tsx`, `apps/web/src/Recorder.tsx`, `apps/web/src/recording.ts`, `apps/web/src/Legend.tsx` (moves into the details menu)
- Modify: `packages/sdk/test/scenarios.test.ts`
- Create: `e2e/story.e2e.ts`
- Modify: `e2e/scene-frame-time.e2e.ts`, `e2e/recording.e2e.ts` (paths and controls)

**Interfaces:**

- Consumes: Task 4's shell. The existing `createScenarioPlayer`, `ElminaScene`, `recordingShot` and `steadyFrames`.
- Produces:
  - `export type StoryChapter = 'spot' | 'confirm' | 'fix' | 'prove'`, and `ScenarioEvent.story?: { chapter: StoryChapter; caption: string }` (caption 1 to 120 characters).
  - `ScenarioPlayerOptions.from?: Scenario['id']`: an earlier scenario in the chain to play visibly. Its start becomes the player's start. The ones before it still play silently.
  - `ScenarioPlayerOptions.holdOnStory?: boolean`: `play()` stops right after running an event with `story` and notifies; `play()` again goes on.
  - `ScenarioPlayer.start: string` and `ScenarioPlayer.end: string`: the span played.
  - `ElminaScene.focus(segmentId: string, options?: { distanceM?: number }): void`. It moves the camera as `select(…, { focus: true })` does, without the outline; `select` uses it.
  - `ElminaScene.setMarkers(markers: SceneMarkers, options?: { current?: ReadonlySet<string> }): void`. A marker whose `id` is not in `current` wears a compact chip reading "simulated"; without `current`, every chip is full.
  - `labelChip(text: string, options?: { compact?: boolean }): CSS2DObject`.
  - `usePlayback(scene: ElminaScene, mode: PlaybackMode, recording: boolean)` returns `{ player, flight, day, captioned, current }`, where:
    - `PlaybackMode = { kind: 'story' } | { kind: 'scenario'; id: Scenario['id'] }`;
    - `captioned: Played[]` are the story events played so far;
    - `current: Played | null` is the caption on screen.
  - `recordingShot(span: { start: string; end: string }, now: string, airborne: boolean): CameraShot`, which now takes the span, not a scenario.

- [ ] **Step 1: Write the failing SDK tests** in `packages/sdk/test/scenarios.test.ts`, `describe('the story plays S1 to S3', …)`:
  - `the story starts at S1 and ends at S3 with every captioned event played`: `createScenarioPlayer({ …, id: 's3', from: 's1', frames: () => () => {} })`. Expect:
    - `start` to be `'2026-10-20T21:30:00.000Z'` and `end` to be `'2026-10-22T08:30:00.000Z'`;
    - after `seek(end)`, the chapters of the played events with `story`, in order, deduplicated, to equal `['spot', 'confirm', 'fix', 'prove']`;
    - the S1 segment's pass to be `valid` with `validTo` set.
  - `holdOnStory stops on each caption`: play with a controlled frame driver delivering 1,000 ms frames. Expect the player to stop with `playing === false` after each captioned event, `now` to equal that event's `at`, and the number of stops to equal the number of captioned events (12).
- [ ] **Step 2: Run them to make sure they fail.** Run: `cd packages/sdk && bun test test/scenarios.test.ts -t "the story"`. Expected: FAIL.
- [ ] **Step 3: Implement the SDK and data.**
  - In `player.ts`: with `from`, the timeline is the visible scenarios' events merged in time order, from `from` through `id`. The `advance` stop rule extends #67's `untilTakeoff` to `untilStory`. `play()` from the end seeks to `start`, not `scenario.start`.
  - Add `story` to these events (`at` → chapter: caption):
    - S1 `21:30:00` → spot: "Overnight storm: 40 mm of rain in an hour. Safe Edge plans a drone check of the lake edge."
    - S1 `22:36:30` → spot: "A dry morning. The drone takes off from the roof dock to photograph each edge."
    - S1 `22:38:40` → spot: "A jogger walks into a photo. The privacy gate deletes it, and the drone takes the view again."
    - S1 `22:41:00` → spot: "Glare hides a ring buoy. Safe Edge marks it unknown and sends someone on foot instead of guessing."
    - S1 `22:42:00` → spot: "The drone's photo shows panel 4 is gone. This stretch no longer counts as safe."
    - S1 `23:05:00` → confirm: "The park manager compares the photos and confirms it needs a fix."
    - S1 `23:40:00` → confirm: "The crew puts up a temporary barrier at the gap the same morning."
    - S2 `23:56:00` → fix: "Fix A would replace panel 4, but a child could still walk around the fence end."
    - S2 `23:59:00` → fix: "Fix B replaces the panel and extends the fence, closing both ways to the water."
    - S2 `00:10:00` → fix: "The engineer approves fix B, and the work order goes to the installer."
    - S3 `07:40:00` → fix: "The installer finishes the repair, but cannot sign it off themselves."
    - S3 `08:05:00` → prove: "Priya Nair, who did not install it, re-tests it on site. Both ways to the water are closed."
- [ ] **Step 4: Run the SDK tests.** Run: `cd packages/sdk && bun test`. Expected: PASS, with S1 to S6's existing tests unchanged.
- [ ] **Step 5: Write the failing browser tests** in `e2e/story.e2e.ts` (headless, `demo/`):
  - `the first screen states the problem and the solution`: the headline "A fence panel is missing. A child on the path can reach deep water." is visible, along with the line "Safe Edge finds gaps like this, gets them fixed, and proves the fix before the edge counts as safe." and the buttons `Play the story` and `Look around`.
  - `the story reaches Prove and ends on the pass`: click Play. Within 240 s, expect the step "4 Prove" to be current (`aria-current="step"`) and the text `Safety pass issued, valid to 22 Oct 2027`, with buttons `Play again` and `Look around`.
  - `captions hold for at least 3 s`: record the times the caption text changes during the first 60 s. Every gap must be at least 2,900 ms.
  - `Pause during a hold stays paused`: when a caption appears, click Pause, wait 5 s, and expect the caption and the clock unchanged.
  - `Look around hides the card and brings it back`: after Look around, the headline is hidden and a `Play the story` button shows. Clicking it shows the story card.
  - `details hold the old controls`: open `Details`. Expect the scenario picker with S1 to S6, the time slider, the speed select, the real rainfall reading and the legend.
  - `a scenario link opens details, not the story`: `demo/scene.html?scenario=s4` shows the details menu open on S4 and no story card.
  - `Play again starts over`: at the end, click Play again. Expect "1 Spot" to be current and no chips from later chapters.
  - `a hidden tab holds the caption`: when a caption appears, run `Object.defineProperty(document, 'hidden', { value: true, configurable: true })` and dispatch `visibilitychange`. Wait 5 s and expect the same caption. Set `hidden` back to `false`, dispatch again, and expect the next caption no sooner than 2,900 ms later.
  - `the story fits a phone`: at 390 × 844 (`isMobile`, `hasTouch`), `document.documentElement.scrollWidth` is 390, and the story card's box lies inside the viewport.
- [ ] **Step 6: Run them to make sure they fail.** Run: `env -u WSL_DISTRO_NAME CI=1 bunx playwright test e2e/story.e2e.ts`. Expected: FAIL.
- [ ] **Step 7: Implement the web side.**
  - **`usePlayback`:** owns the player and the scene sync that `ScenarioPanel` did, including #67's change-only list reads and #68's camera shot.
    - Story mode is `createScenarioPlayer({ id: 's3', from: 's1', holdOnStory: true, speed: 8 })`.
    - When the player stops on a captioned event and the user has not paused, it resumes 3,000 ms later. The timer counts visible time only: it waits while `document.hidden`, and is cleared on Pause, rewind and unmount.
    - `current` is the latest captioned event. Markers that appeared since it are passed as `setMarkers`' `current`.
    - The camera opens with `focus(elminaSeed.story.s1.segmentId, { distanceM: 170 })`, follows the drone in flight as today, and focuses back on the segment when a `confirm`, `fix` or `prove` caption shows.
  - **`StoryCard`** has three states: first screen (bottom left), playing (bottom centre: chapter steps with `aria-current`, the time, the caption, Pause/Play, progress across `start`→`end`, the three-colour key), and end.
    - The end state reads "Safety pass issued, valid to <date>", taken from `listPasses` for the story segment.
    - The Play button reads "Play the story · about N s". Set N from one measured run, recorded in a constant with a comment.
    - In `?record`, the card shows Recorder's Record in place of Play.
  - **`DetailsMenu`:** a closed menu, top right. It holds what the old panel showed: picker, time, weather and the real reading, drone, event log, Play/Pause/Reset/speed/slider, the legend and the footnote. Choosing a scenario switches the mode to `{ kind: 'scenario', id }`. A "Back to the story" item returns to story mode.
  - **Deep links:** `?scenario=<id>` starts in scenario mode with details open. `?segment=` keeps working.
- [ ] **Step 8: Run all browser tests.** Run: `env -u WSL_DISTRO_NAME CI=1 bunx playwright test`, then on the WSL GPU `MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA DISPLAY=:0 bun run e2e`. Expected: PASS headless with the GPU tests skipped; PASS on the GPU, including both frame-time tests and recording. The frame-time test drives `demo/scene.html?scenario=s1` through the details menu's slider.
- [ ] **Step 9: Commit** (`feat(scene): tell the story in four chapters`).

### Task 6: Redeploy

**Files:**

- Modify: `docs/TRD.md` Deployment line (mention `/sign-in`)

**Interfaces:**

- Consumes: Tasks 1-5 merged to main.

- [ ] **Step 1: Build.** Run: `bun run build:demo-site <scratch dir>`. Expected: it reports the file count and 0 secrets found.
- [ ] **Step 2: Deploy.** Run: `vercel deploy --prebuilt --prod --yes --scope heezijie2004-4778s-projects --cwd <scratch dir>`, after `vercel link --yes --project safe-edge --scope heezijie2004-4778s-projects --cwd <scratch dir>` if that folder isn't linked. Expected: `readyState` READY, aliased to `https://safe-edge-two.vercel.app`.
- [ ] **Step 3: Check the live site.** Run `e2e/demo-site.e2e.ts`, `landing.e2e.ts`, `sign-in.e2e.ts` and `story.e2e.ts` against the live URL with `PLAYWRIGHT_BASE_URL`. To allow that, the config uses `process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173/'` and skips `webServer` when it is set. Expected: PASS.
- [ ] **Step 4: Commit** the TRD line (`docs: note the sign-in page`).
