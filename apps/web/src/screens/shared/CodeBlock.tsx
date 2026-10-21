import { Check, Copy, WarningCircle } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import './shared.css'

/** A code sample with a Copy button. A copy the browser refuses says so, so nobody pastes a stale clipboard. */
export function CodeBlock({ code, label }: { code: string; label: string }) {
  const [copy, setCopy] = useState<{ ok: true } | { ok: false; why: string } | null>(null)
  useEffect(() => {
    if (!copy?.ok) return
    const t = setTimeout(() => setCopy(null), 2000)
    return () => clearTimeout(t)
  }, [copy])
  const onCopy = () =>
    navigator.clipboard.writeText(code).then(
      () => setCopy({ ok: true }),
      (error: unknown) => setCopy({ ok: false, why: error instanceof Error ? error.message : String(error) })
    )
  return (
    <figure className="code-block">
      <figcaption>
        <span>{label}</span>
        <button className="btn small" onClick={onCopy} aria-label={`Copy ${label}`}>
          {copy?.ok ? (
            <Check size={16} weight="bold" aria-hidden="true" />
          ) : (
            <Copy size={16} weight="bold" aria-hidden="true" />
          )}
          {copy?.ok ? 'Copied' : 'Copy'}
        </button>
      </figcaption>
      <pre tabIndex={0}>
        <code>{code}</code>
      </pre>
      {copy && !copy.ok && (
        <p className="state bad" role="alert">
          <WarningCircle size={20} weight="bold" aria-hidden="true" />
          <span>Could not copy: {copy.why}. Select the text and copy it by hand.</span>
        </p>
      )}
    </figure>
  )
}
