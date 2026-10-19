// Procore contract double. It is not Procore: a local HTTP server that accepts only the requests the workorder-procore
// adapter sends, in the shapes Procore documents, and answers in the documented response shapes. It checks shapes and
// the upload rules below, not permissions, configurable fieldsets or real storage policies. Anything else gets a 400
// from the double, so a drifting request fails the test.
//
// Sources, read on 19 Oct 2026 from developers.procore.com (the reference is the OpenAPI JSON the reference pages load
// from /api/v1/resource_groups/resource/<name>):
// - Token: documentation/oauth-client-credentials and reference "Authentication", POST /oauth/token (JSON body).
// - Every REST call: `Authorization: Bearer <token>` and the required `Procore-Company-Id` header.
// - Types: reference "Observations", GET /rest/v1.0/observations/types?project_id=.
// - Uploads: documentation/tutorial-uploads "Non-Segmented Direct Uploads" and reference "Uploads", POST
//   /rest/v1.1/projects/{project_id}/uploads returning { uuid, url, fields }; then a multipart POST to `url` with every
//   field unchanged plus `file`, without the Procore token.
// - Observations: reference "Observations", POST /rest/v1.0/observations/items and PATCH .../items/{id}, each with a
//   JSON body { project_id, observation }; `observation.upload_ids` attaches completed uploads.
import * as z from 'zod'

const ObservationStatus = z.enum(['initiated', 'ready_for_review', 'not_accepted', 'closed', 'draft'])

const TokenRequest = z.strictObject({
  grant_type: z.literal('client_credentials'),
  client_id: z.string(),
  client_secret: z.string()
})
const UploadRequest = z.strictObject({ response_filename: z.string().min(1), response_content_type: z.string().min(1) })

/** Procore's default types (documentation/tutorial-observations), in the reference's List Observation Types shape. */
const TYPES = [
  { id: 69257, name: 'Commissioning', category: 'Commissioning', category_key: 'commissioning', category_id: 11 },
  { id: 69258, name: 'Deficiency', category: 'Quality', category_key: 'quality', category_id: 12 },
  { id: 69259, name: 'Safety Hazard', category: 'Safety', category_key: 'safety', category_id: 13 },
  { id: 69260, name: 'Warranty', category: 'Warranty', category_key: 'warranty', category_id: 14 }
].map((type) => ({
  ...type,
  active: true,
  company_active: true,
  parent_inactive: false,
  in_use: false,
  kind: 'company'
}))

export interface ProcoreDoubleObservation {
  id: number
  number: string
  name: string
  description: string | null
  priority: 'Low' | 'Medium' | 'High' | 'Urgent' | null
  status: z.infer<typeof ObservationStatus>
  type: { id: number; name: string }
  /** Null until someone sends it: the API does not notify on create (documentation/tutorial-observations). */
  date_notified: null
  attachments: { id: number; name: string; url: string; viewer_url: string }[]
}

export function startProcoreDouble(options: {
  clientId: string
  clientSecret: string
  companyId: number
  projectId: number
}) {
  const { companyId, projectId } = options
  const tokens = new Set<string>()
  const uploads = new Map<string, { filename: string; fields: Record<string, string>; file: Uint8Array | null }>()
  const files = new Map<number, Uint8Array>()
  const observations: ProcoreDoubleObservation[] = []
  let tokenRequests = 0
  let counter = 0
  const next = () => ++counter

  const json = (body: unknown, status = 200) => Response.json(body, { status })
  const reject = (status: number, message: string) => json({ code: status, message, error: message }, status)

  /** The documented headers on every REST call: a live bearer token and the company ID. */
  function refuseHeaders(request: Request): Response | undefined {
    const token = /^Bearer (\S+)$/.exec(request.headers.get('authorization') ?? '')?.[1]
    if (token === undefined || !tokens.has(token)) return reject(401, 'Invalid Token')
    if (request.headers.get('procore-company-id') !== String(companyId)) {
      return reject(400, `Procore-Company-Id must be ${companyId}`)
    }
  }

  /** The headers, then the JSON body parsed with `schema`, or the refusal. */
  async function readBody<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S> | Response> {
    const refused = refuseHeaders(request)
    if (refused) return refused
    if (request.headers.get('content-type') !== 'application/json') return reject(400, 'Send application/json')
    const parsed = schema.safeParse(await request.json())
    return parsed.success ? parsed.data : reject(400, z.prettifyError(parsed.error))
  }

  const ObservationRequest = <O extends z.ZodType>(observation: O) =>
    z.strictObject({ project_id: z.literal(projectId), observation })

  const server = Bun.serve({
    port: 0,
    routes: {
      '/oauth/token': {
        POST: async (request) => {
          tokenRequests++
          const body = TokenRequest.safeParse(await request.json())
          if (!body.success) return reject(400, z.prettifyError(body.error))
          if (body.data.client_id !== options.clientId || body.data.client_secret !== options.clientSecret) {
            return json({ error: 'invalid_client', error_description: 'Client authentication failed' }, 401)
          }
          const accessToken = `procore_double_token_${next()}`
          tokens.add(accessToken)
          return json({
            access_token: accessToken,
            token_type: 'bearer',
            expires_in: 5400,
            created_at: Math.floor(Date.now() / 1000)
          })
        }
      },

      '/rest/v1.0/observations/types': {
        GET: async (request) => {
          const refused = refuseHeaders(request)
          if (refused) return refused
          const query = new URL(request.url).searchParams
          if (query.get('project_id') !== String(projectId)) return reject(400, `project_id must be ${projectId}`)
          return json(TYPES)
        }
      },

      '/rest/v1.1/projects/:project_id/uploads': {
        POST: async (request) => {
          if (request.params.project_id !== String(projectId)) return reject(404, 'No such project')
          const body = await readBody(request, UploadRequest)
          if (body instanceof Response) return body
          const uuid = `01SAFEEDGEDOUBLE${String(next()).padStart(10, '0')}`
          const fields = {
            key: `companies/${companyId}/${uuid}`,
            'Content-Type': body.response_content_type,
            'Content-Disposition': `inline; filename="${body.response_filename}"`,
            policy: btoa(JSON.stringify({ uuid })),
            'x-amz-credential': 'DOUBLE/20261019/us-east-1/s3/aws4_request',
            'x-amz-algorithm': 'AWS4-HMAC-SHA256',
            'x-amz-date': '20261019T000000Z',
            'x-amz-signature': uuid.toLowerCase()
          }
          uploads.set(fields.key, { filename: body.response_filename, fields, file: null })
          return json({ uuid, url: new URL('/storage', request.url).href, fields }, 201)
        }
      },

      // The storage service. Procore: "Don't send your Procore access token in this request", include every field
      // from the Create Upload response unaltered, and name the file part `file`.
      '/storage': {
        POST: async (request) => {
          if (request.headers.has('authorization')) return reject(400, 'The storage POST must not carry a token')
          const form = await request.formData()
          const upload = uploads.get(String(form.get('key')))
          if (upload === undefined) return reject(403, 'Unknown key')
          for (const [name, value] of Object.entries(upload.fields)) {
            if (form.get(name) !== value) return reject(403, `Field ${name} is missing or altered`)
          }
          const names = [...form.keys()]
          if (names.at(-1) !== 'file' || names.length !== Object.keys(upload.fields).length + 1) {
            return reject(400, 'Send exactly the issued fields, then the file part last')
          }
          const file = form.get('file')
          if (!(file instanceof Blob)) return reject(400, 'The file part is missing')
          upload.file = new Uint8Array(await file.arrayBuffer())
          return new Response(null, { status: 204 })
        }
      },

      '/rest/v1.0/observations/items': {
        POST: async (request) => {
          const body = await readBody(
            request,
            ObservationRequest(
              z.strictObject({
                name: z.string().min(1),
                type_id: z.number().int(),
                description: z.string().optional(),
                priority: z.enum(['Low', 'Medium', 'High', 'Urgent']).optional()
              })
            )
          )
          if (body instanceof Response) return body
          const type = TYPES.find((t) => t.id === body.observation.type_id)
          if (type === undefined) return reject(422, `No observation type ${body.observation.type_id}`)
          const id = next()
          const observation: ProcoreDoubleObservation = {
            id,
            number: String(observations.length + 1),
            name: body.observation.name,
            description: body.observation.description ?? null,
            priority: body.observation.priority ?? null,
            status: 'initiated',
            type: { id: type.id, name: type.name },
            date_notified: null,
            attachments: []
          }
          observations.push(observation)
          return json(observation, 201)
        }
      },

      '/rest/v1.0/observations/items/:id': {
        PATCH: async (request) => {
          const observation = observations.find((o) => String(o.id) === request.params.id)
          if (observation === undefined) return reject(404, 'No such observation')
          const body = await readBody(
            request,
            ObservationRequest(
              z.union([
                z.strictObject({ upload_ids: z.array(z.string()).min(1) }),
                z.strictObject({ status: ObservationStatus })
              ])
            )
          )
          if (body instanceof Response) return body
          if ('status' in body.observation) observation.status = body.observation.status
          else {
            for (const uuid of body.observation.upload_ids) {
              const upload = uploads.get(`companies/${companyId}/${uuid}`)
              if (upload?.file == null) return reject(422, `Upload ${uuid} was never stored`)
              const fileId = next()
              files.set(fileId, upload.file)
              observation.attachments.push({
                id: fileId,
                name: upload.filename,
                url: new URL(`/files/${fileId}`, request.url).href,
                viewer_url: `/webclients/host/companies/${companyId}/projects/${projectId}/tools/document-viewer/prostore/${fileId}?item_type=Observations%3A%3AItem&item_id=${observation.id}&parent_id=${observation.id}&fullscreen`
              })
            }
          }
          return json(observation)
        }
      }
    },
    fetch: () => reject(404, 'The Procore double does not serve this path')
  })

  return {
    /** Both base URLs: the double serves the login host's /oauth/token and the API host's /rest paths. */
    url: server.url.href.replace(/\/$/, ''),
    observations,
    /** The stored bytes of an attachment, as Procore would serve them from its `url`. */
    file: (attachmentId: number) => files.get(attachmentId),
    tokenRequests: () => tokenRequests,
    stop: () => server.stop(true)
  }
}
