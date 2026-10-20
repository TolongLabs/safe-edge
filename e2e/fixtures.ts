import { expect, test as base } from '@playwright/test'

// Offline rule (#80): abort every http(s) request that is not local, and fail the test if any happened.
export const test = base.extend<{ aborted: string[] }>({
  aborted: [
    async ({ page }, use) => {
      const aborted: string[] = []
      await page.route(/^https?:/, (route) => {
        const host = new URL(route.request().url()).hostname
        if (host === 'localhost' || host === '127.0.0.1') return route.continue()
        aborted.push(route.request().url())
        return route.abort()
      })
      await use(aborted)
      expect(aborted, 'non-local requests were aborted').toEqual([])
    },
    { auto: true }
  ]
})
export { expect }
