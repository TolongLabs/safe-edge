# Safe Edge agent layer: MCP, guardrails and AI governance

Research pack for Safe Edge's drone and AI layer. One Codex worker researched it and a second worker checked every claim against its source on 17 October 2026. See the [summary](/docs/research/drone-integration.md) for how it changed the design.

Contents:

1.  [Summary](#summary)
1.  [Findings](#findings)
    1.  [1. Model Context Protocol and TypeScript SDK](#1-model-context-protocol-and-typescript-sdk)
    1.  [2. Agent design for operations](#2-agent-design-for-operations)
    1.  [3. Guardrails for safety-relevant decisions](#3-guardrails-for-safety-relevant-decisions)
    1.  [4. AI governance frameworks and classification](#4-ai-governance-frameworks-and-classification)
    1.  [5. Prompt injection from imagery or text](#5-prompt-injection-from-imagery-or-text)
    1.  [6. Notification and integration channels](#6-notification-and-integration-channels)
    1.  [7. Recommended agent-layer design](#7-recommended-agent-layer-design)
1.  [Recommendations for Safe Edge](#recommendations-for-safe-edge)
1.  [What we can and cannot claim](#what-we-can-and-cannot-claim)
1.  [Open questions](#open-questions)
1.  [Sources](#sources)

## Summary

- The current MCP specification is dated 2026-07-28. It makes the protocol stateless, changes server requests for user input to multi-round-trip requests, and hardens authorization; the official TypeScript server package is @modelcontextprotocol/server 2.3.1. [Specification](https://modelcontextprotocol.io/specification/2026-07-28), [release notes](https://blog.modelcontextprotocol.io/posts/2026-07-28/), [SDK releases](https://github.com/modelcontextprotocol/typescript-sdk/releases)
- Analyst's read: MCP gives Safe Edge a useful integration contract. Its tools are model-callable; the guidance expects a human to be able to deny tool calls, and the server must still enforce permissions itself. [Tools specification](https://modelcontextprotocol.io/specification/2026-07-28/server/tools), [authorization specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
- Analyst's read: Use a deterministic patrol and inspection workflow with one constrained agent for evidence summaries, triage and drafts. Do not split a single-asset pilot into a swarm of autonomous agents. [Anthropic’s agent design guidance](https://www.anthropic.com/engineering/building-effective-agents)
- Malaysia’s 2024 AIGE guidelines and AICE are voluntary. The Personal Data Protection Act applies to personal-data processing connected with commercial transactions; the 2024 amendments took effect in stages on 1 January, 1 April and 1 June 2025. In October 2026, the Digital Ministry said its proposed AI Governance Bill was still being drafted and was expected to be tabled in early 2027. [AIGE guideline](https://www.mosti.gov.my/wp-content/uploads/2024/09/NATIONAL-GUIDELINES-OF-AIGE-20241118.pdf), [AICE](https://ai.gov.my/governance/ai-code-of-ethics-aice/), [PDPA scope](https://www.pdp.gov.my/ppdpv1/en/akta/application-and-non-application-of-the-act/), [amendment commencement order](https://www.pdp.gov.my/ppdpv1/wp-content/uploads/2024/12/PENETAPAN-TARIKH-PERMULAAN-KUAT-KUASA.pdf), [Parliament Hansard, 5 October 2026](https://hansard.parlimen.gov.my/hansard/dewan-rakyat/2026-10-05)
- Analyst's read: Vision models can be manipulated by adversarial image content; published research also describes attacks using text in physical scenes. Treat signs, graffiti, image metadata and tool outputs as untrusted evidence, not instructions. [ICML paper, 2024](https://proceedings.mlr.press/v235/bailey24a.html), [2026 preprint](https://arxiv.org/abs/2607.10269)
- SDP publicly describes a property-owner app and a Procore integration history. Staff-facing SDP maintenance/review app: not found in public sources. Exact current WhatsApp MYR rates were not verifiable from Meta’s accessible pricing page, which conflicts with third-party reports about changes from 1 October 2026. [SDP app](https://www.simedarbyproperty.com/app/?thankyou=true), [Procore customer story](https://www.procore.com/en-sg/casestudies/sime-darby-property), [Meta pricing](https://whatsappbusiness.com/products/platform-pricing/)
- CAAM requires prior authorization for UAS operations. Its current page places research and development under Special UAS Project approval; standard ATF applies to low-risk VLOS/EVLOS operations under 400 ft AGL without spraying or dispensing. CAAM asks for applications at least 14 working days ahead, with landowner permission and a Google Earth KML or KMZ location file. [CAAM UAS approvals](https://www.caam.gov.my/public/unmanned-aircraft-system-uas/), [CAAM Safety Information 01/2025](https://www.caam.gov.my/wp-content/uploads/2025/02/SI-01_2025-ATF-Application-for-UAS-Operations-Including-Operations-Related-to-Training.pdf)

## Findings

### 1. Model Context Protocol and TypeScript SDK

The current published MCP specification is 2026-07-28. [MCP specification](https://modelcontextprotocol.io/specification/2026-07-28)

Changes since 2025 include:

- The 2025-06-18 revision added structured tool output, OAuth-based authorization and protected-resource discovery, resource indicators, elicitation, and updated security guidance. [2025-06-18 changelog](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2025-06-18/changelog.mdx)
- The 2025-11-25 revision added authorization extensions and URL-mode elicitation for sensitive, out-of-band user interactions. [2025-11-25 release notes](https://blog.modelcontextprotocol.io/posts/2025-11-25-first-mcp-anniversary/)
- The 2026-07-28 revision removed the initialization handshake and protocol session ID, made requests self-contained, added header-based routing and cache hints, moved long-running Tasks into an extension, and replaced server-initiated requests with Multi Round-Trip Requests (MRTR). It also hardened OAuth issuer validation and moved away from Dynamic Client Registration toward client metadata documents. [2026-07-28 release notes](https://blog.modelcontextprotocol.io/posts/2026-07-28/)

The official TypeScript SDK is in the [modelcontextprotocol/typescript-sdk repository](https://github.com/modelcontextprotocol/typescript-sdk). Its v2 line splits the old single package into packages; the server package is **@modelcontextprotocol/server**, and the latest release found by this research was **2.3.1**, released 5 October 2026. [SDK v2 documentation](https://ts.sdk.modelcontextprotocol.io/v2/), [release page](https://github.com/modelcontextprotocol/typescript-sdk/releases)

For a local prototype, the official server guide creates an **McpServer**, registers tools with **registerTool(name, config, handler)**, defines each **inputSchema** with Zod, and passes the server factory to **serveStdio** from **@modelcontextprotocol/server/stdio**. The SDK derives JSON Schema and validates tool arguments before the handler runs. Log to stderr because stdout carries the protocol. [First-server guide](https://ts.sdk.modelcontextprotocol.io/v2/get-started/first-server)

MCP’s three server primitives have different interaction roles: tools are model-controlled; resources are application-driven context; prompts are user-controlled templates. [Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools), [resources](https://modelcontextprotocol.io/specification/2026-07-28/server/resources), [prompts](https://modelcontextprotocol.io/specification/2026-07-28/server/prompts)

Analyst's read: Safe Edge can use tools for bounded operations, resources for read-only edge and evidence records, and prompts for user-selected triage or work-order drafting workflows.

**Version trap:** SDK v2 supports the 2026-07-28 revision, but a hand-constructed client or server does not automatically put that revision on the wire. The SDK documentation says it can continue speaking the 2025-era protocol unless the 2026 revision support is configured. [SDK support for 2026-07-28](https://ts.sdk.modelcontextprotocol.io/v2/migration/support-2026-07-28)

Analyst's read: Verify the negotiated/request protocol in the demo and follow the SDK’s version-specific migration guidance. The SDK migration guide says v2 opts into the 2026 revision explicitly; its client defaults to the 2025 handshake unless version negotiation is configured.

MCP authorization is optional overall. For protected HTTP transports, the spec defines an OAuth 2.1-based profile using the relevant OAuth and OpenID Connect discovery standards; the spec lists the OAuth 2.1 IETF draft among its bases. It requires servers to validate that a token is intended for that server, prohibits token pass-through, and recommends least-privilege scope challenges. The spec says stdio servers should instead receive credentials from the environment. [Authorization specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)

Elicitation lets a server request user input through the client. Form mode supports structured input; URL mode moves sensitive credentials or third-party authorization outside the client. The client must identify the requesting server, let users review and decline, and show the URL destination and obtain consent before navigation. In the current spec, the request is returned as input-required and the client supplies input on a retry. Elicitation is an input mechanism, not an authorization grant or proof that a safety decision was approved. [Elicitation specification](https://modelcontextprotocol.io/specification/2026-07-28/client/elicitation), [MRTR release notes](https://blog.modelcontextprotocol.io/posts/2026-07-28/)

For local stdio, the server process runs with the client’s environment-level privileges; the official security model says stdio is not a sandbox. [MCP security model](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/SECURITY.md)

Analyst's read: Remote deployment should use a protected HTTP server and server-side access control. The 2026 revision’s stateless request model can run across ordinary load-balanced HTTP infrastructure, but it does not replace application authorization. [Authorization specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization), [2026-07-28 release notes](https://blog.modelcontextprotocol.io/posts/2026-07-28/)

Official MCP security guidance warns against broad scopes, wildcard permissions, token pass-through and trusting token scope claims without server-side checks. MCP’s trust model also says a model may call tools based on descriptions in ways the user did not explicitly request. [Security best practices](https://modelcontextprotocol.io/docs/2025-11-25/tutorials/security/security_best_practices), [MCP security model](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/SECURITY.md)

Analyst's read: Treat tool poisoning as a realistic configuration risk: a trusted-looking server or changed tool description can influence model behavior. Allowlist servers, pin and review tool definitions, sandbox local processes, validate all inputs, and enforce permissions on the server.

### 2. Agent design for operations

Anthropic distinguishes fixed workflows, where code directs each step, from agents, where a model chooses its own steps and tool use. It recommends starting with the simplest design and adding complexity only when it improves results. Anthropic notes that the tooling landscape described in this December 2024 article has changed, so use it as architecture guidance rather than current product documentation. [Building effective agents, 19 December 2024](https://www.anthropic.com/engineering/building-effective-agents)

The Claude Agent SDK offers a programmable agent loop with tools, permissions, hooks, sessions, MCP connections and optional subagents. OpenAI’s Agents SDK describes both a central manager that calls specialists as tools and handoffs that transfer control between agents. [Claude Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview), [OpenAI Agents SDK orchestration](https://openai.github.io/openai-agents-python/multi_agent/)

Analyst's read: These are useful orchestration patterns, not a reason to make every role a separate agent.

| Candidate          | Useful responsibility                                                                                                                    | Boundary for Safe Edge                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Patrol planner     | Analyst's read: Use deterministic schedules and approved weather/event rules to propose patrols.                                         | Analyst's read: Do not let an LLM create or alter a flight plan without an authorized operator. |
| Triage agent       | Analyst's read: Summarize the changed area, cite the image and baseline IDs, label uncertainty, and suggest a priority for staff review. | Analyst's read: Do not infer “safe” from no detection or a low model score.                     |
| Work-order drafter | Analyst's read: Convert a staff-confirmed finding into a draft task with location, evidence and suggested repair options.                | Analyst's read: Do not submit or close work orders.                                             |
| Escalation agent   | Analyst's read: Draft an urgent internal notification from a policy-coded severity and a named owner.                                    | Analyst's read: Do not send public warnings or contact emergency services autonomously.         |
| Governance agent   | Analyst's read: Keep this as deterministic policy checks, audit records and human review queues, not a free-running LLM.                 | Analyst's read: No model-issued safety pass or self-approval.                                   |

**Analyst's read:** The minimum useful build is one constrained triage-and-drafting agent inside a deterministic workflow. Keep drone scheduling, image comparison, thresholds, alert routing, audit records and approval state transitions in ordinary services. This shows useful agent behavior while avoiding the “existing app plus AI” pattern: the differentiator is a provenance-linked inspection-to-retest loop, not a chatbot. [Anthropic agent guidance](https://www.anthropic.com/engineering/building-effective-agents)

### 3. Guardrails for safety-relevant decisions

**Analyst's read:** Give the agent a short-lived identity with only read, propose and draft capabilities. Suggested scopes are **edge.read**, **inspection.read**, **finding.propose**, **workorder.draft**, **notice.draft** and **patrol.propose**. Do not issue **edge.pass.accept**, **repair.verify**, **workorder.submit** or **notice.send** to any agent. These are proposed Safe Edge scopes, not MCP standard scopes.

MCP supports authorization-dependent tool lists, but the server must enforce authorization for each request and validate token audience. The official security guidance explicitly warns that a scope claim by itself is not authorization. [Tools specification](https://modelcontextprotocol.io/specification/2026-07-28/server/tools), [authorization specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization), [security best practices](https://modelcontextprotocol.io/docs/2025-11-25/tutorials/security/security_best_practices)

**Analyst's read:** Put the state machine on the server. An agent can create only a candidate finding or draft. The server rejects any attempt to transition an edge to accepted, verified or passed unless the request comes from an authorized human account, the edge is in the correct state, and all required evidence is present. A client confirmation dialog is useful, but it is not the enforcement boundary.

**Analyst's read:** Require two different people for repair acceptance: the maintenance owner records that work is complete, then an independent inspector performs and records the retest. Prevent self-approval in server policy. If evidence is missing, stale or inconclusive, keep the edge unverified and schedule another inspection. An internal expiring pass should describe the evidence and review window; it must not read as a safety certificate.

**Analyst's read:** Record an append-only event for every capture, model result, proposed finding, human decision, work-order draft, repair claim, retest and pass-state transition. Store the actor identity, timestamp, edge and image IDs, baseline version, model/configuration identifier, tool name, arguments, server authorization result, reviewer decision and before/after state. Retain source-image provenance and an integrity hash. Apply per-user and per-edge rate limits to tool calls, patrol requests and notifications; make retries idempotent and alert on repeated denials. Set numeric limits with the pilot owner after workload measurement rather than inventing them for the demo.

Analyst's read: These precedents support keeping a qualified person responsible for interpretation:

- Analyst's read: A 2022 bridge-inspection study combined AI defect localization with a human inspector who could correct detections, adjust thresholds and approve the next analysis step. The authors describe the result as human-verified inspection support. This is a research precedent, not a Safe Edge performance claim. [Advanced bridge visual inspection using real-time machine learning in edge devices](https://link.springer.com/article/10.1186/s43251-022-00073-y)
- Analyst's read: The US FDA’s NinesAI 510(k) summary (K193351) was prepared on 17 April 2020; FDA’s database lists the decision date as 21 April 2020. The summary describes AI that flags suspected critical head-CT findings to help radiologists prioritize review. It states that trained radiologists still review studies and the software should not be relied on to diagnose. This is a medical-imaging precedent, not a Malaysian rule for parks. [FDA NinesAI 510(k) summary](https://www.accessdata.fda.gov/cdrh_docs/pdf19/K193351.pdf), [FDA 510(k) database record](https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpmn/pmn.cfm?ID=K193351)

### 4. AI governance frameworks and classification

Malaysia launched its National Guidelines on AI Governance and Ethics (AIGE) on 20 September 2024. The guidelines give seven principles: fairness; reliability, safety and control; privacy and security; inclusiveness; transparency; accountability; and pursuit of human benefit and happiness. The official guideline calls them voluntary. [MOSTI AIGE guideline](https://www.mosti.gov.my/wp-content/uploads/2024/09/NATIONAL-GUIDELINES-OF-AIGE-20241118.pdf), [MOSTI launch notice in Malay](https://www.mosti.gov.my/berita/garis-panduan-tadbir-urus-dan-etika-kecerdasan-buatan-negara-aige/)

Malaysia’s AI Malaysia / National AI Office portal describes the AI Code of Ethics (AICE) as voluntary and non-binding. It maps the AIGE principles to lifecycle practices. The Ministry of Digital said on 10 July 2026 that the proposed AI Governance Bill was still in consultation and policy formulation. In Parliament on 5 October 2026, the Digital Minister said it was being drafted and expected to be tabled in early 2027. The same Hansard discusses the National AI Action Plan 2026–2030 and Malaysia AI Safety Institute. [AICE](https://ai.gov.my/governance/ai-code-of-ethics-aice/), [Ministry of Digital, 10 July 2026](https://www.digital.gov.my/en-GB/siaran/Kementerian-Digital-Mulakan-Libat-Urus-Cadangan-Rang-Undang-Undang-Tadbir-Urus-Kecerdasan-Buatan-%28AI%29), [Parliament Hansard, 5 October 2026](https://hansard.parlimen.gov.my/hansard/dewan-rakyat/2026-10-05)

| Framework                                    | Classification or status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Safe Edge mapping                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Malaysia AIGE and AICE                       | AIGE is a voluntary national guideline; AICE is voluntary and non-binding. [AIGE](https://www.mosti.gov.my/wp-content/uploads/2024/09/NATIONAL-GUIDELINES-OF-AIGE-20241118.pdf), [AICE](https://ai.gov.my/governance/ai-code-of-ethics-aice/)                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Analyst's read: Map the seven principles to requirements: documented image provenance and limits; human review; role-based access; notices and privacy controls for people captured; appeal/correction path; named maintenance and independent reviewers; ongoing testing.                                                                                                                                               |
| Malaysia Personal Data Protection Act (PDPA) | The Act covers processing of personal data in connection with commercial transactions. The 2024 amendments commenced in stages on 1 January, 1 April and 1 June 2025. [PDPA scope](https://www.pdp.gov.my/ppdpv1/en/akta/application-and-non-application-of-the-act/), [commencement order](https://www.pdp.gov.my/ppdpv1/wp-content/uploads/2024/12/PENETAPAN-TARIKH-PERMULAAN-KUAT-KUASA.pdf)                                                                                                                                                                                                                                                                                                             | Analyst's read: If drone images capture identifiable people, determine SDP's controller/processor roles, privacy notice, access, retention and redaction rules before capture or demo.                                                                                                                                                                                                                                   |
| Proposed Malaysian AI Governance Bill        | The Digital Ministry described it as proposed in July 2026; Hansard on 5 October 2026 said it remained in drafting and was expected to be tabled in early 2027. [Ministry of Digital](https://www.digital.gov.my/en-GB/siaran/Kementerian-Digital-Mulakan-Libat-Urus-Cadangan-Rang-Undang-Undang-Tadbir-Urus-Kecerdasan-Buatan-%28AI%29), [Hansard](https://hansard.parlimen.gov.my/hansard/dewan-rakyat/2026-10-05)                                                                                                                                                                                                                                                                                        | Analyst's read: Do not pitch the proposal as a current legal duty. Keep a bill-watch item in pilot governance and remap controls if the law changes.                                                                                                                                                                                                                                                                     |
| NIST AI RMF 1.0 and Generative AI Profile    | NIST describes RMF 1.0 as voluntary and says a revised version is in progress. The Core uses Govern, Map, Measure and Manage. NIST’s Generative AI Profile is AI 600-1, published 26 July 2024. [NIST AI RMF overview](https://www.nist.gov/itl/ai-risk-management-framework), [NIST RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/), [NIST resources](https://www.nist.gov/itl/ai-risk-management-framework/ai-risk-management-framework-resources), [Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf), [NIST publication record](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence) | Analyst's read: Use Govern for owner and approval policy; Map for drowning-risk context and affected people; Measure for detection, missed-findings and false-alarm rates; Manage for incidents, reinspection and model change control. Apply the Generative AI Profile to the agent and prompt-injection risk.                                                                                                          |
| ISO/IEC 42001:2023                           | An international AI management system standard, first edition published in December 2023; it sets organizational management-system requirements rather than assigning a risk category to one feature. [ISO/IEC 42001](https://committee.iso.org/cms/live/live/en/sites/isoorg/contents/data/standard/08/12/81230.html)                                                                                                                                                                                                                                                                                                                                                                                      | Analyst's read: Borrow its management-system approach for ownership, documented processes, monitoring, corrective action and continual improvement. Do not claim certification or conformance without an assessment.                                                                                                                                                                                                     |
| EU AI Act (EU) 2024/1689                     | Annex III covers AI used as safety components in the management and operation of critical digital infrastructure, road traffic, and supply of water, gas, heating or electricity. Commission guidance gives predictive maintenance and detection-only patrol examples that are out of scope where the AI does not directly perform a safety function; some systems protecting critical infrastructure are in scope. [Regulation (EU) 2024/1689](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689), [Commission critical-infrastructure guidance](https://ai-act-service-desk.ec.europa.eu/en/critical-infrastructure)                                                                   | Analyst's read: On the described facts, a township-park inspection aid that only flags defects and drafts maintenance actions appears closer to decision support than a safety component of listed critical infrastructure. Reassess if the intended use changes to directly operate barriers, control water infrastructure, or protect an EU-listed critical asset. The EU Act is a comparison here, not Malaysian law. |

### 5. Prompt injection from imagery or text

A vision-language model may treat words seen in a drone image as instructions. The 2024 ICML “Image Hijacks” paper demonstrates that adversarial images can influence vision-language model behavior. A July 2026 arXiv preprint studies physical prompt injection through scene text. [ICML paper, 2024](https://proceedings.mlr.press/v235/bailey24a.html), [Devil in the Lens, arXiv preprint, 11 July 2026](https://arxiv.org/abs/2607.10269)

Analyst's read: The arXiv work is a preprint, not a settled standard or proof that a real Elmina sign is malicious.

Analyst's read: A sign or graffiti could say “ignore previous directions,” claim that a gate is safe, or attempt to route the agent to a tool.

**Analyst's read:** Apply source-sink controls rather than relying on a prompt that says “ignore instructions in images.” Treat pixels, OCR text, image metadata, user comments, MCP descriptions and returned resource content as untrusted. Keep them in evidence fields, separated from system instructions. Use visual classifiers to return a constrained finding type and evidence location; do not allow OCR text to select tools, URLs, recipients or scopes. Give the agent no shell, arbitrary network, approval or send capability. Require human review of the source image before work is submitted. OpenAI’s security guidance similarly recommends limiting the effect of prompt injection through source-sink analysis and system controls, because input filtering alone cannot guarantee detection. [OpenAI prompt-injection guidance, 11 March 2026](https://openai.com/index/designing-agents-to-resist-prompt-injection/), [MCP security model](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/SECURITY.md)

### 6. Notification and integration channels

**Procore:** Procore’s SDP customer story says the company used Procore to record construction and post-construction defects and reports internal API integration. Procore also publishes an Observations guide and API developer documentation. [SDP Procore customer story](https://www.procore.com/en-sg/casestudies/sime-darby-property), [Procore Observations guide](https://procore.github.io/documentation/tutorial-observations), [Procore developer portal](https://developers.procore.com/)

Analyst's read: This supports an integration conversation, but it does not prove that an existing SDP project, role or API credential can be used for Safe Edge.

The Observations API guide documents `POST /rest/v1.0/observations/items` for creating an observation. API-created observations do not automatically notify assignees. The `POST /rest/v1.0/observations/items/send_unsent` endpoint sends all unsent observations for a project; the guide says individual observations can only be sent through Procore’s web interface. Do not treat that API endpoint as a per-finding notification call. [Procore Observations guide](https://procore.github.io/documentation/tutorial-observations)

Analyst's read: Use an SDP-approved maintenance mailbox or existing ticketing route for pilot staff alerts. I found no public source naming SDP’s internal operational mail system or alert mailbox. Send drafts to a human owner; do not email residents directly from the agent.

**WhatsApp Business Platform:** Meta’s policy, last updated 23 September 2026, requires recipient opt-in; business-initiated conversations need approved message templates; free-form replies are allowed within the 24-hour customer service window; automated replies need clear paths to a human, phone, email or support form. [WhatsApp Business Messaging Policy](https://whatsappbusiness.com/policy/)

Analyst's read: Pricing remains uncertain at the requested 17 October 2026 research cut-off. Meta’s accessible pricing page says billing is per delivered message and varies by recipient market and category, but its rendered rate selector has no visible amount and its text says service messages and in-window utility replies are free. The attempted Meta developer rate-card page was inaccessible in this research. [Meta pricing page](https://whatsappbusiness.com/products/platform-pricing/), [Meta for Developers pricing page](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)

A Malaysian provider page updated 10 October 2026 reports RM 0.3467 per delivered marketing message and RM 0.0564 per delivered utility or authentication message; it also reports that from 1 October 2026 service replies are free for the first 1,000 per business phone number each month, then RM 0.0564 per delivered reply. Those are secondary estimates, not verified from the accessible Meta rate card. [BixTech pricing article, 10 October 2026](https://bixtech.co/blog/whatsapp-business-api-pricing-malaysia)

Analyst's read: Do not put those amounts in a committed budget until SDP or its provider confirms the live rate card.

**SDP app:** SDP publicly describes the Sime Darby Property App as a property-owner/member app with owner features such as progress, e-documents, vacant possession and defect reports. The FAQ describes app registration and customer support. This is evidence of a resident/owner channel, not evidence of an internal maintenance review app. [SDP app](https://www.simedarbyproperty.com/app/?thankyou=true), [SDP app FAQ](https://www.simedarbyproperty.com/app/faq.html)

**Analyst's read:** For a pilot, route internal findings to Procore or an approved maintenance email; use the resident app or WhatsApp only for human-approved notices after confirming audience, opt-in, template and privacy requirements. The staff-facing app: **Not found**. Search performed: SDP’s public app and FAQ pages and site searches for a staff or operations app.

No public listing was found in the sources and site searches checked. This does not prove that an internal staff app does not exist.

### 7. Recommended agent-layer design

**Analyst's read:** Use one agent behind a deterministic workflow:

1. A capture service stores the real image, time, location, edge ID, capture conditions and provenance. A deterministic comparison service links the new image to the last accepted baseline and creates candidate detections.
2. The agent reads only authorized evidence and asset context. It summarizes possible change, cites evidence IDs, notes uncertainty and drafts a work order or escalation.
3. Server policy checks the proposed action and actor scope. A human reviews the finding and submits the work order through SDP’s approved system.
4. The maintenance owner records repair completion. A different authorized inspector requests or performs a retest. Only the independent human path can change the internal edge state.
5. The pass record expires under a policy set by SDP and is invalidated by a new event, missing coverage or a failed retest. A missing flag never creates a pass.

Analyst's read: Use a remote, protected MCP server for the pilot integration. Keep local stdio for isolated development only. The MCP server should expose resources and draft/proposal tools, and omit approval tools entirely. The current MCP spec supports scope-dependent tool lists and human-deniable tool calls. [MCP authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization), [MCP tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)

Before a live flight, check CAAM authorization requirements. CAAM says UAS operations require prior authorization; standard ATF covers low-risk VLOS or EVLOS flights below 400 ft AGL without spraying or dispensing, while CAAM lists research and development under Special UAS Project approval. Applications are due at least 14 working days before the proposed operation and must include landowner permission and a Google Earth location file in KML or KMZ format. [CAAM UAS approvals](https://www.caam.gov.my/public/unmanned-aircraft-system-uas/), [CAAM Safety Information 01/2025](https://www.caam.gov.my/wp-content/uploads/2025/02/SI-01_2025-ATF-Application-for-UAS-Operations-Including-Operations-Related-to-Training.pdf)

Analyst's read: The following are proposed Safe Edge contracts and illustrative JSON Schema sketches, not MCP standard method names, actual Procore endpoints, or existing SDP APIs. MCP tools use JSON Schema input definitions. [MCP tools specification](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)

| Proposed tool           | Agent scope     | Effect                                                                                              |
| ----------------------- | --------------- | --------------------------------------------------------------------------------------------------- |
| get_edge_context        | edge.read       | Read owner, asset type, baseline ID and inspection policy.                                          |
| get_inspection_evidence | inspection.read | Read selected image IDs, timestamps, current and baseline image references, and detector output.    |
| propose_finding         | finding.propose | Store a candidate finding in a review queue; it cannot set a pass state.                            |
| draft_work_order        | workorder.draft | Create a Safe Edge draft linked to a reviewed finding; it cannot submit or close work.              |
| draft_escalation        | notice.draft    | Save an internal notification draft; it cannot send it.                                             |
| propose_retest          | patrol.propose  | Request that the named owner schedule a reinspection; it cannot launch a drone or approve a flight. |

```json
{
  "get_edge_context": {
    "type": "object",
    "properties": {
      "edge_id": { "type": "string" }
    },
    "required": ["edge_id"],
    "additionalProperties": false
  },
  "get_inspection_evidence": {
    "type": "object",
    "properties": {
      "edge_id": { "type": "string" },
      "finding_id": { "type": "string" },
      "image_set": {
        "type": "string",
        "enum": ["current", "baseline", "both"]
      }
    },
    "required": ["edge_id", "image_set"],
    "additionalProperties": false
  },
  "propose_finding": {
    "type": "object",
    "properties": {
      "edge_id": { "type": "string" },
      "evidence_ids": {
        "type": "array",
        "items": { "type": "string" }
      },
      "finding_type": {
        "type": "string",
        "enum": [
          "fence_gap",
          "missing_cover",
          "worn_path",
          "bank_erosion",
          "blocked_grating",
          "missing_buoy_or_sign",
          "water_level_change",
          "uncertain"
        ]
      },
      "summary": { "type": "string" },
      "uncertainty": {
        "type": "string",
        "enum": ["low", "medium", "high"]
      }
    },
    "required": ["edge_id", "evidence_ids", "finding_type", "summary", "uncertainty"],
    "additionalProperties": false
  },
  "draft_work_order": {
    "type": "object",
    "properties": {
      "finding_id": { "type": "string" },
      "proposed_action": { "type": "string" },
      "suggested_owner_role": { "type": "string" },
      "evidence_ids": {
        "type": "array",
        "items": { "type": "string" }
      }
    },
    "required": ["finding_id", "proposed_action", "evidence_ids"],
    "additionalProperties": false
  },
  "draft_escalation": {
    "type": "object",
    "properties": {
      "finding_id": { "type": "string" },
      "recipient_role": { "type": "string" },
      "channel": {
        "type": "string",
        "enum": ["email", "procore", "resident_app", "whatsapp"]
      },
      "message": { "type": "string" }
    },
    "required": ["finding_id", "recipient_role", "channel", "message"],
    "additionalProperties": false
  },
  "propose_retest": {
    "type": "object",
    "properties": {
      "edge_id": { "type": "string" },
      "finding_id": { "type": "string" },
      "reason": { "type": "string" }
    },
    "required": ["edge_id", "finding_id", "reason"],
    "additionalProperties": false
  }
}
```

Analyst's read: Expose read-only resources such as an edge record, accepted baseline, inspection evidence and current policy. Use fixed, versioned URI templates such as **safeedge://edges/{edge_id}/baseline** and **safeedge://findings/{finding_id}** only as internal resource identifiers; they are proposals, not network URLs. Keep resource access tenant- and role-scoped. [MCP resources](https://modelcontextprotocol.io/specification/2026-07-28/server/resources)

Analyst's read: **Approval flow:** A finding enters **candidate**; a named SDP reviewer marks it confirmed, rejected or needing more evidence. A work order remains **draft** until an authorized employee submits it in the approved maintenance system. Repair completion records **awaiting_independent_retest**. Only a second, separate human identity can record the retest result and update the internal edge status. The agent cannot create a pass, extend its expiry, sign its own work or send resident alerts. MCP elicitation can collect missing input, but the final acceptance belongs in this server-enforced workflow. [MCP tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools), [MCP elicitation](https://modelcontextprotocol.io/specification/2026-07-28/client/elicitation)

**Audit model:** Analyst's read: store immutable, correlatable events with actor, time, edge, image/baseline IDs, model version, policy version, proposed content, server permission decision, human decision and state transition. Restrict audit access separately from the agent’s work scopes. Keep rejected findings and failed inspections in the audit trail so the dashboard cannot show “no flag” as “safe.”

**Demo moments:**

1. Analyst's read: **Evidence-linked triage:** Use actual, permissioned Elmina imagery with capture dates and provenance. Show the agent compare a current frame with its real baseline, highlight a possible fence gap, link the relevant image IDs and state uncertainty. If the 3D scene animates a simulated defect, label it “simulation” and do not present it as a real Elmina finding.
2. Analyst's read: **Draft, review and retest:** Let the agent draft a work order and internal escalation from a confirmed finding. A named manager edits, rejects or submits the draft. Show that the agent has no approval button or tool. After a simulated repair, a separate human starts a retest; until that review is recorded, the edge remains unverified.

## Recommendations for Safe Edge

1. Analyst's read: Based on Finding 1, implement the current TypeScript server package and explicitly configure/verify 2026-07-28 protocol support. Use a local stdio server only for a credential-free prototype; use protected HTTP with server-side authorization for a shared pilot.
2. Analyst's read: Based on Finding 2, ship a deterministic workflow plus one triage-and-drafting agent. Keep patrol scheduling, image matching, severity rules and workflow state outside the LLM.
3. Analyst's read: Based on Finding 3, give the agent read/propose/draft scopes only. Enforce distinct human identities for repair completion and independent retest. Keep rate limits, schema validation and authorization on the server.
4. Analyst's read: Based on Finding 4, use AIGE/AICE to document responsible-use decisions and NIST RMF to organize risk work. Track the proposed Malaysian Bill, and describe ISO/IEC 42001 as a management-system reference rather than claiming certification.
5. Analyst's read: Based on Finding 5, treat every pixel, OCR result and tool description as untrusted. Do not rely on prompt wording as the security boundary; demonstrate that a prompt-like sign cannot create an approval or send an alert.
6. Analyst's read: Based on Finding 6, route staff alerts through a named owner and Procore/email after SDP approves the integration. Keep resident messaging separate; verify consent, approved templates, the current Meta rate card and SDP privacy review first. Obtain the correct CAAM approval before any live drone flight; CAAM's page categorizes research and development flights as Special UAS Projects.
7. Analyst's read: Based on Finding 7, demonstrate only with real, permissioned site imagery and label simulated drone actions and repairs. The agent should produce reviewable evidence and drafts, never a “safe” certification.

## What we can and cannot claim

**Safe claims**

- “Safe Edge is designed to surface possible changes for staff review; it does not certify an edge as safe.” MCP tool guidance calls for human-deniable tool actions, and the proposed agent scope omits acceptance. [MCP tools specification](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)
- “SDP has a public property-owner app and a published history of using Procore for defect recording and system integration.” This describes public sources, not Safe Edge deployment or live API access. [SDP app](https://www.simedarbyproperty.com/app/?thankyou=true), [Procore customer story](https://www.procore.com/en-sg/casestudies/sime-darby-property)
- “Published bridge-inspection and medical-imaging examples use AI to assist human review.” The bridge study describes inspector verification; the FDA filing says trained radiologists still review studies. [Bridge study](https://link.springer.com/article/10.1186/s43251-022-00073-y), [FDA NinesAI filing](https://www.accessdata.fda.gov/cdrh_docs/pdf19/K193351.pdf)
- Analyst's read: “The prototype demonstrates a human-reviewed workflow” is safe only if the team labels every simulated detection, repair and state change in the demo.

**Claims to avoid**

- Analyst's read: Avoid “The AI proves the site is safe,” “no detections means no hazard,” or “Safe Edge prevents drownings.” The sources reviewed do not establish these claims.
- Analyst's read: Avoid “Safe Edge is live at Elmina,” “SDP staff already use this app,” or “Procore access is approved.” Public sources do not establish these facts.
- Analyst's read: Avoid “WhatsApp costs exactly the vendor-reported rate” or “all outbound messages are free.” The accessible Meta pricing page and secondary October 2026 reporting conflict.
- Analyst's read: Avoid “Malaysia’s AI Governance Bill is in force,” “Safe Edge is EU high-risk,” or “Safe Edge is ISO/IEC 42001 certified.” The bill is still proposed; the EU classification depends on intended use and scope; no certification assessment was found.

## Open questions

- Which water edge is retained by SDP, who owns its maintenance budget, and who can act as the independent retester?
- Can the team obtain permissioned real Elmina images, a baseline, site access, privacy notices and permission to show image evidence publicly? How will bystanders be minimized, retained or redacted?
- Which SDP Procore project, role, API scopes, and approval workflow are available for a pilot? Which staff mailbox or ticket queue is the current operational route?
- Staff-facing review app: **Not found** in SDP’s public app pages, FAQ or site searches for staff/operations apps.
- Current Meta MYR rate card: **Not found** in the accessible official rate selector or developer page. The official page still displays free service-message language while secondary Malaysian pages report changes from 1 October 2026. Confirm with Meta or SDP’s WhatsApp provider before budgeting.
- What pilot policy determines inspection expiry, weather/event invalidation, the two human roles, escalation timing and drone-flight approvals?

## Sources

1. [Model Context Protocol specification, 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28) — Model Context Protocol, 28 July 2026.
2. [Specification changelog, 2025-06-18](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2025-06-18/changelog.mdx) — Model Context Protocol GitHub, 18 June 2025.
3. [One year of MCP: November 2025 specification release](https://blog.modelcontextprotocol.io/posts/2025-11-25-first-mcp-anniversary/) — Model Context Protocol Blog, 25 November 2025.
4. [The 2026-07-28 specification release](https://blog.modelcontextprotocol.io/posts/2026-07-28/) — Model Context Protocol Blog, 28 July 2026.
5. [MCP TypeScript SDK v2 documentation](https://ts.sdk.modelcontextprotocol.io/v2/) — Model Context Protocol, undated current documentation.
6. [MCP TypeScript SDK repository](https://github.com/modelcontextprotocol/typescript-sdk) — Model Context Protocol GitHub, undated.
7. [MCP TypeScript SDK releases](https://github.com/modelcontextprotocol/typescript-sdk/releases) — Model Context Protocol GitHub, release 2.3.1 dated 5 October 2026.
8. [Build your first server](https://ts.sdk.modelcontextprotocol.io/v2/get-started/first-server) — MCP TypeScript SDK, undated current documentation.
9. [Supporting protocol revision 2026-07-28](https://ts.sdk.modelcontextprotocol.io/v2/migration/support-2026-07-28) — MCP TypeScript SDK, 2026.
10. [Tools specification](https://modelcontextprotocol.io/specification/2026-07-28/server/tools) — Model Context Protocol, 28 July 2026.
11. [Resources specification](https://modelcontextprotocol.io/specification/2026-07-28/server/resources) — Model Context Protocol, 28 July 2026.
12. [Prompts specification](https://modelcontextprotocol.io/specification/2026-07-28/server/prompts) — Model Context Protocol, 28 July 2026; direct page unavailable in verification, role description cross-checked against main spec.
13. [Authorization specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization) — Model Context Protocol, 28 July 2026.
14. [Elicitation specification](https://modelcontextprotocol.io/specification/2026-07-28/client/elicitation) — Model Context Protocol, 28 July 2026.
15. [Security best practices](https://modelcontextprotocol.io/docs/2025-11-25/tutorials/security/security_best_practices) — Model Context Protocol, 25 November 2025 revision.
16. [Security policy and trust model](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/SECURITY.md) — Model Context Protocol GitHub, undated current document.
17. [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) — Anthropic, 19 December 2024.
18. [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview) — Anthropic, undated current documentation.
19. [Agent orchestration](https://openai.github.io/openai-agents-python/multi_agent/) — OpenAI Agents SDK, undated current documentation.
20. [Advanced bridge visual inspection using real-time machine learning in edge devices](https://link.springer.com/article/10.1186/s43251-022-00073-y) — Advances in Bridge Engineering, 2022.
21. [NinesAI 510(k) summary, K193351](https://www.accessdata.fda.gov/cdrh_docs/pdf19/K193351.pdf) — US Food and Drug Administration; prepared 17 April 2020. FDA's decision date is 21 April 2020; see source 46.
22. [National Guidelines on AI Governance and Ethics](https://www.mosti.gov.my/wp-content/uploads/2024/09/NATIONAL-GUIDELINES-OF-AIGE-20241118.pdf) — Ministry of Science, Technology and Innovation, 2024.
23. [AIGE launch notice](https://www.mosti.gov.my/berita/garis-panduan-tadbir-urus-dan-etika-kecerdasan-buatan-negara-aige/) — Ministry of Science, Technology and Innovation, 20 September 2024; Malay.
24. [AI Code of Ethics (AICE)](https://ai.gov.my/governance/ai-code-of-ethics-aice/) — AI Malaysia / National AI Office, undated current page.
25. [Proposed AI Governance Bill engagement](https://www.digital.gov.my/en-GB/siaran/Kementerian-Digital-Mulakan-Libat-Urus-Cadangan-Rang-Undang-Undang-Tadbir-Urus-Kecerdasan-Buatan-%28AI%29) — Ministry of Digital, 10 July 2026.
26. [Digital Hansard, Dewan Rakyat, 5 October 2026](https://hansard.parlimen.gov.my/hansard/dewan-rakyat/2026-10-05) — Parliament of Malaysia, 5 October 2026; Malay.
27. [AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/) — National Institute of Standards and Technology, current page; based on AI RMF 1.0 (2023). The page says a revised version is in progress.
28. [AI Risk Management Framework resources](https://www.nist.gov/itl/ai-risk-management-framework/ai-risk-management-framework-resources) — National Institute of Standards and Technology, updated 7 February 2025.
29. [Artificial Intelligence Risk Management Framework: Generative Artificial Intelligence Profile, NIST AI 600-1](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf) — National Institute of Standards and Technology, July 2024; exact publication date 26 July 2024 is confirmed by source 47.
30. [ISO/IEC 42001:2023](https://committee.iso.org/cms/live/live/en/sites/isoorg/contents/data/standard/08/12/81230.html) — International Organization for Standardization, December 2023.
31. [Regulation (EU) 2024/1689](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689) — European Union, 13 June 2024.
32. [Critical infrastructure guidance](https://ai-act-service-desk.ec.europa.eu/en/critical-infrastructure) — European Commission AI Act Service Desk, undated current guidance.
33. [Image Hijacks: Adversarial Images Can Control Generative Models at Runtime](https://proceedings.mlr.press/v235/bailey24a.html) — Proceedings of Machine Learning Research, ICML 2024.
34. [Devil in the Lens: Analyzing and Defending Physical Prompt Injection Against Vision-Language Models on Wearable Devices](https://arxiv.org/abs/2607.10269) — arXiv preprint, 11 July 2026.
35. [Designing AI agents to resist prompt injection](https://openai.com/index/designing-agents-to-resist-prompt-injection/) — OpenAI, 11 March 2026.
36. [Sime Darby Property customer story](https://www.procore.com/en-sg/casestudies/sime-darby-property) — Procore, undated customer story.
37. [Working with Observations](https://procore.github.io/documentation/tutorial-observations) — Procore developer documentation, undated current guide.
38. [Procore developer portal](https://developers.procore.com/) — Procore, undated current portal.
39. [Sime Darby Property App](https://www.simedarbyproperty.com/app/?thankyou=true) — Sime Darby Property, undated current page.
40. [Sime Darby Property App FAQ](https://www.simedarbyproperty.com/app/faq.html) — Sime Darby Property, undated current page.
41. [WhatsApp Business Messaging Policy](https://whatsappbusiness.com/policy/) — WhatsApp Business, updated 23 September 2026.
42. [WhatsApp Business Platform pricing](https://whatsappbusiness.com/products/platform-pricing/) — WhatsApp Business, undated current page.
43. [WhatsApp pricing on Meta for Developers](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing) — Meta for Developers, undated page; could not be opened during this verification. Treat exact rate-card details as snippet-only.
44. [WhatsApp Business API pricing in Malaysia](https://bixtech.co/blog/whatsapp-business-api-pricing-malaysia) — BixTech, updated 10 October 2026; secondary provider estimate.
45. [AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework) — National Institute of Standards and Technology, current page; AI RMF 1.0 released 26 January 2023.
46. [510(k) Premarket Notification, K193351](https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpmn/pmn.cfm?ID=K193351) — US Food and Drug Administration; decision date 21 April 2020.
47. [Artificial Intelligence Risk Management Framework: Generative Artificial Intelligence Profile](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence) — National Institute of Standards and Technology; published 26 July 2024.
48. [Unmanned Aircraft System (UAS)](https://www.caam.gov.my/public/unmanned-aircraft-system-uas/) — Civil Aviation Authority of Malaysia, current approval categories and guidance; checked 17 October 2026.
49. [Safety Information 01/2025: Authorisation to Fly application for UAS operations](https://www.caam.gov.my/wp-content/uploads/2025/02/SI-01_2025-ATF-Application-for-UAS-Operations-Including-Operations-Related-to-Training.pdf) — Civil Aviation Authority of Malaysia, 7 February 2025.
50. [Application and Non-Application of the Act](https://www.pdp.gov.my/ppdpv1/en/akta/application-and-non-application-of-the-act/) — Personal Data Protection Commissioner, current page.
51. [Personal Data Protection (Amendment) Act 2024: Appointment of Date of Coming into Operation](https://www.pdp.gov.my/ppdpv1/wp-content/uploads/2024/12/PENETAPAN-TARIKH-PERMULAAN-KUAT-KUASA.pdf) — Federal Government Gazette, dated 19 December 2024.
