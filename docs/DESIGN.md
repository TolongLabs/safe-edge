---
name: Safe Edge
description: Park-wayfinding dashboard and phone app that track every township water edge from drone flag to proven fix.
colors:
  bg-canvas: '#e7ebe8'
  bg-canvas-dark: '#111a17'
  bg-surface: '#fbfcfb'
  bg-surface-dark: '#1c2925'
  bg-sunken: '#eef2ef'
  bg-sunken-dark: '#111a17'
  bg-raised: '#ffffff'
  bg-raised-dark: '#24302c'
  bg-inverse: '#1c2925'
  bg-inverse-dark: '#fbfcfb'
  bg-rail: '#17302a'
  bg-rail-dark: '#24443b'
  bg-rail-hover: '#24443b'
  bg-rail-hover-dark: '#33594d'
  border-default: '#cfd6d2'
  border-default-dark: '#3a4743'
  border-strong: '#8e9994'
  border-strong-dark: '#6f7b76'
  border-focus: '#24443b'
  border-focus-dark: '#9fb5ac'
  text-primary: '#1c2925'
  text-primary-dark: '#fbfcfb'
  text-secondary: '#5d6b66'
  text-secondary-dark: '#b4bdb8'
  text-disabled: '#8e9994'
  text-disabled-dark: '#5d6b66'
  text-inverse: '#ffffff'
  text-inverse-dark: '#1c2925'
  text-on-accent: '#ffffff'
  text-on-accent-dark: '#0d1d19'
  text-link: '#17302a'
  text-link-dark: '#9fb5ac'
  text-on-rail: '#e6eeea'
  text-on-rail-muted: '#9fb5ac'
  accent-default: '#17302a'
  accent-default-dark: '#7fa596'
  accent-hover: '#24443b'
  accent-hover-dark: '#c9d9d1'
  accent-subtle: '#e6eeea'
  accent-subtle-dark: '#0d1d19'
  danger-default: '#b02e28'
  danger-default-dark: '#ef8a80'
  danger-hover: '#8e231e'
  danger-hover-dark: '#fbe9e7'
  danger-text: '#b02e28'
  danger-text-dark: '#ef8a80'
  state-valid-fg: '#237446'
  state-valid-fg-dark: '#6cc495'
  state-valid-bg: '#e3f1e8'
  state-valid-bg-dark: '#10291b'
  state-expiring-fg: '#94500e'
  state-expiring-fg-dark: '#f0b06a'
  state-expiring-bg: '#fbeedd'
  state-expiring-bg-dark: '#2e1f0c'
  state-suspended-fg: '#b02e28'
  state-suspended-fg-dark: '#ef8a80'
  state-suspended-bg: '#fbe9e7'
  state-suspended-bg-dark: '#3a1412'
  state-expired-fg: '#5b6763'
  state-expired-fg-dark: '#aab3af'
  state-expired-bg: '#eceeed'
  state-expired-bg-dark: '#1f2523'
  state-unknown-fg: '#5d6b66'
  state-unknown-fg-dark: '#8e9994'
  state-unknown-bg: '#eef2ef'
  state-unknown-bg-dark: '#24302c'
  simulation-bg: '#1c2925'
  simulation-bg-dark: '#fbfcfb'
  simulation-fg: '#ffffff'
  simulation-fg-dark: '#1c2925'
  simulation-subtle: '#eef2ef'
  simulation-subtle-dark: '#24302c'
  selection-bg: '#c9d9d1'
  selection-bg-dark: '#24443b'
  selection-fg: '#1c2925'
  selection-fg-dark: '#fbfcfb'
  route-line: '#17302a'
  route-line-dark: '#7fa596'
  scene-water: '#aab3af'
  scene-water-dark: '#5b6763'
typography:
  display:
    fontFamily: 'Atkinson Hyperlegible Next, system-ui, sans-serif'
    fontSize: '30px'
    fontWeight: 600
    lineHeight: '36px'
    letterSpacing: '-0.005em'
  h1:
    fontFamily: 'Atkinson Hyperlegible Next, system-ui, sans-serif'
    fontSize: '26px'
    fontWeight: 600
    lineHeight: '32px'
    letterSpacing: '-0.005em'
  h2:
    fontFamily: 'Atkinson Hyperlegible Next, system-ui, sans-serif'
    fontSize: '20px'
    fontWeight: 600
    lineHeight: '26px'
  h3:
    fontFamily: 'Atkinson Hyperlegible Next, system-ui, sans-serif'
    fontSize: '16px'
    fontWeight: 600
    lineHeight: '22px'
  body:
    fontFamily: 'Atkinson Hyperlegible Next, system-ui, sans-serif'
    fontSize: '15px'
    fontWeight: 400
    lineHeight: '22px'
  body-dense:
    fontFamily: 'Atkinson Hyperlegible Next, system-ui, sans-serif'
    fontSize: '14px'
    fontWeight: 400
    lineHeight: '20px'
  label:
    fontFamily: 'Atkinson Hyperlegible Next, system-ui, sans-serif'
    fontSize: '14px'
    fontWeight: 500
    lineHeight: '20px'
  label-small:
    fontFamily: 'Atkinson Hyperlegible Next, system-ui, sans-serif'
    fontSize: '12px'
    fontWeight: 500
    lineHeight: '16px'
  label-strong:
    fontFamily: 'Atkinson Hyperlegible Next, system-ui, sans-serif'
    fontSize: '15px'
    fontWeight: 600
    lineHeight: '20px'
  overline:
    fontFamily: 'Atkinson Hyperlegible Next, system-ui, sans-serif'
    fontSize: '12px'
    fontWeight: 700
    lineHeight: '16px'
    letterSpacing: '0.06em'
  code-plate:
    fontFamily: 'Atkinson Hyperlegible Next, system-ui, sans-serif'
    fontSize: '14px'
    fontWeight: 700
    lineHeight: '20px'
    letterSpacing: '0.02em'
  code-small:
    fontFamily: 'Atkinson Hyperlegible Next, system-ui, sans-serif'
    fontSize: '12px'
    fontWeight: 600
    lineHeight: '16px'
    letterSpacing: '0.01em'
rounded:
  none: '0px'
  sm: '4px'
  md: '8px'
  lg: '12px'
  island: '16px'
  full: '999px'
spacing:
  '0': '0px'
  '1': '4px'
  '2': '8px'
  '3': '12px'
  '4': '16px'
  '5': '20px'
  '6': '24px'
  '8': '32px'
  '10': '40px'
  '12': '48px'
  '16': '64px'
components:
  button-primary:
    backgroundColor: '{colors.accent-default}'
    textColor: '{colors.text-on-accent}'
    typography: '{typography.label-strong}'
    rounded: '{rounded.md}'
    padding: '0 20px'
    height: '44px'
  button-primary-hover:
    backgroundColor: '{colors.accent-hover}'
    textColor: '{colors.text-on-accent}'
  button-secondary:
    backgroundColor: '{colors.bg-surface}'
    textColor: '{colors.accent-default}'
    typography: '{typography.label-strong}'
    rounded: '{rounded.md}'
    padding: '0 20px'
    height: '44px'
  button-quiet:
    backgroundColor: '{colors.bg-surface}'
    textColor: '{colors.accent-default}'
    typography: '{typography.label-strong}'
    rounded: '{rounded.md}'
    padding: '0 20px'
    height: '44px'
  button-danger:
    backgroundColor: '{colors.bg-surface}'
    textColor: '{colors.danger-text}'
    typography: '{typography.label-strong}'
    rounded: '{rounded.md}'
    padding: '0 20px'
    height: '44px'
  button-disabled:
    backgroundColor: '{colors.bg-sunken}'
    textColor: '{colors.text-disabled}'
  island:
    backgroundColor: '{colors.bg-surface}'
    rounded: '{rounded.island}'
    padding: '28px'
  rail:
    backgroundColor: '{colors.bg-rail}'
    textColor: '{colors.text-on-rail}'
    rounded: '{rounded.island}'
    width: '232px'
  rail-collapsed:
    backgroundColor: '{colors.bg-rail}'
    rounded: '{rounded.island}'
    width: '72px'
  rail-item:
    textColor: '{colors.text-on-rail}'
    typography: '{typography.label-strong}'
    rounded: '{rounded.md}'
    padding: '0 12px 0 8px'
    height: '44px'
  rail-item-active:
    backgroundColor: '{colors.text-on-rail}'
    textColor: '{colors.bg-rail}'
  top-bar:
    backgroundColor: '{colors.bg-surface}'
    rounded: '{rounded.island}'
    height: '64px'
  flag-row:
    backgroundColor: '{colors.bg-surface}'
    textColor: '{colors.text-primary}'
    typography: '{typography.label-strong}'
    rounded: '{rounded.md}'
    padding: '12px 16px'
  flag-row-selected:
    backgroundColor: '{colors.bg-rail}'
    textColor: '{colors.text-on-rail}'
  text-field:
    backgroundColor: '{colors.bg-raised}'
    textColor: '{colors.text-primary}'
    typography: '{typography.body}'
    rounded: '{rounded.md}'
    padding: '0 12px'
    height: '44px'
  chip:
    backgroundColor: '{colors.bg-raised}'
    textColor: '{colors.text-primary}'
    typography: '{typography.label}'
    rounded: '{rounded.sm}'
    padding: '3px 8px'
    height: '28px'
  code-plate:
    backgroundColor: '{colors.bg-rail}'
    textColor: '{colors.text-on-rail}'
    typography: '{typography.code-plate}'
    rounded: '{rounded.sm}'
    padding: '4px 8px'
  pass-badge-valid:
    backgroundColor: '{colors.state-valid-bg}'
    textColor: '{colors.state-valid-fg}'
    typography: '{typography.label}'
    rounded: '{rounded.sm}'
    padding: '3px 8px'
  pass-badge-expiring:
    backgroundColor: '{colors.state-expiring-bg}'
    textColor: '{colors.state-expiring-fg}'
  pass-badge-expired:
    backgroundColor: '{colors.state-expired-bg}'
    textColor: '{colors.state-expired-fg}'
  pass-badge-suspended:
    backgroundColor: '{colors.state-suspended-bg}'
    textColor: '{colors.state-suspended-fg}'
  pass-badge-none:
    backgroundColor: '{colors.state-unknown-bg}'
    textColor: '{colors.state-unknown-fg}'
  simulation-badge:
    textColor: '{colors.text-primary}'
    typography: '{typography.overline}'
    rounded: '{rounded.sm}'
    padding: '2px 8px'
  banner-warning:
    backgroundColor: '{colors.state-expiring-bg}'
    textColor: '{colors.text-primary}'
    rounded: '{rounded.md}'
    padding: '12px 16px'
  banner-error:
    backgroundColor: '{colors.state-suspended-bg}'
    textColor: '{colors.text-primary}'
    rounded: '{rounded.md}'
    padding: '12px 16px'
  evidence-frame:
    backgroundColor: '{colors.bg-surface}'
    textColor: '{colors.text-primary}'
    typography: '{typography.label}'
    rounded: '{rounded.md}'
  pass-fail:
    height: '44px'
---

# Design System: Safe Edge

This is the visual spec for the Safe Edge dashboard, phone app and landing page. It is written from the approved Figma file, [Safe Edge design system](https://www.figma.com/design/6KoP9X4g8nIYJXtTce7Bov/Safe-Edge-design-system), and the tokens above are its variables. When this file and Figma disagree, ask which one is current. Product truth lives in [PRODUCT.md](PRODUCT.md).

Contents:

1.  [Overview](#overview)
1.  [Colors](#colors)
    1.  [Primary](#primary)
    1.  [Pass states](#pass-states)
    1.  [Neutral](#neutral)
    1.  [Color rules](#color-rules)
1.  [Typography](#typography)
    1.  [Hierarchy](#hierarchy)
    1.  [Type rules](#type-rules)
1.  [Layout](#layout)
1.  [Elevation & Depth](#elevation--depth)
    1.  [Shadow Vocabulary](#shadow-vocabulary)
1.  [Shapes](#shapes)
1.  [Components](#components)
    1.  [Buttons](#buttons)
    1.  [Chips and badges](#chips-and-badges)
    1.  [Cards / Containers](#cards--containers)
    1.  [Inputs / Fields](#inputs--fields)
    1.  [Navigation](#navigation)
    1.  [Signature components](#signature-components)
    1.  [States: empty, loading, error](#states-empty-loading-error)
1.  [Do's and Don'ts](#dos-and-donts)
1.  [See also](#see-also)

## Overview

**Creative North Star: "Park Wayfinding"**

Every water edge reads like a route through a park: a line of numbered stops, each stop a segment wearing its pass state. The palette borrows from park signage: a mineral-grey ground, off-white islands that hold the work, and a dark park-green rail and code plates with white type. The tone is calm and exact. A missing fence is serious, but the screen states the fact, the consequence and the next step, and never shouts.

The interface is built for a non-technical reader in a hurry. Each screen answers one question and offers one primary action: "Is this a real problem?", "Which fix closes every way to the water?", "Does the repair pass?". Plain place names lead ("Central Park Lake, by the playground"); segment codes such as LK·S12 follow as small plates. Simulated data is always labelled.

The system rejects the KPI-tile operations dashboard and the dark CCTV wall. State is carried by shape as well as colour, so it survives glare, colour blindness and greyscale print.

**Key Characteristics:**

- Mineral-grey canvas with solid off-white islands (16 px corners) and 12 px gutters.
- A dark park-green rail that collapses from 232 px to 72 px, with the logo as its toggle.
- One typeface, Atkinson Hyperlegible Next, chosen for legibility outdoors.
- Five pass states, each a distinct shape and colour.
- One primary action per screen; the negative action sits apart, in outline.
- Light and Dark modes from the same tokens.

## Colors

A restrained park palette: green-black ink for structure and action, three signal hues kept for pass states, and greys for everything else.

### Primary

- **Park Plate Green** (#17302a; Dark #7fa596): the accent. Primary buttons, links, focus outlines and the rail family. It is dark enough to carry white text and is used for the one action that moves the case forward.
- **Rail Green** (#17302a; Dark #24443b): the navigation rail and code plates, with Rail Mist text (#e6eeea). The selected flag row inverts to this colour.
- **Route Ink** (#17302a; Dark #7fa596): route lines in plans and strips.

### Pass states

Each state pairs a foreground and a tinted background, and always travels with its shape mark (see [Signature components](#signature-components)).

- **Valid Green** (#237446 on #e3f1e8): a pass is in force. Filled dot.
- **Expiring Amber** (#94500e on #fbeedd): a pass ends within 30 days, or a warning that needs attention but not alarm. Half ring.
- **Suspended Red** (#b02e28 on #fbe9e7): a safety item is missing or a route is open; the pass is paused. Square.
- **Expired Slate** (#5b6763 on #eceeed): a pass ran out. Slashed ring.
- **Unknown Grey** (#5d6b66 on #eef2ef): no pass yet, or the drone could not see. Hollow ring.
- **Danger Red** (#b02e28; Dark #ef8a80): destructive or negative actions ("Not a problem", "Reject") and error text. It shares its hue with Suspended Red on purpose.

### Neutral

- **Mineral Canvas** (#e7ebe8; Dark #111a17): the page ground behind the islands.
- **Island White** (#fbfcfb; Dark #1c2925): every card, panel and bar surface.
- **Raised White** (#ffffff; Dark #24302c): inputs, chips and option cards that sit on an island.
- **Sunken Grey** (#eef2ef; Dark #111a17): skeletons, disabled fills and inset areas such as the timeline.
- **Ink** (#1c2925; Dark #fbfcfb): primary text.
- **Moss Grey** (#5d6b66; Dark #b4bdb8): secondary text, captions and helper lines.
- **Hairline** (#cfd6d2; Dark #3a4743): default borders and dividers. **Field Edge** (#8e9994; Dark #6f7b76) outlines inputs.
- **Lake Slate** (#aab3af; Dark #5b6763): water in plan drawings.
- **Simulation Ink** (#1c2925 with white text; inverted in Dark): the SIMULATION label.

### Color rules

**The Shape-Carries-State Rule.** A pass state is never shown by colour alone. Every state mark has its own shape, and every badge also carries words ("Valid to 20 Oct 2027", "Paused since 06:42").

**The Calm Alarm Rule.** Red appears only where a safety item is missing, a route is open or an action is destructive. Warnings with a plan already in motion ("Drone feed lost; a walk crew checks at 10:00") use Expiring Amber.

**The Solid Surface Rule.** Cards, buttons, menus, bars and dialogs have solid fills. Nothing that holds text is transparent.

## Typography

**Display Font:** Atkinson Hyperlegible Next (with system-ui, sans-serif)\
**Body Font:** Atkinson Hyperlegible Next\
**Label/Mono Font:** Atkinson Hyperlegible Next, Bold for code plates

**Character:** one humanist face, designed for low-vision readers, that keeps similar characters (Il1, O0) distinct. It reads well on a phone in sunlight and stays friendly at display sizes.

### Hierarchy

- **Display** (600, 30 px, 36 px line): the one question or fact a screen answers ("Fence panel missing", "Which fix closes every way to the water?").
- **H1** (600, 26 px, 32 px): page titles on wide layouts.
- **H2** (600, 20 px, 26 px): card titles such as "3 changes found".
- **H3** (600, 16 px, 22 px): option titles, the "why it matters" line, section heads.
- **Body** (400, 15 px, 22 px): explanations; keep lines under about 75 characters.
- **Body Dense** (400, 14 px, 20 px): meta lines, helper text, list secondary text.
- **Label** (500, 14 px, 20 px) and **Label Strong** (600, 15 px, 20 px): buttons, row titles, field labels.
- **Label Small** (500, 12 px, 16 px): photo captions, tags on images, attribution.
- **Overline** (700, 12 px, 16 px, 0.06em, uppercase): the SIMULATION label and board labels only.
- **Code Plate** (700, 14 px, 0.02em) and **Code Small** (600, 12 px): segment codes and work-order numbers.

### Type rules

**The Plain Name First Rule.** Titles use plain words and place names. Codes (LK·S12, WO-0087) appear only as small plates or meta text beside them.

**The 12 Pixel Floor Rule.** No text is smaller than 12 px.

## Layout

The desktop layout is a set of islands on the mineral canvas, at 1440 × 900 for the demo.

- **Frame:** 12 px outer padding and 12 px gaps between islands.
- **Rail:** 232 px expanded, 72 px collapsed. Clicking the logo toggles it (250 ms smart animate); on hover the logo shows the collapse or expand arrow. It holds three items: Inbox (with a count), Map and Passes.
- **Top bar:** a 64 px island with the page title, one context line, the SIMULATION label and the profile button. Theme and language live in the profile menu.
- **Work area:** one or two islands that fill the rest. The Inbox uses a 340 px list beside a detail island; Fix Lens and Pass issued use one island.
- **Inside an island:** 28 px padding (48 px on the Pass issued hero), 20 px between blocks. The primary action row sits at the foot of the island.
- **Phone:** 390 × 844. A 56 px top bar, 16 px side padding, a card per group, and a pinned action bar with one full-width primary button and a status line under it.
- **Spacing scale:** 4 px steps (4, 8, 12, 16, 20, 24, 32, 40, 48, 64).
- **Targets:** at least 44 px on phone and at least 32 px on desktop.

## Elevation & Depth

The system is flat by default and uses tonal layering: canvas, then island, then raised controls. Shadows appear only when something floats over content that keeps moving underneath, such as the map card, menus and dialogs.

### Shadow Vocabulary

- **Elevation 1** (`box-shadow: 0 1px 2px rgba(22, 27, 26, 0.08)`): a resting control that must lift slightly off an island.
- **Elevation 2** (`box-shadow: 0 4px 12px rgba(22, 27, 26, 0.10), 0 1px 2px rgba(22, 27, 26, 0.06)`): cards floating over the 3D map, notification and profile menus.
- **Elevation 3** (`box-shadow: 0 16px 40px rgba(22, 27, 26, 0.18), 0 2px 6px rgba(22, 27, 26, 0.08)`): dialogs and bottom sheets.
- **Focus ring** (`box-shadow: 0 0 0 2px <bg-surface>, 0 0 0 4px <border-focus>`): a 2 px gap in the surface colour, then a 2 px ring, on every focusable element.

**The Flat Island Rule.** Islands that tile the layout never carry a shadow. Depth between them comes from the canvas showing through the 12 px gutters.

## Shapes

Gentle, consistent corners: 4 px on chips, badges, plates and tags; 8 px on buttons, inputs, rows, banners and evidence photos; 12 px on option cards and menus; 16 px on islands, the rail and the top bar; full rounding only on avatars, the pass seal and state dots. Borders are 1 px hairlines; outline buttons and the SIMULATION label use 1.5 px; focus and error borders on inputs use 2 px.

**The No Side-Stripe Rule.** Banners and callouts use a full 1 px border, a tinted fill and an icon. Never a thick coloured stripe down one side.

## Components

### Buttons

- **Shape:** 8 px corners, 44 px tall, 20 px side padding, Label Strong text.
- **Primary:** Park Plate Green fill with white text (pale sage with dark text in Dark). One per screen, at the start of the action row.
- **Hover / Focus:** hover deepens to the hover accent; focus adds the focus ring.
- **Secondary:** Island White fill with a 1.5 px accent outline and accent text, for "Look again", "Back to Inbox", "Try again".
- **Quiet:** no outline, accent text, for low-weight actions in menus.
- **Danger:** Island White fill with a 1.5 px Danger Red outline and red text. It sits apart at the far right of the action row.
- **Disabled:** Sunken Grey fill, hairline border, disabled text. A disabled button always has a line next to it that says why ("Sending unlocks once Fix Lens has checked the fix").

### Chips and badges

- **Chip:** Raised White, hairline border, 4 px corners, 28 px tall, Label text ("How sure: high").
- **Pass badge:** state tint with state text and its shape mark, 4 px corners ("Valid to 20 Oct 2027").
- **SIMULATION label:** Overline text in a 1.5 px Ink outline, 4 px corners. It sits in every top bar and on every simulated image caption.

### Cards / Containers

- **Corner Style:** 16 px for islands, 12 px for cards inside them.
- **Background:** Island White; option cards and fields use Raised White; the timeline uses Sunken Grey.
- **Shadow Strategy:** none at rest (see [Elevation & Depth](#elevation--depth)); Elevation 2 only over the map.
- **Border:** none on islands; 1 px hairline on inner cards. A selected option card takes a 2 px accent border and a filled radio.
- **Internal Padding:** 28 px for islands, 20 px for cards.

### Inputs / Fields

- **Style:** Raised White box, 1 px Field Edge border, 8 px corners, 44 px tall, 12 px padding. The label sits above in Label text; helper text sits below in Body Dense.
- **Focus:** a 2 px border in the focus colour and an accent caret.
- **Error / Disabled:** a 2 px Danger Red border, with a warning icon and red helper text that says how to fix it.
- **Number with unit:** the unit (cm) sits in its own segment inside the box. Measurements use centimetres.
- **Pass / Fail:** two 44 px segments; the chosen side fills with its state tint and shows a check or cross.

### Navigation

- **Rail:** Rail Green island. Items are 44 px rows with an 18 px Phosphor Bold icon in a tile, the label, and an optional count. The active item inverts to a Rail Mist pill with dark text. Collapsed, only the icon tiles show.
- **Top bar:** title in H2-weight text, one context line in Body Dense, then the SIMULATION label and the profile button pushed right.
- **Profile menu:** name and role, then My profile, Settings, Language, Appearance, Help and Sign out.
- **Phone top bar:** Rail Green bar with back, title, subtitle and a more button, each target 44 × 44 px.

### Signature components

- **Code plate:** a Rail Green tag with white Code Plate text (LK·S12). It names a segment; it is never a page title.
- **State mark:** the five pass shapes (filled dot, half ring, slashed ring, square, hollow ring) at 12 px (Small) or 18 px (Medium).
- **Severity mark:** a single ink dot whose size alone shows low, medium or high, inside a 16 px box. Never colour.
- **Flag row:** severity mark, title, place, and time; the selected row inverts to Rail Green.
- **Evidence frame:** a photo with a caption bar (when, who, "simulated"). Size Default for lists and the phone, Size Large (270 px photo) for the Inbox decision. The changed spot gets a dashed red outline and a red tag ("Panel 4 missing").
- **Fix Lens plan:** a top-down drawing per fix option. Existing fence in Ink, proposed work as dashed lines labelled "proposed, not installed", blocked routes as grey dashed lines ending in a stop bar, and an open route as a solid red arrow into the water with a "Still open" label.
- **Loop timeline:** time, state mark, what happened and who, one row per step of the Edge Loop, on Sunken Grey.
- **Logo:** the Step edge isometric glyph. Glyph for 40 px and up, Small (solid faces, no lines) for 16 to 32 px, and App icon on a rounded tile; each in Light and Rail versions.
- **Icons:** Phosphor Bold only, at 16, 18, 20 or 24 px.

### States: empty, loading, error

Every screen ships with all four states, in Light and Dark.

- **Empty:** an icon, a plain title and one line that says what is still unknown ("3 spots on Retention pond 3 were not visible and stay unknown"). An empty screen never implies "safe".
- **Loading:** Sunken Grey skeleton rows and blocks in the real layout, plus one line naming what is loading.
- **Error:** a banner that says what failed, what still works and what happens next. Actions that cannot work are disabled with a reason; the evidence stays visible.

## Do's and Don'ts

### Do:

- **Do** give each screen one question and one primary button.
- **Do** lead with the place name and show the code as a plate beside it.
- **Do** pair every pass state with its shape mark and words.
- **Do** label every simulated flight, photo and repair with SIMULATION or "simulated".
- **Do** say what a button will do before it is pressed ("The safety pass for this fence is paused until it is fixed").
- **Do** keep text at 12 px or larger and contrast at 4.5:1 or better in both modes.

### Don't:

- **Don't** build KPI-tile rows or a dark CCTV-wall layout.
- **Don't** use colour alone for a state, or red for anything that is not a missing item, an open route or a destructive action.
- **Don't** use transparent cards, buttons or menus.
- **Don't** put a thick coloured stripe on one side of a banner, row or card.
- **Don't** use a second icon family or a second typeface.
- **Don't** show an empty list as "all clear"; say what was not seen.

## See also

- [Figma: Demo path board](https://www.figma.com/design/6KoP9X4g8nIYJXtTce7Bov/Safe-Edge-design-system?node-id=102-8931): the five demo screens, Light and Dark.
- [Figma: Design System page](https://www.figma.com/design/6KoP9X4g8nIYJXtTce7Bov/Safe-Edge-design-system?node-id=2-2): foundations, brand, icons and components.
- [PRODUCT.md](PRODUCT.md): users, the Edge Loop and product principles.
