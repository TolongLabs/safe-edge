import type { Notice } from '@safe-edge/contracts'
import { counts, day, month, type Row } from './board'

/** The report text people start from; they edit it before saving, because core cannot edit a saved draft. */
export function reportBody(rs: Row[], now: number) {
  const c = counts(rs)
  return [
    `Elmina township, ${month(now)}: ${rs.length} edges.`,
    `${c.suspended} suspended, ${c.expired} expired, ${c.expiring} expiring, ${c.valid} valid, ${c.none} with no pass yet (unknown, never counted as safe).`,
    `${c.flags} open flag${c.flags === 1 ? '' : 's'}. ${c.overdue} overdue work order${c.overdue === 1 ? '' : 's'}. ${c.unknownStretches} edge${c.unknownStretches === 1 ? '' : 's'} with unknown stretches or open field checks.`
  ].join('\n')
}

/** The model and sources of a report the agent drafted: shown and exported with it, never stored on the notice. */
export type Byline = { model: string; citations: string[] }

export function reportMarkdown(n: Notice, author: string, byline: Byline | undefined) {
  const ai = byline
    ? `\n\nAI suggestion, unvalidated: written by the agent with ${byline.model}; ${byline.citations.length > 0 ? `sources ${byline.citations.join(', ')}` : 'uncited: it names no record it read'}.`
    : ''
  return `# ${n.title}\n\nDrafted by ${author} on ${day(n.createdAt)}${n.status === 'sent' ? ' (sent)' : ' (not sent)'}${ai}\n\n${n.body}\n\nSample data: ${n.simulated ? 'yes (simulated)' : 'no'}\n`
}

export function download(name: string, type: string, text: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type }))
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}
