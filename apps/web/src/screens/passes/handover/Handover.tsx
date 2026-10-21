import { Printer, X } from '@phosphor-icons/react'
import { useEffect, useRef } from 'react'
import type { HandoverPack } from './pack'
import { dayTime, day } from '../board'
import { ROLE_WORDS } from '../../fix-lens/lens'
import './handover.css'

export function Handover({ pack, onClose }: { pack: HandoverPack; onClose: () => void }) {
  const segmentById = new Map(pack.segments.map((s) => [s.segment.id, s.segment]))
  const close = useRef<HTMLButtonElement>(null)
  // A modal page: the app behind it is inert, Escape closes it, and focus goes back to the button that opened it.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const app = document.getElementById('root')
    app?.setAttribute('inert', '')
    close.current?.focus()
    return () => {
      app?.removeAttribute('inert')
      opener?.focus()
    }
  }, [])
  useEffect(() => {
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [onClose])

  return (
    <div className="handover-layer" role="dialog" aria-modal="true" aria-labelledby="ho-title">
      <article className="handover-sheet">
        <footer className="handover-actions no-print">
          <button ref={close} type="button" className="btn" onClick={onClose}>
            <X size={20} weight="bold" aria-hidden="true" />
            Close
          </button>
          <button type="button" className="btn primary" onClick={() => window.print()}>
            <Printer size={20} weight="bold" aria-hidden="true" />
            Print this page
          </button>
        </footer>
        <header>
          <h1 id="ho-title">Handover pack for {pack.asset.name}</h1>
          <p>
            Generated {dayTime(pack.generatedAt)} by {pack.generatedBy}.
          </p>
          {pack.asset.simulated && <p className="simulated">Simulated sample data.</p>}
        </header>

        <section aria-labelledby="ho-owner">
          <h2 id="ho-owner">Upkeep owner</h2>
          <p>
            {pack.upkeepOwner.name}, {ROLE_WORDS[pack.upkeepOwner.role]}.
          </p>
        </section>

        <section aria-labelledby="ho-segs">
          <h2 id="ho-segs">Edges and their passes</h2>
          {pack.segments.length === 0 ? (
            <p>This asset has no edges.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th scope="col">Edge</th>
                  <th scope="col">Pass</th>
                  <th scope="col" className="valid-from">
                    Valid from
                  </th>
                  <th scope="col">Valid to</th>
                  <th scope="col">Re-tests in scope</th>
                </tr>
              </thead>
              <tbody>
                {pack.segments.map(({ segment, pass, passLabel }) => (
                  <tr key={segment.id}>
                    <td>{segment.name}</td>
                    <td>{passLabel}</td>
                    <td className="valid-from">{pass?.validFrom ? day(pass.validFrom) : 'not issued'}</td>
                    <td className="valid-to">{pass?.validTo ? day(pass.validTo) : 'not issued'}</td>
                    <td>{pass ? pass.scope.retestIds.length : 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section aria-labelledby="ho-retest">
          <h2 id="ho-retest">Accepted re-tests</h2>
          {pack.acceptedRetests.length === 0 ? (
            <p>No accepted re-tests on this asset yet. An empty list does not mean every edge is safe.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th scope="col">Re-test</th>
                  <th scope="col">Edge</th>
                  <th scope="col">Accepted</th>
                  <th scope="col">By</th>
                </tr>
              </thead>
              <tbody>
                {pack.acceptedRetests.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{segmentById.get(item.segmentId)?.name}</td>
                    {typeof item.details === 'string' ? (
                      <td colSpan={2}>{item.details}</td>
                    ) : (
                      <>
                        <td>{dayTime(item.details.at)}</td>
                        <td>{item.details.actor}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section aria-labelledby="ho-open">
          <h2 id="ho-open">Open findings</h2>
          {pack.openFindings.length === 0 ? (
            <p>No open findings are recorded on this asset. Nothing is shown as all clear by this list alone.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th scope="col">Finding</th>
                  <th scope="col">Severity</th>
                  <th scope="col">Status</th>
                  <th scope="col">Confirmed</th>
                </tr>
              </thead>
              <tbody>
                {pack.openFindings.map((finding) => (
                  <tr key={finding.id}>
                    <td>{finding.id}</td>
                    <td>{finding.severity}</td>
                    <td>{finding.status.replace(/_/g, ' ')}</td>
                    <td>{dayTime(finding.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </article>
    </div>
  )
}
