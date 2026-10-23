// The demo cut, as data. Times are seconds from the start of their part, and most are set on a
// spoken word, so the picture follows the voice. Camera framings and rings are in source pixels.
import { cue, voiceLength, word, type Box, type ShotId, type VoiceId } from './lib'

export type Framing = { at: number; x: number; y: number; z: number; move?: number }
export type Ring = { from: number; to: number; box: Box }
export type Clip = {
  shot: ShotId
  from: number
  srcIn: number
  rate?: number
  /** Hold the in-point frame for the whole clip. */
  freeze?: boolean
  /** Dissolve in from the clip before, over this many seconds. */
  fadeIn?: number
  camera: Framing[]
  rings?: Ring[]
}
export type Callout = {
  from: number
  to: number
  text: string
  tone: 'danger' | 'valid' | 'neutral'
  x: number
  y: number
}
/** One phone in a storyboard: it appears at `from`, plays from `srcIn`, and holds its last frame from `holdAt`. */
export type Panel = { label: string; from: number; srcIn: number; holdAt: number }
export type Part = {
  id: string
  voice: VoiceId
  chapter: 0 | 1 | 2 | null
  step?: 'Find' | 'Confirm' | 'Fix' | 'Prove'
  lead: number
  tail: number
  clips: Clip[]
  callouts: Callout[]
  /** A deck slide that fills the frame, then shrinks into the app window at `shrinkAt`. */
  slide?: { src: string; shrinkAt: number }
  /** Phone screens side by side, joined by arrows, instead of clips. */
  board?: Panel[]
  /** Steps beside the phone that tick as each one happens, shown until `until`. */
  checklist?: { title: string; items: { label: string; at: number }[]; until: number }
}

const LEAD = 0.35
const END = 99 // until the part ends
const at =
  (v: VoiceId) =>
  (text: string, nth = 1) =>
    LEAD + word(v, text, nth)
const whole = (t: number): Framing => ({ at: t, x: 960, y: 540, z: 1 })
/** The in-point that makes `cueId` land at part time `when`, for a clip starting at `from`. */
const sync = (s: ShotId, cueId: string, when: number, from: number, rate = 1) => {
  const srcIn = cue(s, cueId) - (when - from) * rate
  if (srcIn < 0) throw new Error(`${s}: ${cueId} can't land at ${when.toFixed(2)} s; the take starts too late`)
  return srcIn
}

export function partLength(p: Part) {
  return p.lead + voiceLength(p.voice) + p.tail
}

const intro = at('intro')
const problem = at('problem')
const d1 = at('d1')
const d2 = at('d2')
const d3 = at('d3')
const d4 = at('d4')
const d5 = at('d5')
const report = at('report')
const ai = at('ai')
const engineer = at('engineer')

// Source boxes measured on the final takes (desktop 1920 × 1080).
const BOX = {
  simBanner: { x: 746, y: 10, width: 428, height: 30 },
  consequence: { x: 636, y: 158, width: 522, height: 28 },
  gapOpening: { x: 672, y: 436, width: 86, height: 204 },
  endOpening: { x: 1102, y: 436, width: 86, height: 204 },
  wayGap: { x: 1284, y: 912, width: 576, height: 52 },
  wayEnd: { x: 1284, y: 992, width: 576, height: 52 },
  fixBHeader: { x: 1108, y: 290, width: 480, height: 26 },
  passClosed: { x: 450, y: 544, width: 440, height: 40 },
  reportRow: { x: 284, y: 544, width: 284, height: 68 },
  refusal: { x: 650, y: 395, width: 1230, height: 95 },
  approveB: { x: 1116, y: 924, width: 741, height: 32 },
  owner: { x: 1380, y: 300, width: 495, height: 130 },
  sendB: { x: 762, y: 996, width: 280, height: 44 },
  reportSource: { x: 958, y: 364, width: 222, height: 30 },
  unknownLine: { x: 278, y: 142, width: 528, height: 24 }
}

const simBanner = { x: 960, y: 25, z: 1.8 }

// Deck 6 ("5. How It Works") carries "let's see it work, from problem to outcome", then shrinks into the
// app window, and the map arrives on "Elmina's map is real".
const SLIDE_SHRINK = intro('outcome') + 0.45
export const MAP_IN = SLIDE_SHRINK + 0.5
const INTRO: Part = {
  id: 'Intro',
  voice: 'intro',
  chapter: null,
  lead: LEAD,
  tail: 0.3,
  slide: { src: 'slides/S06.png', shrinkAt: SLIDE_SHRINK },
  clips: [
    {
      shot: 'H1',
      from: MAP_IN,
      srcIn: 0,
      camera: [whole(0), { at: intro('simulated'), ...simBanner, move: 1.1 }],
      rings: [{ from: intro('everything'), to: END, box: BOX.simBanner }]
    }
  ],
  callouts: []
}

// A slow push on the held photo (clear of the Openings panel), then out to the markings and the ways list.
const fixLensMarked: Framing[] = [
  whole(0),
  { at: 2.0, x: 712, y: 485, z: 1.72, move: 0.9 },
  { at: 4.2, x: 736, y: 485, z: 1.8, move: 2.2 },
  { at: 5.0, x: 1072, y: 616, z: 1.2, move: 0.8 }
]
// The flag clip cuts in on "missing", two frames before the stretch turns red.
const flagFrom = d1('missing') - 0.25
const flagIn = cue('D1', 'd1-flag') - (d1('missing') - 0.18 - flagFrom) * 0.8
// The confirmed finding appears just before "gap"; the pointer's move to the button plays at full speed.
const CONFIRM_CLICK_FROM = 6.4
const confirmIn = sync('D2', 'd2-finding', d2('gap') - 0.1, CONFIRM_CLICK_FROM)
const compareFrom = d3('new', 2) - 0.45
const approveFrom = engineer('approves') + 0.5 - (cue('D3b-approve', 'd3b-approved') - 0.05)
const sendFrom = engineer('b') + 0.45
const sendRow = { x: 700, y: 1080, z: 1.45 }
const fixA = { x: 840, y: 600, z: 1.42 }
const fixB = { x: 1486, y: 600, z: 1.42 }
export const PARTS: Part[] = [
  INTRO,
  {
    id: 'Problem',
    voice: 'problem',
    chapter: 0,
    lead: LEAD,
    tail: 0.8,
    clips: [
      {
        shot: 'H1',
        from: 0,
        srcIn: partLength(INTRO) - MAP_IN,
        // Eases out of the intro's push on the Simulation banner, then into the story card.
        camera: [
          { at: 0, ...simBanner },
          { ...whole(0.6), move: 0.6 },
          { at: problem('last'), x: 300, y: 880, z: 1.75, move: 1.2 }
        ]
      }
    ],
    // On the green (still "safe") edge that runs along the top of this framing.
    callouts: [{ from: problem('record'), to: END, text: 'Still marked safe', tone: 'danger', x: 760, y: 260 }]
  },
  {
    id: 'Find',
    voice: 'd1',
    chapter: 1,
    step: 'Find',
    lead: LEAD,
    tail: 1.1,
    clips: [
      { shot: 'D1', from: 0, srcIn: 17.5, camera: [whole(0)] },
      // The drone flies along the playground edge, framed clear of the story's caption and its privacy label.
      { shot: 'D1', from: d1('after') - 0.3, srcIn: 37.0, rate: 1.2, camera: [{ at: 0, x: 900, y: 480, z: 1.5 }] },
      {
        shot: 'D1',
        from: flagFrom,
        // Slowed to 0.8 so the next caption never appears.
        srcIn: flagIn,
        rate: 0.8,
        camera: [
          { at: 0, x: 900, y: 600, z: 1.15 },
          { at: d1('suspends'), x: 900, y: 620, z: 1.25, move: 0.9 }
        ]
      },
      // Held before the story's next caption ("The park manager compares…") and its daylight change.
      {
        shot: 'D1',
        from: flagFrom + (62.95 - flagIn) / 0.8,
        srcIn: 62.95,
        freeze: true,
        camera: [{ at: 0, x: 900, y: 620, z: 1.25 }]
      }
    ],
    callouts: [{ from: d1('suspends'), to: END, text: 'Pass suspended', tone: 'danger', x: 1450, y: 300 }]
  },
  {
    id: 'Report',
    voice: 'report',
    chapter: 1,
    step: 'Find',
    lead: LEAD,
    tail: 0.6,
    // Four moments of the walk crew's report, each ticked off beside the phone, then the manager's Inbox.
    clips: [
      // The photo is sent from the viewpoint, then "Report a problem" opens the form.
      {
        shot: 'R1-phone',
        from: 0,
        srcIn: cue('R1-phone', 'r1-photo') - 0.2,
        camera: [{ at: 0, x: 390, y: 500, z: 1.4 }]
      },
      // What they saw: "Fence or barrier missing".
      {
        shot: 'R1-phone',
        from: report('patrol') - 0.4,
        srcIn: sync('R1-phone', 'r1-type', report('patrol'), report('patrol') - 0.4),
        fadeIn: 0.15,
        camera: [{ at: 0, x: 390, y: 843, z: 1.4 }]
      },
      // How urgent: "High · A gap someone could walk through to the water".
      {
        shot: 'R1-phone',
        from: report('from') - 0.35,
        srcIn: sync('R1-phone', 'r1-urgency', report('from') + 0.05, report('from') - 0.35),
        fadeIn: 0.15,
        camera: [{ at: 0, x: 390, y: 1130, z: 1.4 }]
      },
      // "Report sent to the manager."
      {
        shot: 'R1-phone',
        from: report('and', 2) - 0.35,
        srcIn: sync('R1-phone', 'r1-sent', report('and', 2) + 0.05, report('and', 2) - 0.35),
        fadeIn: 0.15,
        camera: [{ at: 0, x: 390, y: 300, z: 1.4 }]
      },
      // The manager's Inbox, whole: the new walk-crew report, opened.
      {
        shot: 'R1-inbox',
        from: report('lands') - 0.05,
        srcIn: 2.2,
        camera: [whole(0)],
        rings: [
          { from: report('lands') + 0.1, to: END, box: BOX.reportRow },
          { from: report('lands') + 0.1, to: END, box: BOX.reportSource }
        ]
      }
    ],
    callouts: [],
    checklist: {
      title: 'Walk crew report',
      items: [
        { label: 'Photo', at: 0.25 },
        { label: 'What they saw', at: report('patrol') + 0.05 },
        { label: 'How urgent', at: report('from') + 0.1 },
        { label: 'Sent to the manager', at: report('and', 2) + 0.1 }
      ],
      until: report('lands') - 0.05
    }
  },
  {
    id: 'Agent',
    voice: 'ai',
    chapter: 1,
    step: 'Confirm',
    lead: LEAD,
    tail: 0.9,
    clips: [
      // The Agent screen, held: its tools only read and draft.
      {
        shot: 'D6',
        from: 0,
        srcIn: 0.2,
        freeze: true,
        camera: [
          whole(0),
          { at: ai('reads') + 0.2, x: 640, y: 540, z: 1.5, move: 0.8 },
          { at: ai('decide'), x: 1260, y: 300, z: 1.5, move: 0.8 }
        ]
      },
      // Asked to confirm a flag, the server refuses (slowed to 0.85 so the refusal lands on "server").
      {
        shot: 'D6',
        from: ai('ask') - 0.15,
        srcIn: sync('D6', 'd6-refused', ai('server'), ai('ask') - 0.15, 0.85),
        rate: 0.85,
        camera: [{ at: 0, x: 1260, y: 300, z: 1.5 }],
        rings: [{ from: ai('refuses'), to: END, box: BOX.refusal }]
      }
    ],
    callouts: [{ from: ai('decide'), to: END, text: 'Only people decide', tone: 'neutral', x: 1400, y: 990 }]
  },
  {
    id: 'Confirm',
    voice: 'd2',
    chapter: 1,
    step: 'Confirm',
    lead: LEAD,
    tail: 0.9,
    clips: [
      // The Inbox is still until the pointer moves, so it is slowed to hold through the first lines.
      {
        shot: 'D2',
        from: 0,
        srcIn: 0.1,
        rate: (confirmIn - 0.1) / CONFIRM_CLICK_FROM,
        camera: [
          whole(0),
          { at: 1.8, x: 980, y: 318, z: 1.7, move: 0.8 },
          { at: d2('person'), x: 1258, y: 600, z: 1.15, move: 0.9 },
          { at: d2('compares'), x: 1258, y: 474, z: 1.45, move: 0.8 }
        ],
        rings: [{ from: 1.8, to: d2('so'), box: BOX.consequence }]
      },
      {
        shot: 'D2',
        from: CONFIRM_CLICK_FROM,
        srcIn: confirmIn,
        camera: [
          { at: 0, x: 1258, y: 474, z: 1.45 },
          { at: d2('confirms') + 0.1, x: 1100, y: 610, z: 1.15, move: 0.9 }
        ]
      }
    ],
    callouts: [
      { from: d2('person'), to: d2('confirms') - 0.25, text: 'A person decides', tone: 'neutral', x: 1400, y: 990 }
    ]
  },
  {
    id: 'Fix',
    voice: 'd3',
    chapter: 1,
    step: 'Fix',
    lead: LEAD,
    tail: 1.0,
    clips: [
      // The photo with the gap, held; then the sample markings arrive on "Fix Lens maps".
      { shot: 'D3', from: 0, srcIn: 0.1, freeze: true, camera: fixLensMarked },
      { shot: 'D3', from: 1.8, srcIn: 0.1, camera: fixLensMarked },
      {
        shot: 'D3',
        from: 5.2,
        srcIn: 3.5,
        freeze: true,
        camera: fixLensMarked,
        rings: [
          { from: d3('through'), to: d3('around'), box: BOX.gapOpening },
          { from: d3('through'), to: d3('around'), box: BOX.wayGap },
          { from: d3('around'), to: END, box: BOX.endOpening },
          { from: d3('around'), to: END, box: BOX.wayEnd }
        ]
      },
      // Fix A leaves a way open; fix B would close both and is picked on "chooses".
      {
        shot: 'D3',
        from: compareFrom,
        srcIn: sync('D3', 'd3-pick-b', d3('chooses'), compareFrom),
        camera: [whole(0), { at: d3('other'), ...fixA, move: 1.2 }, { at: d3('extending') + 0.8, ...fixB, move: 0.9 }],
        rings: [{ from: d3('chooses') - 0.3, to: END, box: BOX.fixBHeader }]
      }
    ],
    callouts: [
      // Beside fix A's red "Still open" route; then over fix B's drawing. B is a proposal, so "would".
      { from: d3('other'), to: d3('extending') - 0.1, text: 'Route still open', tone: 'danger', x: 1120, y: 360 },
      { from: d3('both', 2), to: d3('anyone'), text: 'Would close both', tone: 'valid', x: 940, y: 470 }
    ]
  },
  {
    id: 'Engineer',
    voice: 'engineer',
    chapter: 1,
    step: 'Fix',
    lead: LEAD,
    tail: 0.7,
    clips: [
      // Signed in as Lim Wei Jie, the engineer: the whole page, then fix B's approve button.
      {
        shot: 'D3b-approve',
        from: 0,
        srcIn: 0.05,
        freeze: true,
        camera: [whole(0), { at: approveFrom + 0.05, x: 1486, y: 650, z: 1.42, move: 0.7 }]
      },
      // The click plays out live, landing "Approved by Lim Wei Jie" just after "approves".
      {
        shot: 'D3b-approve',
        from: approveFrom,
        srcIn: sync('D3b-approve', 'd3b-approved', engineer('approves') + 0.5, approveFrom),
        camera: [{ at: 0, x: 1486, y: 650, z: 1.42 }],
        rings: [{ from: engineer('approves') + 0.5, to: END, box: BOX.approveB }]
      },
      // The manager's send button, held: the whole page first, then the installer, due date and button.
      {
        shot: 'D3b-send',
        from: sendFrom,
        srcIn: cue('D3b-send', 'd3b-sent') - 0.16,
        freeze: true,
        camera: [whole(0), { at: 0.7, ...sendRow, move: 0.6 }],
        rings: [{ from: engineer('and', 1), to: END, box: BOX.sendB }]
      },
      // The click: "Fix B sent to Hafiz Rahman's crew", then its owner and its re-tester.
      {
        shot: 'D3b-send',
        from: engineer('goes') - 0.06,
        srcIn: sync('D3b-send', 'd3b-sent', engineer('goes') + 0.1, engineer('goes') - 0.06),
        camera: [
          { at: 0, ...sendRow },
          { ...whole(0), at: engineer('goes') + 0.08, move: 0.01 },
          { at: engineer('named'), x: 1600, y: 360, z: 1.6, move: 0.9 }
        ],
        rings: [{ from: engineer('named'), to: END, box: BOX.owner }]
      }
    ],
    callouts: []
  },
  {
    id: 'Prove',
    voice: 'd4',
    chapter: 1,
    step: 'Prove',
    lead: LEAD,
    tail: 1.8,
    clips: [],
    callouts: [],
    // Three phones, left to right: not the installer; both routes checked with reasons; signed, pass issued.
    board: [
      // The history scrolls to "A different person checks this repair … You did not install it".
      { label: 'Not the installer', from: 0, srcIn: 1.0, holdAt: d4('someone') - 0.05 },
      // Route one is already passed; route two is passed and its reason typed on "each with a written reason".
      { label: 'Checks both routes', from: d4('someone') - 0.05, srcIn: 12.5, holdAt: d4('reason') + 0.5 },
      // The reviewer signs; the pass is issued.
      {
        label: 'Signs, pass issued',
        from: d4('reason') + 0.5,
        srcIn: sync('D4', 'd4-issued', d4('reason') + 1.05, d4('reason') + 0.5),
        holdAt: END
      }
    ]
  },
  {
    id: 'Outcome',
    voice: 'd5',
    chapter: 2,
    lead: LEAD,
    tail: 1.6,
    clips: [
      {
        shot: 'D5-pass',
        from: 0,
        srcIn: 0.1,
        // The new pass and its whole history side by side, then into the history.
        camera: [
          whole(0),
          { at: 2.2, x: 1155, y: 580, z: 1.3, move: 1.0 },
          { at: d5('history') - 1.0, x: 1155, y: 580, z: 1.35, move: d5('history') - 3.2 },
          { at: d5('history'), x: 1484, y: 581, z: 1.45, move: 1.0 }
        ],
        rings: [{ from: d5('both'), to: d5('gets'), box: BOX.passClosed }]
      },
      {
        shot: 'D5-board',
        from: d5('edges') - 0.22,
        srcIn: cue('D5-board', 'd5-board') + 0.1,
        camera: [whole(0), { at: d5('unknown') + 0.2, x: 760, y: 300, z: 1.7, move: 0.9 }],
        rings: [{ from: d5('unknown') + 0.2, to: END, box: BOX.unknownLine }]
      }
    ],
    // The app issues a new pass (valid to 23 Oct 2027), so the callout says so.
    callouts: [{ from: d5('truth'), to: d5('with') - 0.1, text: 'New pass issued', tone: 'valid', x: 640, y: 210 }]
  }
]
