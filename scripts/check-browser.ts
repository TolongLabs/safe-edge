// Bundles the packages that must also run in the browser. Bun's browser target silently polyfills Node built-ins,
// so this rejects them outright; Bun globals are caught by each package's tsconfig instead (no "bun" types).
import type { BunPlugin } from 'bun'
import { isBuiltin } from 'node:module'

const rejectBuiltins: BunPlugin = {
  name: 'reject-builtins',
  setup(build) {
    build.onResolve({ filter: /.*/ }, ({ path, importer }) => {
      if (path.startsWith('bun:') || isBuiltin(path)) {
        throw new Error(`${importer} imports "${path}", which does not exist in the browser`)
      }
    })
  }
}

await Bun.build({
  entrypoints: [
    'packages/contracts/src/index.ts',
    'packages/core/src/index.ts',
    'packages/planner/src/index.ts',
    'packages/planner/src/export/index.ts',
    'packages/providers/src/index.ts',
    'packages/scene/src/index.ts',
    'packages/sdk/src/index.ts'
  ],
  target: 'browser',
  plugins: [rejectBuiltins]
})
console.log('contracts, core, planner, providers, scene and sdk bundle for the browser')
