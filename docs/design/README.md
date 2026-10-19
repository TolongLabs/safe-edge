# Design research

Reference pages for Safe Edge's design work: icon sets, interface rules, motion recipes and a video pipeline, each read in a browser and recorded on its own page. They feed the Figma gate (#101) and, after approval, `DESIGN.md` (#47). They are inputs, not decisions: the approved Figma file and `DESIGN.md` win.

Contents:

1.  [Sources](#sources)
1.  [Iconography](#iconography)
1.  [Typography and colour](#typography-and-colour)
1.  [Motion](#motion)
1.  [Video](#video)
1.  [More resources](#more-resources)
1.  [See also](#see-also)

## Sources

| Page                                      | Source                                       | What it is                                                     |
| ----------------------------------------- | -------------------------------------------- | -------------------------------------------------------------- |
| [Interface skills](jakubkrehel-skills.md) | github.com/jakubkrehel/skills                | Agent skills with exact values for UI, type, colour and motion |
| [Hugeicons](hugeicons.md)                 | hugeicons.com/icons/stroke-rounded, free     | About 6,000 free Stroke Rounded icons                          |
| [Iconsax](iconsax.md)                     | app.iconsax.io, free tier                    | 7,140 free icons in six styles                                 |
| [Isocons](isocons.md)                     | isocons.app                                  | About 1,000 isometric line icons                               |
| [Its Hover](itshover.md)                  | itshover.com/icons                           | 263 hover-animated React icons                                 |
| [Jakub Antalik](jakub-antalik.md)         | jakubantalik.com                             | A panel that becomes a bottom sheet on mobile                  |
| [MotionSites](motionsites.md)             | motionsites.ai, free tier                    | Prompts that rebuild cinematic landing pages, plus lessons     |
| [Canvas UI](canvas-ui.md)                 | canvasui.dev/components                      | 35 WebGL and WebGPU effects that run over live HTML            |
| [Video pipeline](video-pipeline.md)       | gemini.google.com, geminiwatermarkremover.io | Making footage, and labelling it as generated                  |

## Iconography

The first draft used Lucide, which is everywhere and reads as generic. The replacement is open, and each candidate goes on the Figma file's "Iconography · Options" page beside the same Safe Edge glyphs: drone, fence, water edge, shield, camera, map, route, work order and person.

| Candidate                         | Why look at it                                                           | Watch out for                                     |
| --------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------- |
| [Hugeicons](hugeicons.md)         | 6,000 free icons in one style, 1.5 stroke, React renderer                | Free tier is Stroke Rounded only                  |
| [Iconsax](iconsax.md)             | Linear and Bold pairs give a clear active state                          | Exports hardcode colour and clip-path ids         |
| Phosphor                          | Six weights from one drawing, so state can change weight, not just style | Large; pick one weight per surface                |
| Tabler Icons                      | 5,000+ icons on a strict 24 px, 2 px grid                                | Close in feel to Lucide                           |
| [Isocons](isocons.md), large only | Isometric art echoes the 3D scene for empty states and the landing page  | Never at toolbar sizes, never mixed with UI icons |

Rules from [`better-ui`](jakubkrehel-skills.md#ui-polish) hold whichever set wins: one library per surface, a 1.5 px stroke beside regular text and 2 px beside semibold, and `currentColor` everywhere.

## Typography and colour

The first draft's IBM Plex and teal palette were rejected. Before drawing the next round, read [the typography and colour rules](jakubkrehel-skills.md#typography) for exact values. Check every text and state pair against WCAG 2.2 AA, which PRODUCT.md sets as the target. The five pass states must never depend on colour alone.

## Motion

Motion has two homes in Safe Edge, and the dashboard is not one of them:

- **The 3D scene**: drone paths, pass-state changes and the suspend moment, built in Three.js on the scene engine.
- **The landing page**: one signature interaction at most, from [MotionSites](motionsites.md), [Canvas UI](canvas-ui.md) or [Jakub Antalik's drawer](jakub-antalik.md#the-drawer).

On the dashboard, motion only tells someone that a state changed. Everything respects `prefers-reduced-motion`.

## Video

The [video pipeline](video-pipeline.md) covers generating a clip in Gemini, encoding it, and the Safe Edge rule: every generated clip carries a visible label and never stands in for patrol, site or repair footage.

## More resources

[TolongDesign](https://github.com/TolongLabs/TolongDesign) indexes design tools with their licence and price; search it with `bun run find -- <text>`. Finds relevant to the next round:

- **Galleries:** Pinterest, Dark Mode Design, Saaspo, Best SaaS Web Designs, Layers.
- **Type:** Fontshare, Fontsource, Velvetyne, Departure Mono.
- **Colour:** OKLCH, Huetone, Ramps, APCA, Color.review.
- **Icons:** Phosphor, Tabler Icons, Iconoir, Remix Icon, Material Symbols.
- **Dashboards:** shadcn/ui, Tremor, Evil Charts.

## See also

- [PRODUCT.md](/docs/PRODUCT.md): users, principles and the platform
- [TRD: Three.js simulation](/docs/TRD.md#threejs-simulation)
