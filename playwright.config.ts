import { defineConfig } from '@playwright/test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Browser tests in e2e/. They end in .e2e.ts so `bun test` leaves them to Playwright.
// On WSL, Chromium reaches the GPU only in a window, through Mesa's D3D12 driver. On a laptop with two GPUs, pick
// the one to measure with MESA_D3D12_DEFAULT_ADAPTER_NAME (for example NVIDIA or AMD).
const wsl = !!process.env.WSL_DISTRO_NAME
// build:demo-site refuses folders inside the repository, so the tests' build goes to the system's temp folder.
const site = join(tmpdir(), 'safe-edge-demo-site')
if (wsl) process.env.GALLIUM_DRIVER ??= 'd3d12'

export default defineConfig({
  testDir: 'e2e',
  testMatch: /.*\.e2e\.ts/,
  forbidOnly: !!process.env.CI,
  // Frame times are only fair with the machine to themselves.
  workers: 1,
  reporter: 'list',
  timeout: 120_000,
  use: {
    baseURL: 'http://127.0.0.1:4173/',
    headless: !wsl,
    launchOptions: {
      // Recording mode's Record button captures the tab; this flag accepts the browser's share prompt.
      args: [
        '--auto-accept-this-tab-capture',
        ...(wsl ? ['--use-gl=angle', '--use-angle=gl-egl', '--ignore-gpu-blocklist'] : [])
      ]
    }
  },
  // The production demo site, as the judges get it: the dev build runs React's slower development checks.
  webServer: {
    command: `bun run build:demo-site ${site} && bun scripts/serve-demo-site.ts ${site} 4173`,
    url: 'http://127.0.0.1:4173/',
    timeout: 180_000,
    reuseExistingServer: false
  }
})
