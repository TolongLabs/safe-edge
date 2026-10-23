# Safe Edge video director script

The script for the Safe Edge submission video: the narrated pitch deck in the 11-slide organiser flow confirmed by the user on 22 October 2026, with an 83-second demo of the working prototype after slide "5. How It Works". One narrator reads every `VOICEOVER` block outside the demo; the demo is a separate video, voiced by an ElevenLabs voice, edited in at V8. The voice follows the two scripts that won Kolaxus Grand Champion for MyTakziah: say who we are in a breath, tell the true stories quietly, carry one argument across the slides with a link from each to the next, say the honest limits plainly, and close by echoing the opening. [`video.md`](/docs/demo/video.md) owns the capture plan.

Contents:

1.  [How the video works](#how-the-video-works)
1.  [Timing](#timing)
1.  [Director transcript](#director-transcript)
    1.  [V1: Team Information](#v1-team-information)
    1.  [V3: 1. The Problem](#v3-1-the-problem)
    1.  [V4: 2. Target User](#v4-2-target-user)
    1.  [V5: 3. Your Solution](#v5-3-your-solution)
    1.  [V6: 4. Innovation](#v6-4-innovation)
    1.  [V7: 5. How It Works](#v7-5-how-it-works)
    1.  [V8: Live demo](#v8-live-demo)
        1.  [Problem (H1)](#problem-h1)
        1.  [Solution: find (D1)](#solution-find-d1)
        1.  [Solution: confirm (D2)](#solution-confirm-d2)
        1.  [Solution: fix (D3)](#solution-fix-d3)
        1.  [Solution: prove (D4)](#solution-prove-d4)
        1.  [Outcome (D5)](#outcome-d5)
    1.  [V9: 6. Impact](#v9-6-impact)
    1.  [V10: 7. Feasibility](#v10-7-feasibility)
    1.  [V11: 8. Implementation](#v11-8-implementation)
    1.  [V13: 10. Why Your Team Should Win](#v13-10-why-your-team-should-win)
    1.  [V14: Closing hold](#v14-closing-hold)
    1.  [Optional segments](#optional-segments)
1.  [Recording the voiceover](#recording-the-voiceover)
    1.  [The narrator](#the-narrator)
    1.  [The demo voice](#the-demo-voice)
    1.  [Pickup lines](#pickup-lines)
1.  [Claim guardrails](#claim-guardrails)
1.  [Claims ledger](#claims-ledger)
1.  [Decisions for the team](#decisions-for-the-team)
1.  [Shot checklist](#shot-checklist)
1.  [Sources](#sources)

## How the video works

**The argument, in one breath.** We are Team T010NG, in the People track, working on one problem: keeping the edges of township lakes and drains safe. Here's why: a nine-year-old girl went after her ball in a drain and was swept away; five months earlier, two brothers did the same. Nobody can say what those edges looked like, because after a storm nobody walks every edge and nobody clearly owns the fix. So accountability has to start with one person, the park maintenance manager. Safe Edge gives them one loop, and Fix Lens tests every repair against every way to the water before anyone pays. The demo then shows the problem, the solution and the outcome on one fence panel. After it: how we'd know it works, why it can start now, the pilot, why us, and the ask.

- **Runtime:** 4:47 in the default cut, under the 4:50 cap. The team, the track and the problem are named in the first 12 seconds; the stories and the evidence finish by 0:50.
- **Two voices.** One narrator, a team member, reads V1 to V7 and V9 to V14. The demo is its own video, voiced by the narrator's takes 6 to 12 and rendered separately; it opens with V7. V7 hands into the demo ("Let's see it work"); V9 picks up after it with a question ("So how would we know it works?").
- **The demo is the crux.** It is built in three labelled parts, **Problem**, **Solution** and **Outcome**, and each part says its name aloud. The Outcome line answers the Problem line word for word ("The record still says this edge is safe" becomes "now the record tells the truth").
- **Every segment links to the one before.** Each first sentence picks up the last thought ("Accountability, then", "That's where Safe Edge comes in", "Let's see it work", "Here's how Safe Edge solves it", "Now the hidden problem", "The outcome", "So how would we know", "Better still", "Therefore", "So why us?", "Ultimately"). Keep the links when you trim.
- **Pace:** the narrator reads at about 150 words a minute, including the marked pauses and numbers as spoken. It will feel slow; it is right. The Director then speeds every narrator take up to 1.2× without changing its pitch, so it plays at about 180 words a minute; the demo voice is not sped up. A take that still runs long is read again from its pickup line, never sped up further.
- **Overlay tag:** a small, persistent "Simulation · sample data" tag on every app and scene shot, never on deck slides or the story cards. It never covers the app's own Simulation label.
- **Not in the default cut:** V12 (Deck 10, "9. Visual Concept") and the optional demo shots D3b and D6. See [Optional segments](#optional-segments).

## Timing

"Words" are whitespace-separated words in the `VOICEOVER` block. "Read" is the time at about 150 words a minute, counting numbers, initials and hyphenated words as read aloud, plus the marked pauses. "Played" is the time in the video: narrator takes play at 1.2×, so their read time divides by 1.2; the demo voice plays as generated. The slot minus the played time is visual hold.

| Seg     | Time      | Voice    | Purpose                                                    | Words |   Read | Played |
| ------- | --------- | -------- | ---------------------------------------------------------- | ----: | -----: | -----: |
| V1      | 0:00–0:12 | Narrator | Who we are, the track, the problem, our answer             |    34 | 13.9 s | 11.6 s |
| V3      | 0:12–0:50 | Narrator | Two real losses, what we know, and the gap nobody owns     |   102 | 45.1 s | 37.6 s |
| V4      | 0:50–1:02 | Narrator | Accountability needs a person: the one we built it for     |    35 | 14.0 s | 11.7 s |
| V5      | 1:02–1:23 | Narrator | The loop, and what Fix Lens is and solves                  |    62 | 24.8 s | 20.7 s |
| V6      | 1:23–1:35 | Narrator | Concede the drone, claim the proof                         |    32 | 13.9 s | 11.6 s |
| V7      | 1:35–1:42 | Narrator | Hand into the demo, with the honest frame                  |    19 |  7.6 s |  6.3 s |
| Problem | 1:42–1:54 | Demo     | A broken panel, and a record that still says safe          |    28 | 11.2 s | 11.2 s |
| D1      | 1:54–2:04 | Demo     | Solution: find it and suspend the pass                     |    24 |  9.6 s |  9.6 s |
| D2      | 2:04–2:14 | Demo     | Solution: a person confirms                                |    23 |  9.2 s |  9.2 s |
| D3      | 2:14–2:38 | Demo     | Solution: Fix Lens catches the hidden problem              |    55 | 23.0 s | 23.0 s |
| D4      | 2:38–2:50 | Demo     | Solution: someone else proves it                           |    29 | 11.6 s | 11.6 s |
| D5      | 2:50–3:05 | Demo     | Outcome: the record tells the truth                        |    36 | 14.4 s | 14.4 s |
| V9      | 3:05–3:30 | Narrator | How we'd know it works: the measure, the target, who gains |    71 | 29.5 s | 24.6 s |
| V10     | 3:30–3:55 | Narrator | Built, cheap to start, and honest about drones             |    71 | 29.2 s | 24.3 s |
| V11     | 3:55–4:09 | Narrator | Therefore, a small, strict pilot that can fail honestly    |    41 | 16.4 s | 13.7 s |
| V13     | 4:09–4:37 | Narrator | Why us, then ultimately the ask and the line               |    74 | 31.9 s | 26.5 s |
| V14     | 4:37–4:47 | Narrator | The name's meaning, the team, the tagline                  |    26 | 10.9 s |  9.1 s |

Total: 762 words, 4:47. The demo video runs 83 seconds (1:42 to 3:05 in the edit) and carries 195 of those words. The 1.2× speed-up shortened the other narrator segments by 25 seconds, and Impact, Feasibility and Implementation got all of it: 95 words became 183.

## Director transcript

Pause marks such as `[pause 0.4s]` are silence of that length. Everything else in square brackets is a direction, never read aloud. In the demo lines, the pause marks become ElevenLabs break tags ([The demo voice](#the-demo-voice)).

### V1: Team Information

**TIME:** `0:00–0:12` · **VOICE:** Narrator · **PURPOSE:** who we are, the track, the problem, our answer.

**ON SCREEN:** Deck 1, "Team Information", throughout the 12-second opening. Lead with "Safe Edge", "People · Safety and security" and the one-line claim, "We help SDP's park teams find, fix and prove the gaps at township water edges". Keep the four members and their universities readable; identify Hee Zi Jie (AlaskanTuna) as leader. A slow 3% push-in. No separate event or title page, and no overlay tag.

**DELIVERY:** Warm, direct and brief, like MyTakziah's "Good afternoon. We are Team Survive, and this is MyTakziah." Say T010NG as "Tolong", one word. The problem ("keeping the edges of township lakes and drains safe") is the sentence the judges must remember, so slow down for it. "Here's why it matters" turns quietly towards the story; let the music fall away under it.

**VOICEOVER:**

> Hi, we're Team T010NG. We're in the People track, safety and security, working on one problem: keeping the edges of township lakes and drains safe. Our answer is Safe Edge. [pause 0.3s] Here's why it matters.

**NOTES:** Deck 1 carries the project title and team details, so no separate V2 team segment is needed. The name's meaning ("Tolong is Malay for help") is saved for V14, so the close can echo it. Email and phone details are omitted at the user's instruction.

### V3: 1. The Problem

**TIME:** `0:12–0:50` · **VOICE:** Narrator · **PURPOSE:** two real losses, what we know, and the gap nobody owns.

**ON SCREEN:**

1.  **0:12 to about 0:24, story card 1:** a near-black card made in the edit, with one line of white text, "Bandar Mahkota Cheras · 1 May 2026", and a small source line, "Free Malaysia Today, 3 May 2026". Nothing moves. No music.
1.  **About 0:24 to 0:34, story card 2:** the same design, "Kajang · 4 December 2025", source "Malay Mail, 5 December 2025". Hold it through "We don't know what the edges of those drains looked like."
1.  **About 0:34 to 0:50, Deck 2, "1. The Problem":** cut on "What we do know". Push in on `no-walk`, the headline "Nobody walks every edge", as it is spoken, then `deaths`, the 371 card, so "Jan 2023 to Aug 2026" can be read, then `quote`, Mr. Eric's words, as they are spoken.

**DELIVERY:** Begin still and unhurried. Do not dramatise; the restraint is what makes it land, as MyTakziah's "He already knew" did. Drop your volume for "She was swept away", take the full pause, then say "She was found ten kilometres away" just as quietly. The Kajang line is the turn from one loss to a pattern: same register, a little slower on "Neither survived", then the full pause. "We don't know" is an honest admission, not a twist. "What we do know" is firmer: it turns from them to every edge. Read the numbers level, as facts. Say "Mr. Eric" warmly; he is a person who told us something, not a citation.

**VOICEOVER:**

> On the first of May, in Bandar Mahkota Cheras, a nine-year-old girl went after her ball in a drain. [pause 0.6s] She was swept away. [pause 0.5s] She was found ten kilometres away.
>
> [pause 0.8s]
>
> Five months earlier, in Kajang, two brothers went into a drain after a ball. Neither survived.
>
> [pause 0.8s]
>
> We don't know what the edges of those drains looked like. [pause 0.4s] What we do know: after a storm, nobody walks every edge. Bomba counted three hundred and seventy-one child and teen drowning deaths. And Mr. Eric, a former Head of Township at Sime Darby Property, told us the bigger issue is accountability for maintenance and public safety.

**NOTES:**

- **Add nothing to either story.** For Bandar Mahkota Cheras the reports establish a drain near Sri Hijau Condominium, a nine-year-old girl, a ball, that she was swept away, and that she was found in Sungai Langat about 10 km from the drain. For Kajang they establish two brothers, aged 12 and 14, who went into a large drain in Taman Prima Saujana while trying to get a ball back, were swept away, and both drowned; the younger died after reaching hospital and the older was found two days later ([incident table][incidents]). Neither report says anything about the drains' edges, a fence, a cover, fault or ownership. **Never say they drowned because of a missing fence, that anyone was negligent, that it was an SDP township, or that Safe Edge would have saved them.** "We don't know what the edges looked like" is the honest limit of our evidence; "What we do know" turns to the general problem.
- **Why these two.** They are the two ball cases among the 21 township incidents on Deck 2, and both began in a drain, the same kind of asset as our pilot.
- **Nobody is named,** neither the children nor their families. Keep it that way in every cut.
- **Mr. Eric's words are shortened, not changed.** His written answer of 16 October 2026: "The bigger issue is not who owns the drain or pond after handover, but whether there is clear accountability for maintenance and public safety" ([consultation][consult]). Check he is happy to be named before the video is published.

### V4: 2. Target User

**TIME:** `0:50–1:02` · **VOICE:** Narrator · **PURPOSE:** accountability needs a person: the one we built it for.

**ON SCREEN:** Deck 3, "2. Target User". Push in on `manager`, "SDP's Elmina park maintenance manager", on the first sentence, then on `way-round`, "a way round the fence end", on the last.

**DELIVERY:** "Accountability, then," picks up Mr. Eric's last word and turns it into a person with a job. Warmer now, without losing the weight of the stories. Land on "a way round the fence end": it is the problem Fix Lens answers in the next segment.

**VOICEOVER:**

> Accountability, then, has to start with a person: the park maintenance manager in Elmina, who must keep every retained water edge closed. And even a finished repair can leave a way round the fence end.

**NOTES:** This is a role, not a named person who has signed up. Never say "SDP's manager told us" or "our user". "Retained" means the edges SDP keeps after handover; the judges use the word.

### V5: 3. Your Solution

**TIME:** `1:02–1:23` · **VOICE:** Narrator · **PURPOSE:** the loop, and what Fix Lens is and solves.

**ON SCREEN:** Deck 4, "3. Your Solution", with the Fix Lens screenshot on the right. Push in on `patrol` on the drone or phone, then `fix-lens` as Fix Lens is introduced, and hold there through "before anyone pays"; then `proof` on the second person and the expiry. Optional: 3 seconds of shot H2, the landing page hero, over the first sentence.

**DELIVERY:** "That's where Safe Edge comes in" answers the manager's problem directly. The first two actors get one quick sentence. Then slow down: "For the repair, we built Fix Lens" is the first time a judge hears the name, so give it a beat, then say plainly what it does and what it saves ("before anyone pays"). It answers the last line of V4, a finished repair that still leaves a way round. Lift slightly on "expires": even the pass doesn't last forever.

**VOICEOVER:**

> That's where Safe Edge comes in. A drone or phone spots the change, and a named owner decides. For the repair, we built Fix Lens: it maps every way a child could reach the water, and shows whether a repair closes them all, before anyone pays. Then a second person proves it on site, and the edge earns a pass that expires.

**NOTES:** Fix Lens draws the openings and the routes to the water on the site photo, then tests each proposed repair against every recorded route ([`PRODUCT.md`](/docs/PRODUCT.md#fix-lens)). "Maps every way" means every way the person records; it doesn't discover routes by itself.

### V6: 4. Innovation

**TIME:** `1:23–1:35` · **VOICE:** Narrator · **PURPOSE:** concede the drone, claim the proof.

**ON SCREEN:** Deck 5, "4. Innovation". Push in on `exists` (Public Utilities Board) on the first sentence, then `protocol`, the chain from flag to expiry, on "what follows the flag". The headline, "The drone is optional. The proof is the product.", is on screen for the last two sentences.

**DELIVERY:** Concede first, plainly and without apology; it buys the credibility for the claim, as MyTakziah's "AI alone is not the innovation" did. Then name what is new, one item at a time; "Fix Lens" now lands as a name the judge knows. Slow down for the last two sentences and let them fall: they are the line a judge should repeat.

**VOICEOVER:**

> The drone isn't new; Singapore's Public Utilities Board already flies them. What's new is what follows the flag: an owner, Fix Lens, and independent proof. [pause 0.3s] The drone is optional. The proof is the product.

**NOTES:** Public Utilities Board flies drones over its reservoirs and inside closed drains, and ran a challenge for AI drain inspection ([prior art][prior-art]). We claim the protocol, never the drone or the AI. Deck 5's `ai-rule` card, "AI flags. People decide. No model approves.", stays on screen unspoken; D2 says it in the demo.

### V7: 5. How It Works

**TIME:** `1:35–1:42` · **VOICE:** Narrator · **PURPOSE:** hand into the demo, with the honest frame.

**ON SCREEN:** Deck 6, "5. How It Works", all six steps readable. Dissolve into the demo video at 1:42.

**DELIVERY:** Inviting and light: "Let's see it work" hands the floor to the demo, and "from problem to outcome" tells the judge exactly what they are about to watch. The honesty half is a plain fact about the demo, not an apology.

**VOICEOVER:**

> Let's see it work, from problem to outcome. Elmina's map is real; everything on it is simulated and labelled.

### V8: Live demo

**TIME:** `1:42–3:05` · **VOICE:** Narrator (takes 7 to 12)

**ON SCREEN:** a separate demo video, 83 seconds, rendered on its own and placed here. The app window sits inset on a calm background at about 0.86 scale, with room for one callout. Across the top, a three-part chapter bar, large enough to read on a phone: **1 Problem · 2 Solution · 3 Outcome**, lighting the current part. Under **Solution**, a step label: Find, Confirm, Fix, Prove. The overlay tag stays on throughout. Cut on the narration and on the cue windows in [`video.md`](/docs/demo/video.md#scenes-to-capture).

**DELIVERY:** One calm, clear ElevenLabs voice, different from the narrator but in the same register. The demo narration says why each moment matters, never which button is pressed; the screen shows the buttons. Each part opens with its own name ("Here's the problem", "Here's how Safe Edge solves it", "The outcome"), so a judge who looks away can still tell where they are.

#### Problem (H1)

**TIME:** `1:42–1:54` · **PART:** 1 Problem

**ON SCREEN:** shot H1: the Elmina lake by the playground at night in the rain, with the story card's headline readable: "Last night's storm knocked out a fence panel. The edge still shows a valid pass: nobody has checked yet." A slow push-in toward the fence. Chapter bar: Problem.

**VOICEOVER:**

> Here's the problem. Last night's storm knocked out a fence panel by the playground. The record still says this edge is safe, because nobody has checked it yet.

**NOTES:** This is the simulated example, not either drain in V3; the chapter bar and the overlay tag make that plain.

#### Solution: find (D1)

**TIME:** `1:54–2:04` · **PART:** 2 Solution · Find

**ON SCREEN:** the 3D scene story take: the take-off ("A dry morning. The drone takes off from the roof dock to photograph each edge."), then the flag ("The drone's photo shows panel 4 is gone. This stretch no longer counts as safe.") with the label "Fence panel 4 missing · simulated" and the segment turning red. Push in when the segment turns. The top label "Simulation · every flight, photo, flag and repair here" stays in frame.

**VOICEOVER:**

> Here's how Safe Edge solves it. After the storm, the drone patrols the edge, finds panel four missing, and suspends the pass at once.

#### Solution: report (R1)

**TIME:** about 7 s, after D1 · **PART:** 2 Solution · Find · **VOICE:** ElevenLabs, Darryl Lim (Malaysian English); the narrator could not record it

**ON SCREEN:** the phone, as Siti Aminah, the sample walk crew, in four short moments that tick off a checklist beside it ("Photo", "What they saw", "How urgent", "Sent to the manager"): the photo sent from the viewpoint, "Fence or barrier missing", "High", then "Report sent to the manager". Cut to the manager's Inbox, whole screen with the sidebar, on the new "Playground path, fence line" damage report, ringed with its "Source: user" tag.

**VOICEOVER:**

> And if you don't have a drone, that's fine. The patrol crew reports it from a phone, and it lands in the same Inbox.

**NOTES:** Deck 6 step 1 is "Patrol: a drone or the walk crew … DRONE OR PHONE", and V10 says the walk crew's phone can run the loop now. This beat shows that path is built ([`PRD.md`][prd] PHONE-3). The report is simulated sample data, like the rest of the demo. "Patrol crew", not "walk crew": in this voice "walk" and "foot" were heard as "work" and "food".

#### Solution: the AI can't decide (D6)

**TIME:** about 8.5 s, after R1 · **PART:** 2 Solution · Confirm · **VOICE:** ElevenLabs, Darryl Lim

**ON SCREEN:** the Agent screen, whole, then its eight tools ("Read only", "Drafts"), then "Can the agent decide anything?". "Ask core as the agent" is pressed and "Refused, as it must be … decideCandidate needs a person" appears, ringed. Callout: "Only people decide".

**VOICEOVER:**

> What about the AI? It reads records and drafts work, but it can't decide. Ask it to confirm a flag, and the server refuses.

**NOTES:** No model runs: the button makes the same call an agent's tool would, with the agent token, and core refuses it under `agents_draft_only`. D2's "A machine can lower trust, never raise it" follows directly.

#### Solution: confirm (D2)

**TIME:** `2:04–2:14` · **PART:** 2 Solution · Confirm

**ON SCREEN:** the Inbox, signed in as Farah Hashim, Park manager, a sample persona: the card "Fence panel 4 missing", the before and after drawings, the plain explanation that the flag paused the pass and confirmation does not restore it, the top bar's "SIMULATION" tag, then **Confirm: needs a fix** and the new finding. Push in on the drawings, then the button.

**VOICEOVER:**

> A machine can lower trust, never raise it. So a person decides: the park manager compares before and after, and confirms the gap.

#### Solution: fix (D3)

**TIME:** `2:14–2:38` · **PART:** 2 Solution · Fix

**ON SCREEN:** Fix Lens. The S2 sample markings add two openings on the drawing, the panel gap and the fence end: "2 openings and 2 ways recorded." Then the two sample fixes: fix A, "Replace panel 4", with "Leaves 1 way to the water open, Playground path, around the fence end", and fix B, "Replace panel 4 and extend the fence end", with "Closes all 2 ways to the water". Every drawing reads "proposed repair, not installed". The biggest push-in of the video, about 1.25×, lands on fix A's open way during the 0.6-second pause; then cut to fix B's closed line and the pick of B. Callout on fix A: "Route still open".

**VOICEOVER:**

> Now the hidden problem. The obvious fix is a new panel. Fix Lens maps both ways a child could reach the water: through the gap, and around the fence end. [pause 0.4s] A new panel closes one. The other stays open. [pause 0.6s] Extending the fence would close both, so that's the fix the manager chooses, before anyone pays.

**NOTES:** This is the moment the video exists for. "Would close": the drawing is a proposal, and the screen says so; no frame may suggest the repair is built.

#### Solution: approve and send (D3b)

**TIME:** about 6.5 s, after D3 · **PART:** 2 Solution · Fix · **VOICE:** ElevenLabs, Darryl Lim

**ON SCREEN:** Fix Lens as Lim Wei Jie, the sample engineer: whole, then **Approve fix B as Lim Wei Jie** and "Approved by Lim Wei Jie", ringed. Farah Hashim sends it: **Send fix B to Hafiz Rahman's crew**, then the page "Fix B sent to Hafiz Rahman's crew", whole, then its acceptance test and owner ringed: owner Farah Hashim, installer Hafiz Rahman's crew, re-test by someone who did not install it.

**VOICEOVER:**

> Next, an engineer approves fix B, and it goes to the installer's crew, with a named owner.

**NOTES:** This was the optional D3b. The approval is a person's, in a sample persona; nothing is built or paid for at this point.

#### Solution: prove (D4)

**TIME:** `2:38–2:50` · **PART:** 2 Solution · Prove

**ON SCREEN:** the phone, in a plain phone frame. Priya Nair, a sample reviewer who did not install the repair: "A different person checks this repair", "7 checks at the fence", the two route checks passed with typed reasons, then **Sign and issue the pass**.

**VOICEOVER:**

> Once the repair is in, the crew can't sign off their own work. Someone who didn't install it checks both routes on a phone, each with a written reason.

#### Outcome (D5)

**TIME:** `2:50–3:05` · **PART:** 3 Outcome

**ON SCREEN:** "Safety pass issued", its valid-to date, the line "All 2 ways to the water … are closed. Issued by Priya Nair, who signed the check", and the history "How it got here", scrolled slowly. For the last 4 seconds, the Passes board: "Action needed" and "Unknown is never shown as safe." Chapter bar: Outcome.

**VOICEOVER:**

> The outcome: now the record tells the truth. Both ways to the water are closed, and the edge gets its pass back, with the whole history behind it. Edges without a pass stay unknown, never safe.

**NOTES:** "Now the record tells the truth" answers the Problem line, "The record still says this edge is safe". "Both ways … are closed" is the simulated result on screen, inside a labelled demo.

### V9: 6. Impact

**TIME:** `3:05–3:30` · **VOICE:** Narrator · **PURPOSE:** how we'd know it works: the measure, the target and who gains.

**ON SCREEN:** Deck 7, "6. Impact". Push in on `main-measure` on "then measure how many are still closed at day thirty", `speed` on "how long each stays open", `park` on "the park must stay usable", then `value` on the last sentence. The `honesty` card, "It measures the hazard, not drownings", stays on screen throughout.

**DELIVERY:** The narrator comes back with a question, the one a judge is thinking after the demo. Then MyTakziah's own move ("We will not call downloads impact"): refuse the vanity metric, name the real one. Read the measure like a method: count first, then measure, then the target. "The target is all of them" is a commitment; say it level, not proud. "That measures the hazard, not drownings" is the honesty line; say it plainly and keep it in every cut. The last sentence names who gains, families first, then SDP, in one breath.

**VOICEOVER:**

> So how would we know it works? Not by counting flights. Before the repair, we count every confirmed open route to the water, then measure how many are still closed at day thirty; the target is all of them. [pause 0.3s] That measures the hazard, not drownings. We also time how long each stays open, and the park must stay usable. Families get tested edges; SDP gets a record to hand the council.

**NOTES:** "Confirmed" means a person checked the route on site; the baseline count comes before any repair. "The target is all of them" is the pilot's acceptance rule: every agreed permanent repair passes the independent re-test and is still closed 30 days after it ([`PRODUCT.md`](/docs/PRODUCT.md#success-measures); [pilot method][pilot-impact]). "How long each stays open" is the days from finding to interim protection, and to independent acceptance. "The park must stay usable": closing a path or a whole park never counts as a fix. "A record to hand the council" is the handover pack the app exports ([`PRD.md`][prd] BOARD-4); no council has asked for it. Never multiply the pilot across townships or claim a number of residents reached.

### V10: 7. Feasibility

**TIME:** `3:30–3:55` · **VOICE:** Narrator · **PURPOSE:** built, cheap to start, and honest about drones.

**ON SCREEN:** Deck 8, "7. Feasibility". Push in on the built card on "runs end to end", the phone card on "no aviation approval", the cost card on "ten thousand ringgit", then the drone card on "Subang airport's control zone". Optional: 3 seconds of shot D7, the Developers screen's Quickstart, under the first sentence's second half.

**DELIVERY:** "Better still" is good news, said practically: the judges should hear a plan, not a wish. Each sentence answers one question a judge asks about feasibility: is it built, can it start, what does it cost, what is hard. "Half of that is the repair itself" says where the money goes. The Subang line is due diligence, said plainly, not as a worry. "Priced on top" stays in the same breath as the drones, so they are never heard as part of the pilot ceiling.

**VOICEOVER:**

> Better still, none of it waits for a drone. The software already runs end to end, under automated tests, and the walk crew's phone can run the loop now, with SDP's permission and no aviation approval. We've capped the pilot at ten thousand ringgit, and half of that is the repair itself. Drones join later, priced on top: Elmina sits inside Subang airport's control zone, and approvals take about two months.

**NOTES:** "Runs end to end, under automated tests" is the loop from flag to pass in software (Supporting 3); it is not a field trial. "With SDP's permission": the phone patrol needs SDP's written access and a photo protocol, not an aviation approval. RM10,000 is a ceiling we set, and RM5,000 of it is interim protection and the permanent repair (Supporting 4). Elmina Central Park is about 6.5 km from Subang airport, inside its Class C control zone (Supporting 5). "About two months" is our estimate of the whole approval path: CAAM's Standard ATF (at least 14 working days), JUPEM imagery approval where required, MBSA's drone request, an SDP landowner letter, a data protection impact assessment and air-traffic coordination. Never say the drones are approved. The deck lists the built software; the narration leaves the DJI mission exports out on purpose ([mission export evidence][mission-exports]).

### V11: 8. Implementation

**TIME:** `3:55–4:09` · **VOICE:** Narrator · **PURPOSE:** therefore, a small, strict pilot that can fail honestly.

**ON SCREEN:** Deck 9, "8. Implementation". Push in on the comparison step on "test Fix Lens against today's repair method", then the gate on the last sentence. The site, the conditions before work and the day-30 check stay on screen unspoken.

**DELIVERY:** "Therefore" draws the plan out of the feasibility point. Short sentences, like a project plan read aloud. "If it isn't better, we'll say so" is a plain promise, not a hedge; it is what makes the claim believable. The last sentence is the gate: say it as a promise to stop if it doesn't work, which is what makes the ask safe to approve.

**VOICEOVER:**

> Therefore, the pilot is small and strict. On one drain, we test Fix Lens against today's repair method on the same evidence, and if it isn't better, we'll say so. We scale only if closure, park access, cost and ownership hold.

**NOTES:** SDP has not committed to any of this; the pilot is what we ask for in V13. Never say "our pilot site" as if it were agreed. "The same evidence": an engineer compares the routes each method finds, its false flags and any proposed repair that leaves a way round. If Fix Lens shows no better repair choice and no time saved, we drop the app claim (Deck 9 speaker note). The conditions before work (written access, a named owner and an engineer, a quote and funds) are on the slide; the named owner is spoken again in the ask.

### V13: 10. Why Your Team Should Win

**TIME:** `4:09–4:37` · **VOICE:** Narrator · **PURPOSE:** why us, then ultimately the ask and the line to remember.

**ON SCREEN:** Deck 11, "10. Why Your Team Should Win". Push in on `team` as the team lines are spoken, then on `ask`; keep the demo and repository QR cards visible and hold through the last line. This is also the closing slide used in V14.

**DELIVERY:** "So why us?" is the turn to the team: ask it plainly, the way a judge would. The answer is quiet confidence, not a brag, as MyTakziah's "This is not our first time shipping" was. Give "and law" its own small beat; it is the surprise. "Ultimately" then gathers everything into the ask: slow, clear and level, with slight stress on "named owner". Then a full beat of silence before the last sentence, as MyTakziah held before "the family should be allowed to grieve". Say it to one person, not to a room.

**VOICEOVER:**

> So why us? We're three computer science and law students. Between us, we've won Grand Champion with Layak and with MyTakziah, and every one of us has taken a project from zero to production, with real users. [pause 0.3s] Ultimately, our ask is an eight-week pilot on one retained drain in Elmina Central Park, with a named owner and a ten-thousand-ringgit ceiling. [pause 0.8s] A fence after a storm shouldn't depend on someone happening to walk past it.

**NOTES:** The team lines are the team's own account, confirmed on 22 Oct 2026: members of the team won Grand Champion with Layak and with MyTakziah, and all four have taken projects from zero to production. "Between us" claims the wins for the team as a whole, not for each member. "With real users" makes no user count; add a number only if it can be shown. RM10,000 is a ceiling we set, for one asset, before any drone; not a quote. The last line is about the fence and who checks it; it makes no claim about the children in V3 or what would have changed.

### V14: Closing hold

**TIME:** `4:37–4:47` · **VOICE:** Narrator · **PURPOSE:** the name's meaning, the team, the tagline.

**ON SCREEN:** Continue holding Deck 11, "10. Why Your Team Should Win", with the tagline, short thank-you and two QR cards: "safe-edge-two.vercel.app" (the demo) and "github.com/TolongLabs/safe-edge" (the code). Do not cut to a separate Thank You page. Hold to the end of the slot, about a second after the last word.

**DELIVERY:** The first sentence reveals the name's meaning and ties it to the work, as MyTakziah's "Survivor" reveal did; say it warmly. Then "We are Team T010NG" ("Team Tolong"), the tagline in three even beats, each a little lower, and stop after "Thank you".

**VOICEOVER:**

> Tolong is Malay for help, and that's what we're here to do. We are Team T010NG. Safe Edge: find it, fix it, prove it. [pause 0.5s] Thank you.

### Optional segments

Use these only when a take runs short, or for a longer cut. V12 adds 2 seconds (4:49). Team Information already appears in V1, so there is no separate V2 segment. A demo shot needs the same time trimmed elsewhere in the demo video, usually from D3's or D5's holds. No optional line replaces the simulation frame, the stories' limits or the full ask.

| Segment               | Time | Voice | On screen                                      | Voiceover                                                                                                            |
| --------------------- | ---: | ----- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| V12, Visual Concept   |  2 s | None  | Deck 10, "9. Visual Concept"                   | None; music only                                                                                                     |
| D3b, approve and send |  6 s | Demo  | Approve fix B as Lim Wei Jie; send to the crew | The engineer approves the full fix, and it goes to the crew.                                                         |
| D6, guardrail         | 12 s | Demo  | The Agent screen: "Refused, as it must be."    | And the AI? It reads records and drafts work, but it can't decide. Ask it to confirm a flag, and the server refuses. |

## Recording the voiceover

### The narrator

1.  **One team member reads everything outside the demo,** one file per segment, recorded whole, two or three takes each; keep the best. Don't stitch inside a segment. Files: `vo/V01.wav`, `vo/V03.wav` to `vo/V07.wav`, `vo/V09.wav`, `vo/V10.wav`, `vo/V11.wav`, `vo/V13.wav` and `vo/V14.wav`.
1.  **Room tone:** 10 seconds of silence in the same room at the same mic distance, `vo/room-tone.wav`. Leave 0.3 seconds of silence at the head and tail of every take.
1.  **Pronunciation:** T010NG is "Tolong" (TOH-long), one word; Bomba (BOM-bah); Mahkota Cheras (mah-KOH-tah CHEH-rahs); Kajang (KAH-jahng); Elmina (el-MEE-nah); SDP and Public Utilities Board as letters; MyTakziah (my-TAHK-zee-ah); ringgit (RING-git).
1.  **Pace:** about 150 words a minute with the marked pauses. Time each take against the "Read" column in [Timing](#timing). If it runs long, read the [pickup line](#pickup-lines) rather than rushing.
1.  **Speed-up (Director):** play every chosen take at 1.2× with ffmpeg's [`atempo`][atempo] filter, which changes the tempo and keeps the pitch: `ffmpeg -i vo/V09.wav -af atempo=1.2 -ar 48000 video/public/voice/V09.wav`. Pause marks are reading time; at 1.2×, a 0.6-second pause plays as 0.5 seconds. Listen to the first sped-up take before the narrator records the rest: every word must stay clear. Never speed a take past 1.2× to fit; read the pickup line instead.
1.  **Lines to cut first,** in this order, if the whole video runs long: "Bomba counted three hundred and seventy-one child and teen drowning deaths." (V3, about 4 s played; the slide shows the figure), then "with the whole history behind it" (D5, about 2.5 s). Cut whole phrases, and keep each segment's linking first sentence. Never cut the two stories, the Fix Lens introduction, the honesty line in V9, the team lines, the ask or the last line of V13.

### The demo voice

The narrator recorded the demo lines too, on 22 October: take 6 is V7 and takes 7 to 12 are Problem and D1 to D5. The words differ slightly from this script ("Alright, let's see it work", "So here's the problem", "and it suspends", "on the phone"); every claim is the same. [Build the demo video](/docs/demo/video.md#build-the-demo-video) stages them. The ElevenLabs plan is retired.

### Pickup lines

Each keeps every claim it makes.

| Segment | Pickup line                                                                                                                                                                                                                                                                     |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V1      | Hi, we're Team T010NG, in the People track. Our problem: keeping township lake and drain edges safe. Our answer is Safe Edge.                                                                                                                                                   |
| V3      | On the first of May, a nine-year-old girl went after her ball in a drain, and was swept away. Five months earlier, in Kajang, two brothers did the same. Neither survived. We don't know what those edges looked like. What we do know: after a storm, nobody walks every edge. |
| V4      | So accountability starts with the park maintenance manager in Elmina. And even a finished repair can leave a way round.                                                                                                                                                         |
| V5      | That's where Safe Edge comes in. For the repair, we built Fix Lens: it shows whether a repair closes every way to the water, before anyone pays.                                                                                                                                |
| V6      | The drone isn't new. What's new is what follows the flag. The proof is the product.                                                                                                                                                                                             |
| D3      | Now the hidden problem. A new panel closes one way to the water. The other stays open. Extending the fence would close both.                                                                                                                                                    |
| V9      | So how would we know it works? Before the repair, we count every confirmed open route, then measure how many are still closed at day thirty. That measures the hazard, not drownings. And the park must stay usable.                                                            |
| V10     | Better still, the software runs end to end, and the walk crew's phone can start now, with no aviation approval. We've capped the pilot at ten thousand ringgit. Drones come later, priced on top, after about two months of approvals.                                          |
| V11     | Therefore, the pilot is small and strict: we test Fix Lens against today's repair method, and scale only if it holds.                                                                                                                                                           |
| V13     | So why us? Three computer science and law students; two Grand Champion wins; every one of us has shipped to production. Ultimately, our ask: an eight-week pilot, a named owner, a ten-thousand-ringgit ceiling.                                                                |

## Claim guardrails

Say the first; never the second.

- "She was swept away" and "Neither survived", not "they drowned because a fence was missing", "someone failed them" or "Safe Edge would have saved them".
- "Simulated and labelled", not "our drone found", "a real flight" or "a site photo".
- "The park manager" (a role), not "SDP's manager told us" or "our user".
- "Mr. Eric, a former Head of Township at Sime Darby Property", not "SDP told us" or "SDP agrees".
- "Fix Lens maps every way" (that the person records), not "Fix Lens finds every route automatically".
- "Between us, we've won Grand Champion with Layak and with MyTakziah", not "we all won" or "this team won twice".
- "With real users", not a user count nobody can show.
- "A ceiling we set", not "it costs RM10,000".
- "About two months of approvals" (our estimate), not "approved" or "cleared".
- "Measures the hazard", not "prevents drowning" or "saves lives".
- "Our ask" and "the pilot we propose", not "SDP has agreed" or "our pilot site".
- "The software is built", not "DJI-ready" or "opens in DJI Pilot 2".

## Claims ledger

Status: **External** is a published source, **Team** is our own statement, research, consultation or design, **Code** is behaviour of the built software, **Simulated** is labelled sample data. "Deck N" is the slide position in the 11-page [`safe-edge-pitch-deck.html`](/docs/demo/deck/safe-edge-pitch-deck.html); "Supporting N" is the page in the separate six-page [`supporting-deck.html`](/docs/demo/deck/supporting-deck.html). Moral lines state a purpose, not a measured result.

| Claim as narrated                                                                                                         | Seg     | Status          | Source and limit                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------- | ------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| We are Team T010NG ("Tolong"); Tolong is Malay for help                                                                   | V1, V14 | Team            | The team's settled name; Deck 1                                                                                                           |
| The People track, safety and security                                                                                     | V1      | External        | [Brief][brief], "The challenge"; Deck 1                                                                                                   |
| Our problem: keeping the edges of township lakes and drains safe                                                          | V1      | Team            | Our chosen scope; [`PRODUCT.md`][product-problem]; Deck 1 and Deck 2                                                                      |
| On 1 May, in Bandar Mahkota Cheras, a nine-year-old girl went after her ball in a drain                                   | V3      | External        | [Incident table][incidents], row "1–3 May 2026"; Free Malaysia Today, 3 May 2026; Bernama                                                 |
| She was swept away and found ten kilometres away                                                                          | V3      | External        | The same row: found in Sungai Langat, about 10 km from the drain                                                                          |
| Five months earlier, in Kajang, two brothers went into a drain after a ball; neither survived                             | V3      | External        | [Incident table][incidents], row "4–6 Dec 2025"; Malay Mail, 5 Dec 2025; Bernama                                                          |
| We don't know what the edges of those drains looked like                                                                  | V3      | Team            | The reports establish no edge condition, fence, cover, fault, owner or cause                                                              |
| After a storm, nobody walks every edge                                                                                    | V3      | Team            | Deck 2 headline; [`PRODUCT.md`][product-problem]; the general problem, not a detail of either incident                                    |
| 371 child and teen drowning deaths                                                                                        | V3      | External        | Deck 2 `deaths` card; Supporting 1 line 1 (Bomba figures in The Star, 16 Oct 2026; Jan 2023 to Aug 2026, on the slide)                    |
| Mr. Eric, a former Head of Township at SDP: the bigger issue is accountability                                            | V3      | Team            | Deck 2 `quote` card; [consultation][consult], Part 2 A, written answers of 16 Oct 2026; named by the team                                 |
| The park maintenance manager in Elmina must keep every retained water edge closed                                         | V4      | Team            | Deck 3 `manager` card; a role, not a committed person                                                                                     |
| Even a finished repair can leave a way round the fence end                                                                | V4      | Team            | Deck 3 `way-round` line                                                                                                                   |
| A drone or phone spots the change; a named owner decides                                                                  | V5      | Team            | Deck 4 `patrol` step                                                                                                                      |
| Fix Lens maps every way to the water and shows whether a repair closes them all, before paying                            | V5      | Code            | Deck 4 `fix-lens` step; [`PRODUCT.md`](/docs/PRODUCT.md#fix-lens); [`PRD.md`][prd] FIX-1                                                  |
| A second person proves it; the edge earns a pass that expires                                                             | V5      | Team            | Deck 4 `proof` step                                                                                                                       |
| The drone isn't new; Singapore's Public Utilities Board already flies them                                                | V6      | External        | Deck 5 `exists` card; [prior art][prior-art] (Public Utilities Board reservoir and drain drones)                                          |
| What's new is what follows the flag: an owner, Fix Lens, independent proof                                                | V6      | Team            | Deck 5 `protocol` chain; [`PRODUCT.md`](/docs/PRODUCT.md#what-makes-it-different)                                                         |
| The drone is optional; the proof is the product                                                                           | V6      | Team            | [`PRODUCT.md`][product-principles], principle 9                                                                                           |
| Elmina's map is real; everything on it is simulated and labelled                                                          | V7      | Code            | Supporting 2 lines 1 and 6; the app's Simulation labels                                                                                   |
| A storm knocked out a panel; the record still says safe; nobody has checked                                               | Problem | Simulated       | The scene's story card headline                                                                                                           |
| The drone patrols, finds panel four missing, and suspends the pass                                                        | D1      | Simulated       | Scenario S1; the story's captions and labels; suspension is Code ([`PRD.md`][prd] WATCH-2)                                                |
| A machine can lower trust, never raise it; the manager confirms                                                           | D2      | Code            | [`PRODUCT.md`][product-principles], principle 1; [`PRD.md`][prd] INBOX-2                                                                  |
| Two ways to the water; a new panel closes one; extending the fence would close both                                       | D3      | Simulated       | Fix Lens on the S2 sample markings; the route-closure logic is Code ([`PRD.md`][prd] FIX-1)                                               |
| The crew can't sign off their own work; another person checks both routes, with reasons                                   | D4      | Code            | [`PRD.md`][prd] PROOF-1 and PROOF-2                                                                                                       |
| Both ways closed; the pass returns with its history; edges without a pass stay unknown                                    | D5      | Simulated       | The pass page and board in the demo; the rules are Code ([`PRODUCT.md`](/docs/PRODUCT.md#proof-and-edge-pass), principle 4)               |
| Before the repair, count every confirmed open route; measure how many are still closed at day thirty; target all          | V9      | Team            | Deck 7 main measure; [`PRODUCT.md`](/docs/PRODUCT.md#success-measures); [pilot method][pilot-impact]; a pilot measure and acceptance rule |
| It measures the hazard, not drownings                                                                                     | V9      | Team            | Deck 7 honesty line and speaker note; Supporting 6 line 5                                                                                 |
| We time how long each route stays open; the park must stay usable                                                         | V9      | Team            | Deck 7 speed and park cards; [pilot method][pilot-impact]                                                                                 |
| Families get tested edges; SDP gets a record to hand the council                                                          | V9      | Code            | Deck 7 value line; the handover pack ([`PRD.md`][prd] BOARD-4); no council has asked for it                                               |
| The software runs end to end, under automated tests                                                                       | V10     | Code            | Deck 8 built card; Supporting 3 line 1; software only, not a field trial                                                                  |
| The walk crew's phone can run the loop now, with SDP's permission and no aviation approval                                | V10     | Team            | Deck 8 phone card; [`PRODUCT.md`](/docs/PRODUCT.md#drone-integration-phases), phase 0.5; the other pilot conditions still apply           |
| A ten-thousand-ringgit cap, and half of it is the repair                                                                  | V10     | Team            | Deck 8 cost card; Supporting 4 lines 2 and 6 (RM5,000 of RM10,000; a ceiling we set, not a quote)                                         |
| Drones later, priced on top; Elmina is inside Subang's control zone; about two months of approvals                        | V10     | Team / External | Deck 8 drone card; Supporting 5; [`PRODUCT.md`](/docs/PRODUCT.md#drone-integration-phases) (CAAM rules); the two months are our estimate  |
| Test Fix Lens against today's repair method on the same evidence; say so if it isn't better; scale only if the gate holds | V11     | Team            | Deck 9 comparison step and gate; Deck 9 speaker note                                                                                      |
| We're three computer science and law students                                                                             | V13     | Team            | Team-reported, 22 Oct 2026; Deck 1                                                                                                        |
| Between us, we've won Grand Champion with Layak and with MyTakziah                                                        | V13     | Team            | Team-reported, 22 Oct 2026; Deck 11                                                                                                       |
| Every one of us has taken a project from zero to production, with real users                                              | V13     | Team            | Team-reported, 22 Oct 2026; no user count is claimed                                                                                      |
| The ask: eight weeks, one retained drain in Elmina Central Park, a named owner, RM10,000                                  | V13     | Team            | Deck 9 headline and footnote; Deck 11 `ask` card; Supporting 4 line 6 (a ceiling we set, before any drone)                                |

## Decisions for the team

**Settled:**

- **The team** is Team T010NG, said "Team Tolong": three computer science students, Hee Zi Jie, Lim Yuh Kang and Yow Li Hao (all Asia Pacific University), and a law graduate, Liau Jin Siang (University of Reading). Deck 1 shows all four.
- **The stories in V3** open the problem: the girl in Bandar Mahkota Cheras, then the brothers in Kajang. Nobody is named in any cut.
- **The team lines in V13** are the team's own account, as worded.
- **Voices:** one narrator for everything, including the demo video.

Left to do before recording:

1.  **Pick the narrator and the ElevenLabs voice** at gate G1.
1.  **Check Mr. Eric is happy to be named** in a public video. If not, say "a former Head of Township at Sime Darby Property" instead; the timing barely changes.

## Shot checklist

Tick each when the footage is in and checked.

- [ ] Story card 1 (V3): near-black, "Bandar Mahkota Cheras · 1 May 2026", source "Free Malaysia Today, 3 May 2026". Made in the edit.
- [ ] Story card 2 (V3): the same design, "Kajang · 4 December 2025", source "Malay Mail, 5 December 2025". Made in the edit.
- [ ] H2 (V5, optional): the landing page hero.
- [ ] The demo video (V7 and V8), 77 seconds, with its chapter bar and the narrator's takes 6 to 12:
  - [ ] H1, Problem: the Elmina lake at night with the story card headline.
  - [ ] D1, Find: take-off, then the flag and the red segment.
  - [ ] D2, Confirm: the Inbox; **Confirm: needs a fix**.
  - [ ] D3, Fix: Fix Lens; the sample markings, the two sample fixes, fix B picked.
  - [ ] D4, Prove: the phone repair check, to **Sign and issue the pass**.
  - [ ] D5, Outcome: the pass page and history, then the Passes board.
- [ ] D7 (V10, optional): the Developers screen's Quickstart.
- [ ] D3b and D6 (optional): approve and send; the guardrail.
- [ ] Slides: Deck 1 to 9 and Deck 11; Deck 10 for the optional V12 cut. V13 and V14 share Deck 11.

## Sources

- [Video plan and capture](/docs/demo/video.md), with the shot list and the timeline.
- [Pitch deck](/docs/demo/deck/safe-edge-pitch-deck.html): 11 submission slides and their speaker notes; [supporting deck](/docs/demo/deck/supporting-deck.html): six evidence pages, exported separately.
- [`PRODUCT.md`][product-principles], [`BRIEF.md`][brief], [`CONTEXT.md`](/docs/CONTEXT.md#five-minute-video) and the [PRD demo script](/docs/PRD.md#demo-script).
- [Incident table][incidents], [practitioner consultation][consult] and [prior art][prior-art].
- [Mission export evidence][mission-exports], the reason the narration never mentions a vendor's flight app.
- ElevenLabs: [text to speech with timestamps][el-timestamps], [request stitching][el-stitching] and [pauses][el-pauses].

[brief]: /docs/BRIEF.md#the-challenge
[incidents]: /docs/research/niche-problems/drowning/drowning-incidents.md
[consult]: /docs/research/consultations/township-practitioner.md
[prior-art]: /docs/research/drone-integration/prior-art.md
[mission-exports]: /docs/evidence/mission-exports.md
[product-problem]: /docs/PRODUCT.md#problem
[product-principles]: /docs/PRODUCT.md#product-principles
[prd]: /docs/PRD.md#requirements
[el-timestamps]: https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps
[el-stitching]: https://elevenlabs.io/docs/eleven-api/guides/how-to/text-to-speech/request-stitching
[el-pauses]: https://elevenlabs.io/docs/help-center/technical/do-pauses-and-ssml-phoneme-tags-work-with-the-api
[atempo]: https://ffmpeg.org/ffmpeg-filters.html#atempo
[pilot-impact]: /docs/research/shortlist/safe-edge.md#impact-and-how-we-measure-it
