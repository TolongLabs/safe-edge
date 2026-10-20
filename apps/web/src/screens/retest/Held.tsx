import type { EdgePass } from '@safe-edge/contracts'
import type { Snapshot } from '../../store'
import { OPEN_FLAG_RULE, openFlags, plainReason, useFlagNames } from './names'

/** What to tell a reviewer when a check was accepted but the pass is still held by something else. */
export function Held({ pass, s }: { pass: EdgePass | undefined; s: Snapshot }) {
  const names = useFlagNames(pass?.stateReason ?? null, s)
  if (names === null)
    return (
      <p role="status" className="rt-help">
        Looking up what holds this pass
      </p>
    )
  const flags = openFlags(pass?.stateReason ?? null, s, names)
  return (
    <>
      <p>
        No pass has been issued yet.
        {flags.length > 0
          ? ` Still open on this edge: ${flags.join(', ')}.`
          : ` ${plainReason(pass?.stateReason ?? 'Another flag may still be open on this edge.', s, names)}`}
      </p>
      <p className="rt-help">{OPEN_FLAG_RULE}</p>
      <a className="btn" href="#/inbox">
        Back to Inbox
      </a>
    </>
  )
}
