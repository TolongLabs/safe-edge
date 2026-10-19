import type {
  EvidenceRef,
  ExternalRecordRef,
  ExternalWorkStatus,
  Finding,
  WorkOrderProvider
} from '@safe-edge/contracts'
import * as z from 'zod'

// The WorkOrderProvider port on Procore Observations. Every request below follows Procore's developer docs, read on
// 19 Oct 2026 (paths under https://developers.procore.com; quotes in packages/providers/README.md):
// - Token: the client-credentials grant, POST {login}/oauth/token with a JSON body (documentation/oauth-client-credentials,
//   reference "Authentication").
// - REST: `Authorization: Bearer` and the required `Procore-Company-Id` header (reference "Observations", "Uploads").
// - Photo: a non-segmented direct upload (documentation/tutorial-uploads): create a project upload, POST the file with
//   every returned field to the returned URL without the Procore token, then attach it with `upload_ids`.
// - Observation: POST /rest/v1.0/observations/items and PATCH /rest/v1.0/observations/items/{id}, each with
//   { project_id, observation } (reference "Observations"). Procore does not notify assignees of observations the API
//   creates (documentation/tutorial-observations).

/** The Developer Sandbox hosts (documentation/development-environments). */
export const PROCORE_DEVELOPER_SANDBOX = {
  loginBaseUrl: 'https://login-sandbox.procore.com',
  apiBaseUrl: 'https://sandbox.procore.com'
} as const

/** The Observation Type Safe Edge files findings under: one of Procore's default types (documentation/tutorial-observations). */
export const SAFETY_HAZARD_OBSERVATION_TYPE = 'Safety Hazard'

/** The bytes of a Safe Edge evidence image. */
export type EvidenceReader = (ref: EvidenceRef) => Promise<Uint8Array<ArrayBuffer>>

/** A Procore app's client-credentials (its service account) and the project findings go to. */
export interface ProcoreCredentials {
  clientId: string
  clientSecret: string
  companyId: number
  projectId: number
}

export interface ProcoreConfig extends ProcoreCredentials {
  loginBaseUrl: string
  apiBaseUrl: string
  /** The Observation Type findings are filed under, by name, such as Procore's default 'Safety Hazard'. */
  observationType: string
  readEvidence: EvidenceReader
}

const ENV = {
  clientId: 'PROCORE_CLIENT_ID',
  clientSecret: 'PROCORE_CLIENT_SECRET',
  companyId: 'PROCORE_COMPANY_ID',
  projectId: 'PROCORE_PROJECT_ID'
} as const

/** The credentials from `PROCORE_*` variables: null when none is set, an error when only some are. */
export function readProcoreEnv(env: Record<string, string | undefined>): ProcoreCredentials | null {
  const missing = Object.values(ENV).filter((name) => !env[name])
  if (missing.length === Object.keys(ENV).length) return null
  if (missing.length > 0) throw new Error(`Set ${missing.join(', ')} as well, or no PROCORE_* variable at all`)
  const procoreId = (name: string) => {
    const id = Number(env[name])
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error(`${name} must be a Procore ID, not "${env[name]}"`)
    return id
  }
  return {
    clientId: env[ENV.clientId]!,
    clientSecret: env[ENV.clientSecret]!,
    companyId: procoreId(ENV.companyId),
    projectId: procoreId(ENV.projectId)
  }
}

const Token = z.object({ access_token: z.string().min(1), expires_in: z.number().positive() })
const ObservationType = z.object({
  id: z.number().int(),
  name: z.string(),
  active: z.boolean().optional(),
  parent_inactive: z.boolean().optional()
})
const Upload = z.object({ uuid: z.string().min(1), url: z.string().min(1), fields: z.record(z.string(), z.string()) })
const CreatedObservation = z.object({ id: z.number().int() })

const PRIORITY = { low: 'Low', medium: 'Medium', high: 'High' } as const satisfies Record<Finding['severity'], string>
const STATUS = {
  open: 'initiated',
  ready_for_review: 'ready_for_review',
  rejected: 'not_accepted',
  closed: 'closed'
} as const satisfies Record<ExternalWorkStatus, string>
const EXTENSION = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as const satisfies Record<
  EvidenceRef['mediaType'],
  string
>

async function expectOk(response: Response, request: string): Promise<Response> {
  if (!response.ok) throw new Error(`Procore ${request} answered ${response.status}: ${await response.text()}`)
  return response
}

function observationDescription(finding: Finding): string {
  return [
    `Accepted Safe Edge finding ${finding.id} (candidate ${finding.candidateId}) on segment ${finding.segmentId}.`,
    `Severity ${finding.severity}, confirmed by ${finding.confirmedBy} at ${finding.createdAt}.`,
    ...(finding.simulated ? ['SIMULATED: Safe Edge demo data, not a real defect.'] : [])
  ].join('\n')
}

/** Files accepted findings as Procore Observations, with their photos, through one Procore app's service account. */
export class ProcoreWorkOrderProvider implements WorkOrderProvider {
  readonly #config: ProcoreConfig
  #token: { value: string; expiresAt: number } | null = null

  constructor(config: ProcoreConfig) {
    this.#config = config
  }

  async createFinding(finding: Finding): Promise<ExternalRecordRef> {
    const { projectId } = this.#config
    const created = await this.#rest('POST', '/rest/v1.0/observations/items', CreatedObservation, {
      project_id: projectId,
      observation: {
        name: `Safe Edge ${finding.id}: ${finding.class.replaceAll('_', ' ')} on ${finding.segmentId}`,
        type_id: await this.#observationTypeId(),
        description: observationDescription(finding),
        priority: PRIORITY[finding.severity]
      }
    })
    const path = `/rest/v1.0/observations/items/${created.id}?project_id=${projectId}`
    return { id: String(created.id), url: new URL(path, this.#config.apiBaseUrl).href }
  }

  async addEvidence(ref: ExternalRecordRef, evidence: EvidenceRef[]): Promise<void> {
    if (evidence.length === 0) return
    const uploadIds: string[] = []
    for (const image of evidence) uploadIds.push(await this.#upload(image))
    await this.#patchObservation(ref, { upload_ids: uploadIds })
  }

  /** Procore appends a response log entry and notifies the distribution list when the status changes. */
  async updateStatus(ref: ExternalRecordRef, status: ExternalWorkStatus): Promise<void> {
    await this.#patchObservation(ref, { status: STATUS[status] })
  }

  async #patchObservation(ref: ExternalRecordRef, observation: object): Promise<void> {
    await this.#rest('PATCH', `/rest/v1.0/observations/items/${ref.id}`, CreatedObservation, {
      project_id: this.#config.projectId,
      observation
    })
  }

  /** Create Observation Item requires a `type_id`, and type IDs differ between companies. */
  async #observationTypeId(): Promise<number> {
    const { projectId, observationType } = this.#config
    const types = await this.#rest(
      'GET',
      `/rest/v1.0/observations/types?project_id=${projectId}`,
      z.array(ObservationType)
    )
    const type = types.find((t) => t.name === observationType && t.active !== false && t.parent_inactive !== true)
    if (type === undefined) {
      const names = types.map((t) => t.name).join(', ')
      throw new Error(`Procore project ${projectId} has no active observation type "${observationType}" (${names})`)
    }
    return type.id
  }

  async #upload(image: EvidenceRef): Promise<string> {
    const bytes = await this.#config.readEvidence(image)
    const filename = `${image.id}.${EXTENSION[image.mediaType]}`
    const upload = await this.#rest('POST', `/rest/v1.1/projects/${this.#config.projectId}/uploads`, Upload, {
      response_filename: filename,
      response_content_type: image.mediaType
    })
    // Every field unaltered, then the file part, sent to the storage service without the Procore token.
    const form = new FormData()
    for (const [name, value] of Object.entries(upload.fields)) form.append(name, value)
    form.append('file', new Blob([bytes], { type: image.mediaType }), filename)
    await expectOk(await fetch(upload.url, { method: 'POST', body: form }), `storage upload of ${image.id}`)
    return upload.uuid
  }

  async #rest<S extends z.ZodType>(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    schema: S,
    body?: object
  ): Promise<z.output<S>> {
    const response = await fetch(new URL(path, this.#config.apiBaseUrl), {
      method,
      headers: {
        Authorization: `Bearer ${await this.#accessToken()}`,
        'Procore-Company-Id': String(this.#config.companyId),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    })
    return schema.parse(await (await expectOk(response, `${method} ${path}`)).json())
  }

  async #accessToken(): Promise<string> {
    if (this.#token !== null && Date.now() < this.#token.expiresAt) return this.#token.value
    const { loginBaseUrl, clientId, clientSecret } = this.#config
    const response = await fetch(new URL('/oauth/token', loginBaseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret })
    })
    const token = Token.parse(await (await expectOk(response, 'POST /oauth/token')).json())
    // Renewed a minute early, so a token never lapses mid-request.
    this.#token = { value: token.access_token, expiresAt: Date.now() + (token.expires_in - 60) * 1000 }
    return token.access_token
  }
}
