# Safe Edge demo video

The Remotion project that renders the Safe Edge live-demo clip: composition `Demo`, 1920 × 1080 at 30 fps. It cuts the clip together from footage recorded off the real prototype ([`scripts/record-demo.ts`](/scripts/record-demo.ts)) and a voiced-over soundtrack. Every app and scene shot shows simulated sample data and keeps its Simulation label, and the edit adds a "Simulation · sample data" tag of its own.

Contents:

1.  [Requirements](#requirements)
1.  [Make the clip](#make-the-clip)
1.  [How the cut works](#how-the-cut-works)
1.  [Change a beat](#change-a-beat)
1.  [Files](#files)
1.  [Checks](#checks)

See [the demo video doc](/docs/demo/video.md) for the wider pipeline, and [DESIGN.md](/docs/DESIGN.md) for the tokens in `src/theme.ts`.

## Requirements

- [Bun](https://bun.sh) to run the scripts and Remotion.
- `ffmpeg` and `ffprobe` on the PATH, for recording, ingest and the voice staging.
- `OPENAI_API_KEY` in the repo-root `.env`, so `scripts/voice.ts` can fetch word timings from Whisper (`whisper-1`).

This project sits outside the repo's Bun workspaces and has its own `bun.lock`, so install inside `video/` with its own lockfile.

## Make the clip

Run these from `video/`.

1.  Install dependencies.

    ```shell
    rtk bun install
    ```

1.  Record the footage from the repo root.

    ```shell
    rtk bun run record:demo
    ```

    Each run plays the demo in headless Chromium and records a take per shot ("H1", "D1", "R1-phone", …) with its cue timestamps, and lands in `video/public/footage/runs/<run>/`. A full run also assembles a quick `demo-preview.mp4` there. To re-record only part of the demo, pass a Playwright grep: `rtk bun run record:demo --grep @app` for the app takes or `--grep @report` for the phone report take.

1.  Stage the voice. Source your `.env` first, because the script calls Whisper.

    ```shell
    set -a && . ../.env && set +a && bun scripts/voice.ts <folder with 6.wav … 12.wav> \
      report=<take>.wav ai=<take>.wav engineer=<take>.wav
    ```

    Takes `6.wav`–`12.wav` are the human narrator, one per part (`intro`, `problem`, `d1`–`d5`). The `id=<take>.wav` arguments are the generated (ElevenLabs) lines such as `report`, `ai` and `engineer`. For each take the script:

    1.  Trims it to its speech, keeping a little head and tail so no attack is clipped.
    1.  Levels it: a highpass, a compressor to even the syllables, then an oversampled limiter, corrected to −17 LUFS mono, which plays as −14 LUFS once Remotion spreads it over both channels, YouTube's reference level.
    1.  Builds the room tone loop (`public/voice/demo/room.wav`) from the human takes' silences only, levelled to match, so gaps between lines never drop to digital silence.
    1.  Times the words with Whisper, cached per take in `src/data/whisper/`.
    1.  Records each staged take's quiet stretches, which are the safe places for the edit to cut it.

    The staged takes and the room tone go to `public/voice/demo/`; the word timings and quiet stretches go to `src/data/demo-voice.json`.

1.  Ingest the recording runs into edit-ready footage.

    ```shell
    bun scripts/ingest.ts public/footage/runs/<run> [public/footage/runs/<later run> …]
    ```

    With several runs, each shot comes from the last run that recorded it successfully, so a partial re-record wins. Each take is converted to constant 30 fps with its last frame held for 4 s, and the shot's cues, dimensions and length are written to `src/data/footage.json`. The fonts for `src/fonts.ts` are copied from the web app's `node_modules`.

1.  Preview and render.

    ```shell
    bun run studio
    bunx remotion render src/index.ts Demo out/safe-edge-demo.mp4 --codec=h264 --crf=16 --audio-bitrate=320k
    ```

## How the cut works

`src/edit.ts` is the whole cut as data: a `PARTS` array, and `src/Demo.tsx` lays each part over its voice take and renders everything. A part is one voice line plus what is on screen during it.

- `Part`: the voice take, a chapter (`0` Problem, `1` Solution, `2` Outcome, or `null` for the intro), an optional `step` shown in the chapter bar, a `lead` and `tail` in seconds around the voice, and its `clips`, `callouts` and optional `slide`, `board` or `checklist`.
- `Clip`: which `shot` to play, when it starts (`from`, in seconds from the part's start), where in the take it starts (`srcIn`), an optional playback `rate`, `freeze` to hold the in-point frame, `fadeIn` to dissolve, the `camera` framings, and optional highlight `rings`.
- `Callout`: a pill with text, tone and position, shown between two part times.
- `slide`: the opening deck slide; it fills the frame, then shrinks into the app window at `shrinkAt` as the app arrives underneath.
- `board`: the phone storyboard (`Panel`s side by side with arrows); each panel appears when its step is spoken, plays from `srcIn`, and holds from `holdAt`.
- `checklist`: steps beside the phone that tick green at their `at` times.

Almost every time is set on a spoken word. `word(voiceId, text, nth)` in `src/lib.ts` returns the played time of the nth occurrence of a word, held beats included, so timings survive any re-record of the voice. `cue(shotId, cueId)` reads a timestamp the recorder noted inside a take. `sync(shot, cueId, when, from)` in `src/edit.ts` works backwards from a cue to the `srcIn` that makes a recorded moment land at a chosen word.

A held beat is a `PAUSES` entry in `src/lib.ts`: after the named word, the voice stops for some seconds so the picture can land. The take is cut in the first quiet stretch after that word, so no syllable is clipped, and every later word in that take shifts by the pause.

Camera framings are in the take's own source pixels: `{ at, x, y, z }` is a focus point and zoom at a part time, and `framingAt` in `src/Demo.tsx` eases between them. Highlight `rings` use the same source pixels, measured on the final takes and listed in `BOX`.

## Change a beat

1.  **Move or retime a callout.** Find it in `PARTS` in `src/edit.ts`, e.g. the Problem part's `{ from: problem('record'), to: END, text: 'Still marked safe', x: 760, y: 260 }`. Change `x`/`y` in frame pixels, or set `from` to another word in the same take: `problem('safe')`, say.
1.  **Hold longer after a word.** Add a beat to `PAUSES` in `src/lib.ts`, e.g. extend `d4: [{ after: 'work', seconds: 0.3 }]`. The cut lands in the first quiet stretch after the word, and the part grows by the pause.
1.  **Re-time a clip to a recorded moment.** Give its `srcIn` to `sync`, like the Confirm part does: `srcIn: sync('D2', 'd2-finding', d2('gap') - 0.1, CONFIRM_CLICK_FROM)` makes the click's finding land on "gap". Change the word or the lead and the in-point follows.
1.  **Swap a voice take.** Replace the source WAV, delete its cached transcript `src/data/whisper/<id>.json` (the cache is keyed by part id, not by file), then re-run `scripts/voice.ts`. Word timings, loudness and the room tone refresh, and part lengths follow the new take. A word that a callout or clip names must still be in the new take, or the render stops.
1.  **Frame something else.** Edit the part's `camera` framings or add one, in the take's source pixels, e.g. `fixA = { x: 840, y: 600, z: 1.42 }`. `framingAt` eases into it; give `move` a different number of seconds for a slower move.

## Files

| File                          | Job                                                                        |
| ----------------------------- | -------------------------------------------------------------------------- |
| `src/index.ts`                | Remotion entry point; registers the root.                                  |
| `src/Root.tsx`                | Declares the `Demo` composition (1920 × 1080, 30 fps, `DEMO_FRAMES`).      |
| `src/Demo.tsx`                | Renders the part timeline: clips, camera, callouts, storyboard, audio.     |
| `src/edit.ts`                 | The cut as data: `PARTS`, `Clip`, `Callout`, `sync`, `BOX`.                |
| `src/lib.ts`                  | `word`, `cue`, the held beats (`PAUSES`) and the timing math.              |
| `src/theme.ts`                | Colour and type tokens from `/docs/DESIGN.md`.                             |
| `src/fonts.ts`                | Loads Atkinson Hyperlegible Next from `public/fonts/`.                     |
| `src/data/footage.json`       | The ingested shots: sources, lengths, cues. Written by ingest.             |
| `src/data/demo-voice.json`    | Staged voice takes, word timings, quiet stretches. Written by voice.       |
| `src/data/whisper/*.json`     | Cached Whisper transcriptions, one per take.                               |
| `scripts/voice.ts`            | Trims, levels and times each voice take; builds the room tone.             |
| `scripts/ingest.ts`           | Converts recorded runs into edit-ready mp4s and `src/data/footage.json`.   |
| `record/contract.ts`          | Manifest and take types; where recording output goes.                      |
| `record/takes.rec.ts`         | Playwright tests that drive the app and record each `@app`/`@report` shot. |
| `record/scene.rec.ts`         | Records the `@scene` map and drone takes from the scene page.              |
| `record/take.ts`              | `recordTake`: screencast capture, cues and the Simulation-label check.     |
| `record/assemble.ts`          | Assembles the run's quick `demo-preview.mp4` from fixed windows.           |
| `record/playwright.config.ts` | Config for the recording tests.                                            |

Generated and ignored by Git: `video/public/footage/` (recording runs), `video/public/voice/` (staged voice and room tone), `video/public/fonts/`, `video/public/slides/`, and `video/out/` (renders). The `scripts/` rebuild all of them from the takes. The JSON under `src/data/` is committed: it is the edit's input.

## Checks

- `bunx tsc --noEmit` inside `video/` (or `bun run typecheck`), which type checks `src/` and `scripts/`.
- `bun run lint` at the repo root runs Prettier over the repo, this folder included.
- The render fails loudly rather than cutting something away: a clip that runs past its take plus the 4 s held frame throws in `src/Demo.tsx`, and a missing word, cue or quiet stretch throws in `src/lib.ts` and `src/edit.ts`.
