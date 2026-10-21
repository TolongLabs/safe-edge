import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

const profile = (page: Page) => page.getByRole('banner').getByRole('button', { expanded: false })
async function signInAs(page: Page, name: string) {
  await profile(page).click()
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click()
  await expect(profile(page)).toHaveAccessibleName(new RegExp(`^${name}`))
}

test.beforeEach(async ({ page }) => {
  await page.goto('demo/')
  await expect(page.getByRole('heading', { name: 'Fence panel 4 missing' })).toBeVisible()
})

test('PLAN-2 PLAN-6 Patrol: the manager plans S1, the scores show unknowns, only the pilot approves', async ({
  page
}) => {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Patrol' }).click()
  await expect(page.getByRole('heading', { name: 'No patrol plan yet' })).toBeVisible()
  // An empty screen never reads as safe: it says what stays unknown.
  await expect(page.getByText(/state stays unknown/)).toBeVisible()

  await page.getByRole('button', { name: 'Plan the after-rain patrol' }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'Patrol of 3 segments' })).toBeVisible()
  await expect(page.getByText('Proposed. It cannot fly until a pilot approves it.')).toBeVisible()
  const table = page.getByRole('region', { name: 'Segments by priority' })
  for (const n of [6, 10, 12]) await expect(table.getByText(`Elmina Central Park lake, segment ${n}`)).toBeVisible()
  // S1's readings are older than the planner allows, so rain and water level are unknown, never zero.
  await expect(table.getByRole('cell', { name: 'unknown' }).first()).toBeVisible()
  await expect(page.getByText(/Weather · The whole launch/)).toBeVisible()
  await expect(page.getByText(/left on landing; the drone keeps at least 25 Wh/)).toBeVisible()
  await expect(page.getByText(/Stations keep 50 m from people/)).toBeVisible()
  await expect(page.getByText('bun run export:mission <outDir>')).toBeVisible()

  // The manager may not approve: no button, and the lock names the pilot.
  await expect(page.getByRole('button', { name: 'Approve this plan' })).toHaveCount(0)
  await expect(page.locator('.banner', { hasText: /Approving a plan is the remote pilot.s step/ })).toContainText(
    'Daniel Tan'
  )

  await signInAs(page, 'Daniel Tan')
  await page.getByRole('button', { name: 'Approve this plan' }).click()
  await expect(page.getByText(/^Approved by Daniel Tan/)).toBeVisible()
  // A hold or the window keeps the drone on the ground, and core says which rule.
  await page.getByRole('button', { name: 'Start the simulated patrol' }).click()
  await expect(page.getByRole('alert')).toContainText(
    /Core refused this \((weather_hold|separation_hold|outside_window)\)/
  )
})

test('PLAN-6 Patrol: the crew cannot ask for a plan and is told who can', async ({ page }) => {
  await signInAs(page, 'Siti Aminah')
  await page.goto('demo/#/patrol')
  await expect(page.getByRole('heading', { name: 'No patrol plan yet' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Plan the after-rain patrol' })).toHaveCount(0)
  await expect(
    page.locator('.banner', { hasText: /Asking for a patrol plan is the park manager.s step/ })
  ).toContainText('Farah Hashim')
})

test('S5 Agent: the guardrail check is refused with its rule and lands in the audit trail', async ({ page }) => {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Agent' }).click()
  const tools = page.getByRole('navigation', { name: 'Agent tools' })
  await expect(tools.getByRole('listitem')).toHaveCount(8)
  await expect(tools.getByText('propose_patrol')).toBeVisible()
  const never = page.getByRole('region', { name: 'What the agent can never do' })
  for (const id of ['decideCandidate', 'submitWorkOrder', 'recordRetest', 'sendNotice', 'approvePatrolPlan'])
    await expect(never.getByRole('rowheader', { name: id, exact: true })).toBeVisible()
  await expect(page.getByText(/Nothing on the audit chain yet\. The agent has not proposed or drafted/)).toBeVisible()

  await page.getByRole('button', { name: 'Ask core as the agent' }).click()
  await expect(page.getByText('Refused, as it must be.')).toBeVisible()
  await expect(page.getByText('Rule: agents_draft_only')).toBeVisible()
  await expect(page.getByText(/Agents read, propose and draft only; decideCandidate needs a person/)).toBeVisible()
  await expect(page.getByText(/Core accepted a decision from the agent/)).toHaveCount(0)
  await expect(page.getByText('Refused · agents_draft_only')).toBeVisible()

  // The candidate is still open in the Inbox.
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: /Inbox/ }).click()
  await expect(page.getByRole('heading', { name: 'Fence panel 4 missing' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirm: needs a fix', exact: true })).toBeVisible()
})

test('Agent: who may not read the audit trail is told who can', async ({ page }) => {
  await signInAs(page, 'Lim Wei Jie')
  await page.goto('demo/#/agent')
  await expect(
    page.locator('.banner', { hasText: /The audit trail is for the park manager and the general/ })
  ).toContainText('Rosli Ahmad')
  await page.getByRole('button', { name: 'Ask core as the agent' }).click()
  await expect(page.getByText('Rule: agents_draft_only')).toBeVisible()
})

test('Developers: the operations table filters and Try it prints JSON or core refusal', async ({ page }) => {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Developers' }).click()
  const ops = page.getByRole('region', { name: 'Operations' })
  // Every row of the contracts' table is there before any filter.
  await expect(ops.getByRole('rowheader', { name: 'listAssets', exact: true })).toBeVisible()
  await expect(page.getByText(/^(\d+) of \1 operations$/)).toBeVisible()
  await page.getByRole('searchbox', { name: 'Filter operations' }).fill('patrol-plans')
  await expect(ops.getByRole('rowheader', { name: 'approvePatrolPlan', exact: true })).toBeVisible()
  await expect(ops.getByRole('rowheader', { name: 'listAssets', exact: true })).toHaveCount(0)
  await expect(page.getByText(/^5 of \d+ operations$/)).toBeVisible()
  await page.getByRole('searchbox', { name: 'Filter operations' }).fill('no such operation')
  await expect(page.getByText('No operation matches “no such operation”.')).toBeVisible()

  await page.getByRole('combobox', { name: 'Operation' }).selectOption('listUsers')
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  const out = page.getByRole('figure').filter({ hasText: 'listUsers as Farah Hashim (manager)' })
  await expect(out).toContainText('11 records')
  await expect(out.locator('pre')).toContainText('"id": "usr_pilot"')
  expect(JSON.parse(await out.locator('pre').innerText())).toHaveLength(11)

  await signInAs(page, 'Siti Aminah')
  await page.getByRole('combobox', { name: 'Operation' }).selectOption('listCandidates')
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Core refused this (role_forbidden)')

  await expect(page.getByRole('figure', { name: 'apps/mcp/mcp.json' })).toContainText('SAFE_EDGE_AGENT_TOKEN')
})
