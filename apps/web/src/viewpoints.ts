import { elminaSeed } from '@safe-edge/sdk'
import type { Scene } from './scenes'

/** Display words for the viewpoints the demo knows; core carries only an ID and a pose. */
export const NAMES: Record<string, { name: string; scene: Scene }> = {
  [elminaSeed.story.s1.viewpointId]: { name: 'Playground path, fence line', scene: 'fence' },
  vp_866518980_11_1: { name: 'Lake bank, grass slope', scene: 'path' }
}

export function describeViewpoint(id: string, index = 0): { name: string; scene: Scene | null } {
  return NAMES[id] ?? { name: `Viewpoint ${index + 1}`, scene: null }
}
