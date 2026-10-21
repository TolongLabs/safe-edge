# Demo video

The submission video is the narrated pitch deck with one live-demo segment of the prototype in the middle. Two Claude Code sessions make the video: a **Director** writes and edits it, and a **Recorder** films the real app with Playwright. Remotion assembles the slides, the footage and the narration into one file. This page tells both sessions, and the team, how to do it. The method comes from an earlier project of ours that made its demo video the same way.

Issue: [#97](https://github.com/TolongLabs/sdp-hack/issues/97).

Contents:

1.  [Rules for the video](#rules-for-the-video)
1.  [Video plan](#video-plan)
1.  [Roles](#roles)
1.  [Pipeline](#pipeline)
1.  [Live-demo shot list](#live-demo-shot-list)
1.  [Recording the prototype](#recording-the-prototype)
    1.  [Harness](#harness)
    1.  [Determinism](#determinism)
    1.  [Manifest and cue sheets](#manifest-and-cue-sheets)
1.  [Assembling in Remotion](#assembling-in-remotion)
    1.  [Project](#project)
    1.  [Motion design](#motion-design)
    1.  [Sound and captions](#sound-and-captions)
1.  [Quality checks](#quality-checks)
1.  [Review gates and timeline](#review-gates-and-timeline)
1.  [Lessons from the earlier project](#lessons-from-the-earlier-project)
1.  [Kickoff prompts](#kickoff-prompts)
    1.  [Director prompt](#director-prompt)
    1.  [Recorder prompt](#recorder-prompt)
1.  [Sources](#sources)

## Rules for the video

- **At most five minutes.** Treat five minutes as a ceiling ([context][video-context]). Target 4:45; the hard cap is 4:50. Issue #15 confirms the limit.
- **Show the solution, not the team** ([brief][brief-video]).
- **The deck carries the pitch.** The slides keep the organisers' template order ([deck README](/docs/demo/README.md)). The live demo sits after "5. How it Works".
- **Simulated means labelled.** Every app shot keeps the app's **Simulation** label on screen. The narration never calls a sample photo real, a simulated flight real, or a finding confirmed in the field ([`PRODUCT.md`](/docs/PRODUCT.md#product-principles), principle 7). False claims can disqualify the team.
- **Problem and user first.** Judges skim, so the problem and the user show in the first 20 seconds ([context][judges]).
- **Every number has a source.** Spoken numbers match the deck and its appendix.

## Video plan

The Director may move time between slides. The live demo stays between 75 and 95 seconds, and the total stays under 4:50.

| Time      | Part                        | Source                                               |
| --------- | --------------------------- | ---------------------------------------------------- |
| 0:00–0:10 | Title                       | Deck slide "Safe Edge"                               |
| 0:10–0:15 | Team Information            | Deck                                                 |
| 0:15–0:45 | 1. The Problem              | Deck                                                 |
| 0:45–1:05 | 2. Target User              | Deck                                                 |
| 1:05–1:25 | 3. Your Solution            | Deck                                                 |
| 1:25–1:45 | 4. Innovation               | Deck                                                 |
| 1:45–2:00 | 5. How it Works             | Deck                                                 |
| 2:00–3:30 | **Live demo**               | Recorder footage ([shot list](#live-demo-shot-list)) |
| 3:30–3:50 | 6. Impact                   | Deck                                                 |
| 3:50–4:10 | 7. Feasibility              | Deck                                                 |
| 4:10–4:20 | 7. Implementation           | Deck                                                 |
| 4:20–4:25 | 7. Visual Concept           | Deck                                                 |
| 4:25–4:40 | 8. Why Your Team Should Win | Deck                                                 |
| 4:40–4:45 | Thank You                   | Deck                                                 |

**Render the whole video in Remotion.** Export each slide of [`pitch-deck.html`](/docs/demo/deck/pitch-deck.html) as a 1920 × 1080 PNG: open the deck in Playwright, call `document.querySelector('deck-stage').goTo(i)` and take a screenshot. Then one timeline holds the slides, the narration and the demo, with one mix and one caption file. Use the draft deck until chaosiris finishes the design, then export again.

## Roles

| Role        | Who                             | Owns                                                                                                                       | Hands over                                                                      |
| ----------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Director    | Claude Code session on Opus 5.5 | The script, the narration, the shot list, the voice, the Remotion edit, the mix, the captions and the quality checks       | The shot list to the Recorder; stills, rough cut and final files to AlaskanTuna |
| Recorder    | Claude Code session on Opus 5.5 | The recording harness, the takes, the manifest and cue sheets, and the motion components (callouts, push-ins, click rings) | Footage, the manifest and the components to the Director                        |
| AlaskanTuna | Person                          | The narrator voice and its key, the review gates, the upload and the link check                                            | Approvals                                                                       |
| kymil4      | Person                          | The frontend; says when it is frozen for final takes                                                                       | The freeze time and commit                                                      |
| chaosiris   | Person                          | The designed deck                                                                                                          | The final `pitch-deck.html`                                                     |

Name the sessions `safe-edge-director` and `safe-edge-recorder`. They message each other with SendMessage; files are the contract between them. The Recorder never drives the edit, and the Director never drives the app.

## Pipeline

1.  **Brief (Director).** Write `video/BRIEF.md`: the story, the narration for every slide and shot, and a timing table under 4:50. Stop at gate G1.
1.  **Shot list (Director).** Write `video/src/data/shots.json` from the approved brief and send it to the Recorder.
1.  **Voice (Director).** Generate the narration with word timings. Write `video/src/data/voice.json`.
1.  **Harness and draft takes (Recorder).** Build the harness on the current `main` and record draft takes, so the edit can start.
1.  **Final takes (Recorder).** When kymil4 freezes the frontend, record every shot again on that commit.
1.  **Ingest (Director).** Convert each take to 30 fps H.264 and read its cues into `video/src/data/footage.json`.
1.  **Edit and motion (both).** The Director builds the timeline; the Recorder builds the motion components to the Director's spec.
1.  **Review.** Five stills at G2, a half-scale rough cut at G3.
1.  **Finish (Director).** Render, normalise loudness, write captions, run the checks. Stop at G4.
1.  **Upload (AlaskanTuna).** Upload, then open the link from a signed-out browser before submitting (#99).

## Live-demo shot list

The Director owns this list; the Recorder confirms each status on the frozen build. The selectors come from the end-to-end tests, which already drive this path: [`s1-s3.e2e.ts`](/e2e/s1-s3.e2e.ts), [`fix-lens.e2e.ts`](/e2e/fix-lens.e2e.ts), [`retest.e2e.ts`](/e2e/retest.e2e.ts), [`passes.e2e.ts`](/e2e/passes.e2e.ts) and [`story.e2e.ts`](/e2e/story.e2e.ts). Steps between shots run off camera.

| Shot | Length | Screen                                                    | On camera                                                                                                                                                       | Status                                                                   |
| ---- | -----: | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| D1   |   15 s | Desktop, `demo/scene.html?scenario=s1&record`             | Click **Play**, pick a **Speed**, hold until the drone takes off: the rain hold, the launch and the **Simulation** badge                                        | Ready. There is no Rain button; S1 plays the rain itself                 |
| D2   |   15 s | Desktop, `demo/#/inbox` as the manager                    | **Inbox list** → **Fence panel 4** → **Confirm: needs a fix**: before and after images, the reason and the drafted work order                                   | Ready                                                                    |
| D3   |   25 s | Desktop, `demo/#/fix-lens`                                | **Choose a fix**, the S2 sample markings, **Next: compare fixes**, **Use the two sample fixes**: one fix leaves the fence-end route open, the other closes both | Ready. This is the key moment of the demo                                |
| D4   |   20 s | Phone, 390 × 844, `demo/#/retest` as a different reviewer | The checks, a reason for each, **Sign and issue the pass**, then **Safety pass issued**                                                                         | Ready. The path is long, so cut it into cue windows                      |
| D5   |    8 s | Desktop, `demo/#/passes`                                  | The edge's pass, valid, with its expiry date                                                                                                                    | Ready                                                                    |
| D6   |   10 s | Desktop, `demo/scene.html?scenario=s5&record`             | An AI assistant asks which passes expire, then tries to accept a repair and is refused                                                                          | Ready as a scene replay. A live MCP session is a terminal, not a browser |

The shots total about 93 seconds before trimming. Do not show a live agent run on camera: it needs an Anthropic key and its words change each run.

## Recording the prototype

### Harness

- **Files:** `video/record/playwright.config.ts` and `video/record/takes.rec.ts`, and nothing in `e2e/`, so CI never records video.
- **Target:** the local production build at `http://127.0.0.1:4173/`, served the same way as in the root [`playwright.config.ts`](/playwright.config.ts). It is what the judges get, and it needs no network. Record the commit hash in the manifest.
- **Browser:** Chromium, headed on WSL, with the root config's GPU flags. The scene needs the GPU.
- **Reuse the test fixture:** import `test` and `expect` from [`e2e/fixtures.ts`](/e2e/fixtures.ts), which blocks calls to other sites.
- **One file per take:** set the shot up off camera, then start a screencast, act, and stop it. Playwright 1.64, the repo's version, records with `page.screencast.start()` ([Playwright screencast][pw-screencast]):

```ts
let firstFrame: number | undefined
await page.screencast.start({
  path: `video/public/footage/raw/${shot}-take${take}.webm`,
  size: { width: 1920, height: 1080 },
  fps: 30,
  onFrame: ({ timestamp }) => {
    firstFrame ??= timestamp
  }
})

// A cue is the moment the expected state is visible, not the moment of the click.
async function cue(id: string, visible: Locator) {
  await expect(visible).toBeVisible()
  await expect(page.getByText('Simulation', { exact: true }).first()).toBeVisible()
  cues.push({ id, tMs: Date.now() - firstFrame!, box: await visible.boundingBox() })
}

// ...the shot's actions and cues...
await page.screencast.stop()
```

- **Phone shots:** use a 390 × 844 viewport with `deviceScaleFactor: 3` and a screencast size of 1170 × 2532. Check the real frame size with `ffprobe` on the first take.
- **Scene shots:** keep `&record` in the URL. It fixes the camera path and steps the scene at a steady frame rate, so a slow machine slows the scene instead of dropping frames. If the screencast stutters on the scene, use the scene's own **Record** button instead, as [`recording.e2e.ts`](/e2e/recording.e2e.ts) does.

### Determinism

- **A fresh browser context for every take.** Identity and keys live in `sessionStorage`, so nothing carries over.
- **Sign in by URL:** `demo/?as=manager` or `demo/?as=reviewer`. The app reads `as` only on the tab's first load.
- **Reset demo** from the profile menu before setup, if a take reuses a context.
- **Fix the clock on app screens:** `page.clock.setFixedTime('2026-10-20T08:00:00+08:00')`, the day the agent recordings use in [`agent-key.e2e.ts`](/e2e/agent-key.e2e.ts). Don't fix the clock on scene shots; the scene runs on its own playback time.
- **Same build for every final take.** Re-record every shot after any frontend change.

### Manifest and cue sheets

The Recorder writes `video/public/footage/manifest.json`. Coordinates are CSS pixels of the take's viewport.

```json
{
  "commit": "d5fe681",
  "takes": [
    {
      "shot": "D3",
      "take": 2,
      "status": "ok",
      "file": "raw/D3-take2.webm",
      "viewport": { "width": 1920, "height": 1080 },
      "fps": 30,
      "cues": [{ "id": "route-open", "tMs": 6120, "box": { "x": 812, "y": 404, "width": 520, "height": 48 } }]
    }
  ]
}
```

- Agree the cue ids with the Director before recording. They come from `shots.json`.
- Mark a bad take `"failed"`. Never overwrite or delete a take; the ingest picks the newest `"ok"` take.

## Assembling in Remotion

### Project

- **Where:** a `video/` folder at the repository root, with its own `package.json`, outside the Bun workspaces. Pin Remotion 4.0.530, the version the earlier project used. Run `bun install` inside `video/`.
- **Ignore media in Git:** `video/out/`, `video/public/footage/`, `video/public/voice/` and `video/public/music/`. Commit the code, the brief, `shots.json` and the data JSON.
- **Port from the earlier project:** the frame and keyframe helpers, the timeline layout, the cue windows, the subtitle and SRT builders, the music envelope, the ElevenLabs scripts, the loudness and QA scripts, and their tests. Drop its pixel-reading detector: our cues come from Playwright.
- **Ingest:** convert each take to constant 30 fps H.264 before the edit:

```shell
ffmpeg -i raw/D3-take2.webm -vf fps=30 -c:v libx264 -crf 16 -pix_fmt yuv420p -an D3-take2.mp4
```

- **Compositions:** `Main` (the whole video, 1920 × 1080, 30 fps), `MainNoMusic`, `Demo` (the live demo alone, for review) and one preview per shot.

### Motion design

- **The app is the star.** Show the app window inset on a calm background, about 0.86 scale, with room for one callout beside it. The phone shot sits in a plain phone frame.
- **Guide the eye.** A gentle push-in, about 1.12×, toward the cue's box at each key action, and a ring at the click point.
- **Chapter chip per shot:** Patrol, Flag, Confirm, Fix, Prove. They match slide "5. How it Works".
- **One callout per shot,** five words at most, for example "Route still open" in D3.
- **Motion rules:** deterministic by frame, eased in and at rest; no bounce, whip-pan or smear. Cut on the narration.
- **Look:** Atkinson Hyperlegible Next and the colour tokens in [`DESIGN.md`](/docs/DESIGN.md). Overlay text is at least 54 px.
- **Never cover the Simulation label.** Add a small persistent "Simulation · sample data" tag in the overlay as well.

### Sound and captions

- **One narrator for the whole video.** By default, an ElevenLabs voice that AlaskanTuna picks at G1, using AlaskanTuna's key. A team member's recorded voice is the fallback.
- **Music is optional.** If used, duck it 12 dB under the narration and also render a version without music, in case YouTube claims the track.
- **Loudness:** −14 LUFS integrated and at most −1 dBTP true peak.
- **Captions:** an English SRT built from the edit's narration timings.

## Quality checks

Automated, in `bun test` and the QA script:

- The whole video is at most 290 seconds; the live demo is 75 to 95 seconds.
- Loudness is within 0.7 LU of −14 LUFS, and true peak is at most −1 dBTP.
- The narration and captions contain no banned phrase: "real drone", "certified", "certificate", "prevents drowning", "lives saved", "risk score", "real site photo", "guarantee". The Director extends the list.
- The Recorder's harness confirms the **Simulation** label at every cue.
- Overlay text is at least 54 px.

By hand, before upload:

- Every spoken number matches the deck's appendix.
- AlaskanTuna watches the whole video once, with sound.

## Review gates and timeline

The submission is due at 11:59 PM on Friday 23 October; the team submits by noon ([#99](https://github.com/TolongLabs/sdp-hack/issues/99)).

| Gate | AlaskanTuna approves                        | By                   |
| ---- | ------------------------------------------- | -------------------- |
| G1   | The brief, the shot list and the voice      | Thu 22 Oct, 2:00 PM  |
| G2   | Five stills from the edit                   | Thu 22 Oct, 10:00 PM |
| G3   | A half-scale rough cut                      | Fri 23 Oct, 7:00 AM  |
| G4   | The final files, after the automated checks | Fri 23 Oct, 10:00 AM |
| —    | Upload, link check, submission              | Fri 23 Oct, 12:00 PM |

- **Start the final render by 6:00 AM on Friday.** The earlier project's renderer estimated about an hour for a 98-second video with layered scenes; this video is three times longer.
- **Final takes need the frozen frontend.** If the freeze slips past 8:00 PM on Thursday, record on the `main` of that hour and note the commit.

## Lessons from the earlier project

- **Cut on cue windows, not one long take per scene.** The first edit there ran 138 seconds against a 119.5-second cap.
- **Actions run ahead of the screen.** Taps showed on screen 0.8 to 1.7 seconds after the logged time. Log a cue when its state is visible, then check it on a still.
- **Raw captures can drop still frames.** Convert to constant 30 fps before the edit.
- **A UI change means new takes.** The frontend revamp is our known risk.
- **Agree the contract first:** cue ids, time base, coordinate scale and file paths, before either session builds on them.
- **Label every render** with its version, its source takes and its review state, so notes map to a cut.

## Kickoff prompts

Start each session in one shared worktree, so the main checkout stays free:

```shell
git worktree add -b video/edit ../sdp-hack-video origin/main
```

The Director owns everything in `video/` except `video/record/` and `video/src/motion/`, which the Recorder owns. Only the Director runs Git. When you start a session, add the local path of the earlier project's video folder and its brief to the prompt.

### Director prompt

```text
You are safe-edge-director, the Director of the Safe Edge submission video (issue #97).
Read docs/demo/video.md fully. Then read docs/PRD.md "Demo script", docs/PRODUCT.md,
docs/DESIGN.md, docs/CONTEXT.md "Five-minute video", and docs/demo/deck/pitch-deck.html
(slide text and presenter notes).

You own the script, the narration, video/src/data/shots.json, the voice, the Remotion
project in video/, the mix, the captions and the quality checks. The Recorder session
(safe-edge-recorder) films the app; you never drive the app yourself.

Reference: the earlier project's video folder and brief at <paths>. Port its timing,
caption, audio and QA modules with their tests; don't copy its story or look.

Steps: 1) write video/BRIEF.md and stop at gate G1 for AlaskanTuna; 2) write shots.json
and send it to the Recorder; 3) scaffold video/ and generate the voice; 4) ingest the
Recorder's takes; 5) build the edit; 6) stills (G2), rough cut (G3), final (G4).

Rules: claim nothing the deck's appendix can't source; keep every simulated view
labelled; commit code and data only, never media; open a pull request per gate.
```

### Recorder prompt

```text
You are safe-edge-recorder, the Recorder and motion designer for the Safe Edge
submission video (issue #97). The Director is safe-edge-director; it owns the script
and the edit.

Read docs/demo/video.md fully, then e2e/fixtures.ts, e2e/s1-s3.e2e.ts,
e2e/fix-lens.e2e.ts, e2e/retest.e2e.ts, e2e/passes.e2e.ts, e2e/story.e2e.ts,
e2e/recording.e2e.ts and playwright.config.ts. Read the Playwright screencast docs
before using the API.

You own video/record/ (the harness) and video/src/motion/ (callouts, push-ins, click
rings, chapter chips), plus the footage in video/public/footage/. Don't run Git.

Steps: 1) build the harness and record draft takes of every shot in shots.json on the
current build; 2) send the Director the manifest path and any shot you could not
record, with the reason; 3) build the motion components to the Director's spec;
4) when kymil4 announces the frontend freeze, record every shot again on that commit.

Rules: never change the app to make a shot work; report the gap instead. Keep failed
takes, marked failed. Confirm the Simulation label at every cue.
```

## Sources

- [PRD demo script](/docs/PRD.md#demo-script) and [scenarios](/docs/PRD.md#scenarios).
- [Five-minute video guidance][video-context] and [how judges read a submission][judges].
- [Brief: video and prototype][brief-video].
- [Playwright screencast][pw-screencast] and [Playwright video options][pw-video].
- [Remotion documentation][remotion].

[video-context]: /docs/CONTEXT.md#five-minute-video
[judges]: /docs/CONTEXT.md#how-judges-read-a-submission
[brief-video]: /docs/BRIEF.md#video-and-prototype
[pw-screencast]: https://playwright.dev/docs/api/class-screencast
[pw-video]: https://playwright.dev/docs/videos
[remotion]: https://www.remotion.dev/docs/
