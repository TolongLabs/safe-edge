import type { RepairJourney, User, WorkOrder } from '@safe-edge/contracts'

export type StepState = 'done' | 'now' | 'todo'
export type StageState = StepState | 'rejected'
export type StageStep = { label: string; state: StepState; detail: string | null }
export type Stage = {
  key: 'crew' | 'manager' | 'engineer' | 'installer' | 'reviewer'
  name: string
  who: string | null
  when: string | null
  state: StageState
  steps: StageStep[]
}
export type StageEnd = {
  name: 'Not a problem' | 'Look again'
  who: string | null
  when: string | null
  detail: string | null
  state: 'rejected' | 'now'
}
export type CurrentLine = { label: string; detail: string }
export type DueChange = { from: string | null; to: string; reason: string; by: string; at: string }
export type SpentView = {
  spent: number
  currency: string
  estimate: number | null
  percent: number | null
  reason: string | null
}
export type DerivedStages = {
  stages: Stage[]
  end: StageEnd | null
  current: CurrentLine | null
  finish: string | null
  dueChanges: DueChange[]
  spent: SpentView | null
}

const KL = 'Asia/Kuala_Lumpur'

/** A real record date in park time, or null when the record has no date. */
export const journeyDate = (iso: string | null | undefined): string | null => {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: KL
  }).format(d)
}

export const journeyShortDate = (iso: string | null | undefined): string | null => {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: KL
  }).format(d)
}

const plainName = (name: string) => name.replace(/\s*\([^)]*\)$/, '')

/** The real person a record names; never a made-up fallback. */
export const personName = (users: User[], id: string | null | undefined): string | null => {
  if (!id) return null
  const user = users.find((u) => u.id === id)
  return user ? plainName(user.name) : id
}

const roleName = (users: User[], id: string | null | undefined): string | null => {
  if (!id) return null
  return users.find((u) => u.id === id)?.role ?? null
}

const withRole = (users: User[], id: string | null | undefined): string | null => {
  const name = personName(users, id)
  const role = roleName(users, id)
  return name && role ? `${name}, ${role.replace(/_/g, ' ')}` : name
}

const waitingWords = (workOrder: WorkOrder): string => {
  if (workOrder.progress === 'buying_materials') return 'Buying materials'
  if (workOrder.progress === 'fixing') return 'Fixing'
  if (workOrder.progress !== 'waiting_for_delivery') return 'Work started'
  const expected = journeyDate(workOrder.expectedDeliveryAt)
  const parts = ['Waiting for shipment']
  if (workOrder.noTracking) parts.push('supplier gave no tracking number')
  else if (workOrder.trackingNumber) parts.push(`tracking ${workOrder.trackingNumber}`)
  else parts.push('no tracking number recorded')
  if (expected) parts.push(`expected ${expected}`)
  return parts.join(', ')
}

const progressStep = (
  workOrder: WorkOrder | null,
  step: 'buying_materials' | 'waiting_for_delivery' | 'fixing',
  label: string
): StageStep => {
  if (!workOrder) return { label, state: 'todo', detail: null }
  const done = workOrder.completedAt !== null || ['completed', 'accepted', 'rejected'].includes(workOrder.status)
  if (done) return { label, state: 'done', detail: journeyDate(workOrder.completedAt) }
  const progress = workOrder.progress ?? null
  const order = ['buying_materials', 'waiting_for_delivery', 'fixing']
  const current = progress ? order.indexOf(progress) : -1
  const index = order.indexOf(step)
  if (progress === step) {
    return {
      label,
      state: 'now',
      detail:
        step === 'waiting_for_delivery'
          ? `${waitingWords(workOrder)}${workOrder.progressUpdatedAt ? ` · ${journeyDate(workOrder.progressUpdatedAt)}` : ''}`
          : journeyDate(workOrder.progressUpdatedAt)
    }
  }
  if (current >= 0 && index < current) return { label, state: 'done', detail: null }
  return { label, state: 'todo', detail: null }
}

const spentView = (journey: RepairJourney): SpentView | null => {
  const spent = journey.workOrder?.spent
  if (!spent) return null
  const quote = journey.remedy?.quote
  const estimate = quote && quote !== 'quote_needed' ? quote.amount : null
  const percent = estimate && estimate > 0 ? Math.round(((spent.amount - estimate) / estimate) * 100) : null
  return {
    spent: spent.amount,
    currency: spent.currency,
    estimate,
    percent,
    reason: journey.workOrder?.overspendReason ?? null
  }
}

/**
 * The five role stages of one repair, read only from real records on the journey. A stage is done when its own
 * record exists, now when it is the next role, and never dated from another record's createdAt.
 */
export function deriveStages(journey: RepairJourney, users: User[]): DerivedStages {
  const { candidate, report, finding, workOrder, remedy, retest } = journey
  const crewWho = report ? personName(users, report.reportedBy) : null
  const crewWhen = report ? journeyDate(report.reportedAt) : null
  const managerWho = personName(users, candidate.decidedBy ?? finding?.confirmedBy)
  const managerWhen = journeyDate(candidate.decidedAt)
  const approvedWhen = journeyDate(journey.planApprovedAt)
  const engineerWho = personName(users, remedy?.engineerApprovedBy)
  const installerWho = personName(users, workOrder?.installerUserId)
  const assignedWhen = journeyDate(journey.assignedAt)
  const completedWhen = journeyDate(workOrder?.completedAt)
  const reviewerWho = retest ? personName(users, retest.reviewerUserId) : null
  const reviewerWhen = retest ? journeyDate(retest.recordedAt) : null

  const crew: Stage = {
    key: 'crew',
    name: 'Walk crew reported',
    who: crewWho,
    when: crewWhen,
    state: report ? 'done' : 'todo',
    steps: [
      {
        label: 'Report sent',
        state: report ? 'done' : 'todo',
        detail: report ? `${crewWho ?? 'Person not recorded'} · ${crewWhen ?? 'Date not recorded'}` : 'Not yet recorded'
      }
    ]
  }

  const decided =
    candidate.status === 'confirmed' || candidate.status === 'rejected' || candidate.status === 'needs_recapture'
  const managerState: StageState =
    candidate.status === 'rejected'
      ? 'rejected'
      : candidate.status === 'needs_recapture'
        ? 'now'
        : decided
          ? 'done'
          : report
            ? 'now'
            : 'todo'
  const managerStep: StageStep =
    candidate.status === 'rejected'
      ? {
          label: 'Not a problem',
          state: 'done',
          detail: `${managerWho ?? 'Person not recorded'} · ${managerWhen ?? 'Date not recorded'}${candidate.decisionReason ? `: ${candidate.decisionReason}` : ''}`
        }
      : candidate.status === 'needs_recapture'
        ? {
            label: 'Look again',
            state: 'now',
            detail: `${managerWho ?? 'Person not recorded'} · ${managerWhen ?? 'Date not recorded'}${candidate.decisionReason ? `: ${candidate.decisionReason}` : ''}`
          }
        : decided
          ? {
              label: 'Confirmed: needs a fix',
              state: 'done',
              detail: `${managerWho ?? 'Person not recorded'} · ${managerWhen ?? 'Date not recorded'}`
            }
          : {
              label: 'Awaiting a decision',
              state: report ? 'now' : 'todo',
              detail: report ? 'The manager has not confirmed this report yet.' : 'Not yet recorded'
            }
  const manager: Stage = {
    key: 'manager',
    name: 'Manager confirmed',
    who: decided ? managerWho : null,
    when: decided ? managerWhen : null,
    state: managerState,
    steps: [managerStep]
  }

  if (candidate.status === 'rejected' || candidate.status === 'needs_recapture') {
    const end: StageEnd =
      candidate.status === 'rejected'
        ? {
            name: 'Not a problem',
            who: managerWho,
            when: managerWhen,
            detail: candidate.decisionReason,
            state: 'rejected'
          }
        : {
            name: 'Look again',
            who: managerWho,
            when: managerWhen,
            detail: candidate.decisionReason,
            state: 'now'
          }
    const current: CurrentLine =
      candidate.status === 'rejected'
        ? {
            label: 'Not a problem',
            detail: `${managerWho ?? 'The manager'} ended the report${managerWhen ? ` on ${managerWhen}` : ''}${candidate.decisionReason ? `: ${candidate.decisionReason}` : '.'}`
          }
        : {
            label: 'Look again',
            detail: `The walk crew takes a new photo${candidate.decisionReason ? `: ${candidate.decisionReason}` : '.'}`
          }
    return {
      stages: [crew, manager],
      end,
      current,
      finish: null,
      dueChanges: [],
      spent: null
    }
  }

  const approved = Boolean(remedy?.engineerApprovedBy)
  const engineer: Stage = {
    key: 'engineer',
    name: 'Engineer repair plan approved',
    who: approved ? engineerWho : null,
    when: approved ? approvedWhen : null,
    state: approved ? 'done' : finding ? 'now' : 'todo',
    steps: [
      {
        label: 'Repair plan approved',
        state: approved ? 'done' : finding ? 'now' : 'todo',
        detail: approved
          ? `${engineerWho ?? 'Person not recorded'} · ${approvedWhen ?? 'Date not recorded'}${remedy ? ` · ${remedy.label}` : ''}`
          : finding
            ? 'Awaiting the engineer’s approval'
            : 'Not yet recorded'
      }
    ]
  }

  const installerStarted = workOrder?.status === 'submitted' || workOrder?.status === 'in_progress'
  const installerDone = workOrder ? ['completed', 'accepted', 'rejected'].includes(workOrder.status) : false
  const installer: Stage = {
    key: 'installer',
    name: 'Installer',
    who: installerWho,
    when: installerDone ? completedWhen : assignedWhen,
    state: installerDone ? 'done' : installerStarted ? 'now' : approved ? 'now' : 'todo',
    steps: [
      {
        label: 'Assigned',
        state: workOrder?.installerUserId ? 'done' : workOrder ? 'now' : 'todo',
        detail: workOrder?.installerUserId
          ? `${installerWho ?? 'Person not recorded'}${assignedWhen ? ` · ${assignedWhen}` : ''}`
          : workOrder
            ? 'Awaiting an installer'
            : 'Not yet recorded'
      },
      progressStep(workOrder, 'buying_materials', 'Buying materials'),
      progressStep(workOrder, 'waiting_for_delivery', 'Waiting for delivery'),
      progressStep(workOrder, 'fixing', 'Fixing'),
      {
        label: 'Done',
        state: workOrder?.completedAt ? 'done' : 'todo',
        detail: workOrder?.completedAt ? journeyDate(workOrder.completedAt) : null
      }
    ]
  }

  const reviewerState: StageState = retest
    ? retest.result === 'rejected'
      ? 'rejected'
      : 'done'
    : workOrder?.status === 'completed'
      ? 'now'
      : workOrder?.status === 'rejected'
        ? 'rejected'
        : 'todo'
  const reviewer: Stage = {
    key: 'reviewer',
    name: 'Reviewer checked',
    who: reviewerWho,
    when: reviewerWhen,
    state: reviewerState,
    steps: [
      {
        label: retest?.result === 'rejected' ? 'Repair failed the check' : 'Photo check',
        state: retest
          ? retest.result === 'rejected'
            ? 'done'
            : 'done'
          : workOrder?.status === 'completed'
            ? 'now'
            : 'todo',
        detail: retest
          ? `${reviewerWho ?? 'Person not recorded'} · ${reviewerWhen ?? 'Date not recorded'}${retest.result === 'rejected' ? `: ${retest.reason}` : ''}`
          : workOrder?.status === 'completed'
            ? 'Waiting for a reviewer'
            : 'After the repair is done'
      }
    ]
  }

  const current = ((): CurrentLine | null => {
    if (!decided)
      return {
        label: 'Waiting for the manager to confirm the report',
        detail: report ? 'The report is open.' : 'The flag is open.'
      }
    if (!approved)
      return { label: 'Waiting for the engineer to approve the repair plan', detail: 'No approval is recorded yet.' }
    if (!workOrder || workOrder.status === 'draft') {
      return { label: 'Waiting for a work order to be sent to an installer', detail: 'No installer is assigned yet.' }
    }
    if (workOrder.status === 'submitted') {
      return { label: `Now with the installer: ${installerWho ?? 'installer not recorded'}`, detail: 'Assigned' }
    }
    if (workOrder.status === 'in_progress') {
      return {
        label: `Now with the installer: ${installerWho ?? 'installer not recorded'}`,
        detail: waitingWords(workOrder)
      }
    }
    if (workOrder.status === 'completed') {
      return {
        label: 'Waiting for the reviewer to check the repair',
        detail: `The installer marked it done${completedWhen ? ` on ${completedWhen}` : ''}.`
      }
    }
    if (workOrder.status === 'accepted') {
      return {
        label: 'Repair checked and accepted',
        detail: `${reviewerWho ?? 'The reviewer'} checked it${reviewerWhen ? ` on ${reviewerWhen}` : ''}.`
      }
    }
    return {
      label: 'Repair failed the check',
      detail: `${reviewerWho ?? 'The reviewer'} checked it${reviewerWhen ? ` on ${reviewerWhen}` : ''}${retest?.reason ? `: ${retest.reason}` : '.'}`
    }
  })()

  const finish = journeyDate(workOrder?.dueAt)
  const dueChanges: DueChange[] = (workOrder?.dueAtChanges ?? []).map((change) => ({
    from: journeyDate(change.from),
    to: journeyDate(change.to) ?? change.to,
    reason: change.reason,
    by: personName(users, change.byUserId) ?? change.byUserId,
    at: journeyDate(change.at) ?? change.at
  }))

  return {
    stages: [crew, manager, engineer, installer, reviewer],
    end: null,
    current,
    finish,
    dueChanges,
    spent: spentView(journey)
  }
}

export const withRoleName = withRole
