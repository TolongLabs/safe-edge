import { defineConfig } from '@playwright/test'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../../')
const live = process.env.SAFE_EDGE_RECORD_BASE_URL
const site = join(tmpdir(), `safe-edge-recording-${process.pid}-${Date.now()}`)

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.rec\.ts/,
  workers: 1,
  timeout: 45 * 60 * 1000,
  expect: {
    timeout: 15_000
  },
  outputDir: resolve(repoRoot, 'output/recording-tests'),
  use: {
    baseURL: live ?? 'http://127.0.0.1:4197/',
    headless: true,
    colorScheme: 'light',
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
    launchOptions: {
      args: ['--auto-accept-this-tab-capture']
    }
  },
  webServer: live
    ? undefined
    : {
        command: `bun run build:demo-site ${site} && bun scripts/serve-demo-site.ts ${site} 4197`,
        url: 'http://127.0.0.1:4197/',
        timeout: 180_000,
        reuseExistingServer: false,
        cwd: repoRoot
      }
})
