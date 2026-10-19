// PRODUCT.md and DESIGN.md live in docs/. Design tools such as impeccable write to the repo root by default, and they
// read context from the first folder that holds either file, so a copy at the root would hide the real ones.
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dir, '..')
const strays = readdirSync(root).filter((name) => /^(product|design)\.md$/i.test(name))
if (strays.length > 0) throw new Error(`move ${strays.join(' and ')} into docs/; the repo root must not hold them`)
