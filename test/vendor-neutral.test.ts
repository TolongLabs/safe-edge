// #55: no vendor payload type reaches the domain. Core and contracts import nothing from the provider adapters or a
// drone vendor's SDK or protocol, so DJI and MAVLink stay behind the DroneProvider port.
import { describe, expect, test } from 'bun:test'
import { Glob } from 'bun'
import { dirname, join, relative, resolve } from 'node:path'
import ts from 'typescript'

const repoRoot = join(import.meta.dir, '..')
/** Where vendor payloads live: the adapters package, and vendor SDKs and protocols. */
const VENDOR = /^packages\/providers\b|@safe-edge\/providers|dji|mavlink|mavsdk|mqtt|px4|ardupilot|procore/i

/** Every vendor import in a workspace, type-only ones included (Bun's own import scanner drops those). */
async function vendorImports(workspace: string): Promise<string[]> {
  const found: string[] = []
  for await (const file of new Glob('**/*.{ts,tsx}').scan({ cwd: join(repoRoot, workspace) })) {
    if (file.split('/').includes('node_modules')) continue
    const path = join(repoRoot, workspace, file)
    for (const { fileName } of ts.preProcessFile(await Bun.file(path).text(), true, true).importedFiles) {
      const target = fileName.startsWith('.') ? relative(repoRoot, resolve(dirname(path), fileName)) : fileName
      if (VENDOR.test(target)) found.push(`${workspace}/${file} imports ${fileName}`)
    }
  }
  const manifest = await Bun.file(join(repoRoot, workspace, 'package.json')).json()
  for (const name of Object.keys({ ...manifest.dependencies, ...manifest.devDependencies })) {
    if (VENDOR.test(name)) found.push(`${workspace}/package.json depends on ${name}`)
  }
  return found
}

describe('the domain stays vendor-neutral', () => {
  test.each(['packages/core', 'packages/contracts'])('%s imports no vendor payload type', async (workspace) => {
    expect(await vendorImports(workspace)).toEqual([])
  })

  test('the check sees the vendor adapters where they do live', async () => {
    const found = await vendorImports('packages/providers')
    expect(found).toContain('packages/providers/src/index.ts imports ./drone-dji-cloud.ts')
    expect(found).toContain('packages/providers/src/index.ts imports ./drone-mavlink.ts')
  })
})
