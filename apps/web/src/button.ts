/**
 * The scene page's buttons: solid dark for the main action, outlined for the rest. Their look, hover, focus and
 * disabled states live in the scene page's stylesheet (`sceneCss` in ElminaScene.tsx), where `--tap` is 32 px with a
 * mouse and 44 px on a touch screen.
 */
export const button = (primary: boolean) => (primary ? 'scene-btn primary' : 'scene-btn')
