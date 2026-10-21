import { CheckCircle, LockSimple, WarningCircle } from '@phosphor-icons/react'
import { SafeEdgeApiError } from '@safe-edge/sdk'
import { useState, type FormEvent, type ReactNode } from 'react'
import { anthropicFailure, checkAnthropicKey } from '../../agent'
import {
  liveClient,
  liveFailure,
  setAnthropicKey,
  setLiveApi,
  useActsAs,
  useSettings,
  type Check
} from '../../settings'
import { Screen } from '../../shell/Shell'
import './settings.css'

/** Settings: the person's own keys for this demo. Each card checks its key with a real call before saving it. */
export function Settings() {
  return (
    <Screen title="Settings" context="Your own keys for this demo. They stay in this tab.">
      <main className="detail island settings">
        <AgentKey />
        <LiveApiCard />
      </main>
    </Screen>
  )
}

/** One setting: a title, what it does, its state and form, and a footer that says where the value goes. */
function Card({
  id,
  title,
  lead,
  foot,
  children
}: {
  id: string
  title: string
  lead: string
  foot: ReactNode
  children: ReactNode
}) {
  return (
    <section className="setting" aria-labelledby={`${id}-h`}>
      <div className="setting-body">
        <h2 id={`${id}-h`}>{title}</h2>
        <p className="setting-lead">{lead}</p>
        {children}
      </div>
      <p className="setting-foot" id={`${id}-foot`}>
        <LockSimple size={16} weight="bold" aria-hidden="true" />
        <span>{foot}</span>
      </p>
    </section>
  )
}

function FieldError({ id, text }: { id: string; text: string }) {
  return (
    <p id={id} className="field-error" role="alert">
      <WarningCircle size={16} weight="bold" aria-hidden="true" />
      {text}
    </p>
  )
}

function AgentKey() {
  const { anthropicKey } = useSettings()
  const [draft, setDraft] = useState('')
  const [check, setCheck] = useState<Check<string>>({ kind: 'idle' })
  const [fatal, setFatal] = useState<{ error: unknown } | null>(null)
  if (fatal) throw fatal.error

  const save = async (event: FormEvent) => {
    event.preventDefault()
    const key = draft.trim()
    if (!key) return setCheck({ kind: 'error', text: 'Paste a key first.' })
    setCheck({ kind: 'checking' })
    try {
      const model = await checkAnthropicKey(key)
      setAnthropicKey(key)
      setDraft('')
      setCheck({ kind: 'done', value: model })
    } catch (error) {
      const text = anthropicFailure(error)
      if (text === null) setFatal({ error })
      else setCheck({ kind: 'error', text })
    }
  }

  const invalid = check.kind === 'error'
  return (
    <Card
      id="key"
      title="Agent: your Anthropic key"
      lead="With your key the agent runs in this page: it summarises Inbox flags, drafts the monthly report and answers questions on the Agent page. It reads, proposes and drafts; core refuses it everything else."
      foot="Kept in this tab only and sent only to api.anthropic.com. Closing the tab forgets it. Anthropic bills the calls to your account."
    >
      {anthropicKey && (
        <div className="state ok setting-state">
          <CheckCircle size={20} weight="bold" aria-hidden="true" />
          <p>
            Saved: the key ending in <b translate="no">{anthropicKey.slice(-4)}</b>.
            {check.kind === 'done' && ` Anthropic confirmed it can use ${check.value}.`}
          </p>
          <button
            type="button"
            className="btn danger small"
            onClick={() => {
              setAnthropicKey(null)
              setCheck({ kind: 'idle' })
            }}
          >
            Forget key
          </button>
        </div>
      )}
      <form className="setting-form" onSubmit={save} noValidate>
        <label htmlFor="anthropic-key">{anthropicKey ? 'Replace the key' : 'Anthropic API key'}</label>
        <div className="setting-row">
          <input
            id="anthropic-key"
            name="anthropic-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste your key…"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              if (invalid) setCheck({ kind: 'idle' })
            }}
            aria-invalid={invalid}
            aria-describedby={invalid ? 'key-err key-foot' : 'key-foot'}
          />
          <button type="submit" className="btn" disabled={check.kind === 'checking'}>
            {check.kind === 'checking' ? 'Checking the key…' : 'Save key'}
          </button>
        </div>
        {invalid && <FieldError id="key-err" text={check.text} />}
      </form>
    </Card>
  )
}

const origin = window.location.origin

function LiveApiCard() {
  const { liveApi } = useSettings()
  const actsAs = useActsAs(liveApi)
  const [baseUrl, setBaseUrl] = useState('')
  const [token, setToken] = useState('')
  // A bad address or a server that does not answer marks the address; a refused or missing token marks the token.
  const [check, setCheck] = useState<
    { kind: 'idle' | 'checking' } | { kind: 'error'; text: string; field: 'url' | 'token' }
  >({ kind: 'idle' })
  const [fatal, setFatal] = useState<{ error: unknown } | null>(null)
  if (fatal) throw fatal.error

  const connect = async (event: FormEvent) => {
    event.preventDefault()
    const url = baseUrl.trim().replace(/\/+$/, '')
    if (!URL.canParse(url) || !/^https?:$/.test(new URL(url).protocol))
      return setCheck({
        kind: 'error',
        field: 'url',
        text: 'Enter the API’s full address, such as http://localhost:3000/v1.'
      })
    if (!token.trim()) return setCheck({ kind: 'error', field: 'token', text: 'Paste a token first.' })
    const api = { baseUrl: url, token: token.trim() }
    setCheck({ kind: 'checking' })
    try {
      await liveClient(api).getMe()
      setLiveApi(api)
      setToken('')
      setCheck({ kind: 'idle' })
    } catch (error) {
      const text = liveFailure(error, url)
      if (text === null) setFatal({ error })
      else {
        const refused = error instanceof SafeEdgeApiError && error.status === 401
        setCheck({ kind: 'error', field: refused ? 'token' : 'url', text })
      }
    }
  }

  const bad = check.kind === 'error' ? check.field : null
  const edited = () => bad && setCheck({ kind: 'idle' })
  return (
    <Card
      id="api"
      title="Developer API: a live Safe Edge server"
      lead="Point Try it on the Developers page at a running Safe Edge API, with your own token. The rest of the demo keeps running in this page."
      foot={
        <>
          Kept in this tab only. The API must list this page’s origin, <code translate="no">{origin}</code>, in{' '}
          <code translate="no">SAFE_EDGE_CORS_ORIGINS</code>.
        </>
      }
    >
      {liveApi && (
        <div
          className={`state setting-state ${actsAs.kind === 'error' ? 'warn' : actsAs.kind === 'done' ? 'ok' : 'neutral'}`}
        >
          {actsAs.kind === 'error' ? (
            <WarningCircle size={20} weight="bold" aria-hidden="true" />
          ) : (
            <CheckCircle size={20} weight="bold" aria-hidden="true" />
          )}
          <p role="status">
            {actsAs.kind === 'done' ? (
              <>
                Connected to <b translate="no">{liveApi.baseUrl}</b> as{' '}
                <b translate="no">
                  {actsAs.value.id} ({actsAs.value.role})
                </b>
                . <a href="#/developers">Try it</a> calls it now.
              </>
            ) : actsAs.kind === 'error' ? (
              `Saved, but not answering. ${actsAs.text}`
            ) : (
              <>
                Checking <span translate="no">{liveApi.baseUrl}</span>…
              </>
            )}
          </p>
          <button
            type="button"
            className="btn danger small"
            onClick={() => {
              setLiveApi(null)
              setCheck({ kind: 'idle' })
            }}
          >
            Disconnect
          </button>
        </div>
      )}
      <form className="setting-form" onSubmit={connect} noValidate>
        <label htmlFor="api-url">API base URL</label>
        <input
          id="api-url"
          name="api-url"
          type="url"
          inputMode="url"
          autoComplete="url"
          spellCheck={false}
          placeholder="http://localhost:3000/v1"
          value={baseUrl}
          onChange={(e) => {
            setBaseUrl(e.target.value)
            edited()
          }}
          aria-invalid={bad === 'url'}
          aria-describedby={bad === 'url' ? 'api-err api-foot' : 'api-foot'}
        />
        {check.kind === 'error' && check.field === 'url' && <FieldError id="api-err" text={check.text} />}
        <label htmlFor="api-token">API token</label>
        <div className="setting-row">
          <input
            id="api-token"
            name="api-token"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste a token from bun run dev:token…"
            value={token}
            onChange={(e) => {
              setToken(e.target.value)
              edited()
            }}
            aria-invalid={bad === 'token'}
            aria-describedby={bad === 'token' ? 'api-err api-foot' : 'api-foot'}
          />
          <button type="submit" className="btn" disabled={check.kind === 'checking'}>
            {check.kind === 'checking' ? 'Connecting…' : liveApi ? 'Connect instead' : 'Connect'}
          </button>
        </div>
        {check.kind === 'error' && check.field === 'token' && <FieldError id="api-err" text={check.text} />}
      </form>
    </Card>
  )
}
