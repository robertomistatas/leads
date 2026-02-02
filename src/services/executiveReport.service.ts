import {
	collection,
	documentId,
	getDocs,
	orderBy,
	query,
	where,
	type DocumentData,
} from 'firebase/firestore'
import { firestoreDb } from './firebase'
import { coerceToDate } from '../utils/date'
import type { Sale, SaleStatus } from '../models/Sale'
import type { Event, EventEntity } from '../models/Event'
import { getCloseSaleReadiness, salesService } from './sales.service'
import type { BlockedSaleReason, BuildExecutiveReportInput, ExecutiveReport } from '../models/ExecutiveReport'

type SaleReportView = {
	id: string
	clientId: string
	status: SaleStatus
	createdAt: Date
	plan?: Sale['plan']
	modality?: Sale['modality']
	paymentStatus?: Sale['paymentStatus']
}

type EventReportView = Pick<
	Event,
	'id' | 'saleId' | 'entity' | 'field' | 'previousValue' | 'newValue' | 'comment' | 'createdAt'
>

function assertValidRange(from: Date, to: Date) {
	if (!(from instanceof Date) || Number.isNaN(from.getTime())) throw new Error('invalid_from_date')
	if (!(to instanceof Date) || Number.isNaN(to.getTime())) throw new Error('invalid_to_date')
	if (from.getTime() > to.getTime()) throw new Error('invalid_range')
}

function isWithinRange(date: Date, from: Date, to: Date) {
	const t = date.getTime()
	return t >= from.getTime() && t <= to.getTime()
}

function daysBetween(from: Date, to: Date) {
	return (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)
}

function computeHasIncompleteData(sale: Pick<SaleReportView, 'plan' | 'modality'>): boolean {
	return !sale.plan || !sale.modality
}

function toReadinessSale(view: SaleReportView): Sale {
	return {
		id: view.id,
		clientId: view.clientId,
		status: view.status,
		plan: view.plan as any,
		modality: view.modality as any,
		serviceRegion: undefined,
		hasIncompleteData: computeHasIncompleteData(view),
		hasAlerts: false,
		paymentStatus: view.paymentStatus,
		createdAt: view.createdAt,
		closedAt: undefined,
		archivedAt: undefined,
	} as unknown as Sale
}

function toSaleReportView(id: string, data: DocumentData): SaleReportView | null {
	const clientId = data.clientId as string | undefined
	const status = data.status as SaleStatus | undefined
	const createdAt = coerceToDate(data.createdAt)
	if (!clientId || !status || !createdAt) return null

	return {
		id,
		clientId,
		status,
		createdAt,
		plan: data.plan as Sale['plan'] | undefined,
		modality: data.modality as Sale['modality'] | undefined,
		paymentStatus: data.paymentStatus as Sale['paymentStatus'] | undefined,
	}
}

function toEventReportView(id: string, data: DocumentData): EventReportView | null {
	const saleId = data.saleId ? String(data.saleId) : ''
	const entity = data.entity as EventEntity | undefined
	const field = data.field ? String(data.field) : ''
	const createdAt = coerceToDate(data.createdAt)
	if (!saleId || !entity || !field || !createdAt) return null

	return {
		id: String(data.id ?? id),
		saleId,
		entity,
		field,
		previousValue: data.previousValue ? String(data.previousValue) : undefined,
		newValue: data.newValue ? String(data.newValue) : undefined,
		comment: data.comment ? String(data.comment) : undefined,
		createdAt,
	}
}

async function fetchSalesCreatedInRange(from: Date, to: Date): Promise<SaleReportView[]> {
	const salesRef = collection(firestoreDb, 'sales')
	const q = query(salesRef, where('createdAt', '>=', from), where('createdAt', '<=', to), orderBy('createdAt', 'asc'))
	const snap = await getDocs(q)
	return snap.docs
		.map((d) => toSaleReportView(d.id, d.data()))
		.filter((s): s is SaleReportView => Boolean(s))
}

async function fetchEventsInRange(from: Date, to: Date): Promise<EventReportView[]> {
	const eventsRef = collection(firestoreDb, 'events')
	const q = query(eventsRef, where('createdAt', '>=', from), where('createdAt', '<=', to), orderBy('createdAt', 'asc'))
	const snap = await getDocs(q)
	return snap.docs
		.map((d) => toEventReportView(d.id, d.data()))
		.filter((e): e is EventReportView => Boolean(e))
}

async function fetchSalesByIds(saleIds: string[]): Promise<Record<string, SaleReportView>> {
	const ids = Array.from(new Set(saleIds.filter(Boolean)))
	if (ids.length === 0) return {}

	const salesRef = collection(firestoreDb, 'sales')
	const out: Record<string, SaleReportView> = {}

	for (let i = 0; i < ids.length; i += 10) {
		const chunk = ids.slice(i, i + 10)
		const q = query(salesRef, where(documentId(), 'in', chunk))
		const snap = await getDocs(q)
		for (const d of snap.docs) {
			const v = toSaleReportView(d.id, d.data())
			if (v) out[v.id] = v
		}
	}

	return out
}

async function fetchBeneficiaryExistsBySaleIds(saleIds: string[]): Promise<Record<string, boolean>> {
	const ids = Array.from(new Set(saleIds.filter(Boolean)))
	if (ids.length === 0) return {}

	const ref = collection(firestoreDb, 'beneficiaries')
	const out: Record<string, boolean> = {}

	for (const id of ids) out[id] = false

	for (let i = 0; i < ids.length; i += 10) {
		const chunk = ids.slice(i, i + 10)
		const q = query(ref, where('saleId', 'in', chunk))
		const snap = await getDocs(q)
		for (const d of snap.docs) {
			const saleId = (d.data() as any).saleId ? String((d.data() as any).saleId) : ''
			if (saleId) out[saleId] = true
		}
	}

	return out
}

async function fetchContractSignedBySaleIds(saleIds: string[]): Promise<Record<string, boolean>> {
	const ids = Array.from(new Set(saleIds.filter(Boolean)))
	if (ids.length === 0) return {}

	const ref = collection(firestoreDb, 'sale_steps')
	const out: Record<string, boolean> = {}
	for (const id of ids) out[id] = false

	for (let i = 0; i < ids.length; i += 10) {
		const chunk = ids.slice(i, i + 10)
		const q = query(ref, where('saleId', 'in', chunk))
		const snap = await getDocs(q)
		for (const d of snap.docs) {
			const data = d.data() as any
			const saleId = data.saleId ? String(data.saleId) : ''
			if (!saleId) continue

			const type = String(data.type ?? '')
			const status = String(data.status ?? '')
			if (type === 'CONTRACT' && status === 'SIGNED') out[saleId] = true
		}
	}

	return out
}

function computeBlockedReasons(input: {
	sale: SaleReportView
	beneficiaryExists: boolean
	contractSigned: boolean
}): BlockedSaleReason[] {
	const { sale, beneficiaryExists, contractSigned } = input
	const readiness = getCloseSaleReadiness({
		sale: toReadinessSale(sale),
		beneficiaryExists,
		contractSigned,
	})

	type ReadinessReason = Exclude<BlockedSaleReason, 'PAYMENT_PENDING'>

	const readinessReasons: ReadinessReason[] = readiness.blockers
		.map((b) => {
			switch (b) {
				case 'SALE_INCOMPLETE':
					return 'INCOMPLETE_DATA'
				case 'BENEFICIARY_REQUIRED':
					return 'BENEFICIARY_REQUIRED'
				case 'CONTRACT_NOT_SIGNED':
					return 'CONTRACT_NOT_SIGNED'
				default:
					return undefined
			}
		})
		.filter((r): r is ReadinessReason => Boolean(r))

	const reasons: BlockedSaleReason[] = [...readinessReasons]

	// Payment blocker is operational but not part of getCloseSaleReadiness.
	if (sale.paymentStatus && sale.paymentStatus !== 'READY') reasons.push('PAYMENT_PENDING')

	return Array.from(new Set(reasons))
}

function pickPrimaryBlockedReason(reasons: BlockedSaleReason[]): BlockedSaleReason | undefined {
	const priority: BlockedSaleReason[] = [
		'INCOMPLETE_DATA',
		'BENEFICIARY_REQUIRED',
		'CONTRACT_NOT_SIGNED',
		'PAYMENT_PENDING',
	]
	for (const r of priority) if (reasons.includes(r)) return r
	return undefined
}

function earliestDate(dates: Array<Date | undefined>): Date | undefined {
	const filtered = dates.filter((d): d is Date => Boolean(d))
	if (filtered.length === 0) return undefined
	return filtered.reduce((min, d) => (d.getTime() < min.getTime() ? d : min))
}

function buildStatusEventIndex(events: EventReportView[]) {
	const statusEvents = events.filter((e) => e.entity === 'SALE' && e.field === 'status')
	const bySaleId: Record<string, EventReportView[]> = {}
	for (const e of statusEvents) {
		if (!bySaleId[e.saleId]) bySaleId[e.saleId] = []
		bySaleId[e.saleId].push(e)
	}
	return { statusEvents, bySaleId }
}

function computeBlockedDaysWithinRange(params: { startAt: Date; from: Date; to: Date }) {
	const start = params.startAt.getTime() < params.from.getTime() ? params.from : params.startAt
	if (start.getTime() > params.to.getTime()) return 0
	return Math.max(0, daysBetween(start, params.to))
}

function computeBlockedStartAt(params: {
	sale: SaleReportView
	reason: BlockedSaleReason
	from: Date
	to: Date
	eventsInRangeBySaleId: Record<string, EventReportView[]>
	statusEventsInRangeBySaleId: Record<string, EventReportView[]>
}): Date {
	const { sale, reason, from, to } = params

	const base = sale.createdAt

	const saleStatusEvents = params.statusEventsInRangeBySaleId[sale.id] ?? []
	const enteredInProgressAt = earliestDate(
		saleStatusEvents
			.filter((e) => e.newValue === 'in_progress')
			.map((e) => e.createdAt),
	)
	const baseStart = enteredInProgressAt && enteredInProgressAt.getTime() > base.getTime() ? enteredInProgressAt : base

	const saleEvents = params.eventsInRangeBySaleId[sale.id] ?? []

	if (reason === 'CONTRACT_NOT_SIGNED') {
		const contractEventAt = earliestDate(
			saleEvents
				.filter((e) => e.entity === 'STEP' && e.field === 'status')
				.filter((e) => (e.comment ?? '').includes('CONTRACT'))
				.map((e) => e.createdAt),
		)
		return contractEventAt && isWithinRange(contractEventAt, from, to) ? contractEventAt : baseStart
	}

	if (reason === 'PAYMENT_PENDING') {
		const paymentEventAt = earliestDate(
			saleEvents
				.filter((e) => e.entity === 'STEP' && e.field === 'status')
				.filter((e) => (e.comment ?? '').includes('PAYMENT'))
				.filter((e) => e.newValue === 'PENDING' || e.newValue === 'SENT')
				.map((e) => e.createdAt),
		)

		return paymentEventAt && isWithinRange(paymentEventAt, from, to) ? paymentEventAt : baseStart
	}

	if (reason === 'BENEFICIARY_REQUIRED') {
		// Beneficiary-required means "missing beneficiary"; we cannot know exact start beyond the in-progress baseline.
		return baseStart
	}

	return baseStart
}

export async function buildExecutiveReport(input: BuildExecutiveReportInput): Promise<ExecutiveReport> {
	assertValidRange(input.from, input.to)
	const { from, to } = input

	// 1) Range-bounded data.
	const [salesCreatedInRange, eventsInRange] = await Promise.all([
		fetchSalesCreatedInRange(from, to),
		fetchEventsInRange(from, to),
	])

	// 2) Identify operational transitions using audit events.
	const { statusEvents, bySaleId: statusEventsBySaleId } = buildStatusEventIndex(eventsInRange)

	const leadsDroppedIds = new Set(
		statusEvents
			.filter((e) => e.previousValue === 'lead' && e.newValue === 'archived')
			.map((e) => e.saleId),
	)

	const salesCreatedIds = new Set(
		statusEvents
			.filter((e) => e.previousValue === 'lead' && e.newValue === 'in_progress')
			.map((e) => e.saleId),
	)

	const salesClosedIds = new Set(statusEvents.filter((e) => e.newValue === 'closed').map((e) => e.saleId))

	// If a sale doc was created already in-progress (rare), count it as created.
	for (const s of salesCreatedInRange) if (s.status === 'in_progress') salesCreatedIds.add(s.id)
	for (const s of salesCreatedInRange) if (s.status === 'closed') salesClosedIds.add(s.id)

	// In this domain, "lead" creation is the creation of a sale in status=lead.
	// Counting uses the real `sales.createdAt` timestamp and is strictly range-bounded.
	const leadsCreated = salesCreatedInRange.length
	const leadsDropped = leadsDroppedIds.size
	const leadsDropRate = leadsCreated > 0 ? leadsDropped / leadsCreated : 0

	const salesCreated = salesCreatedIds.size
	const salesClosed = salesClosedIds.size

	// 3) Compute "blocked" snapshot at end of range (to), but days strictly within the range.
	// We avoid range queries here to prevent requiring composite indexes.
	const inProgressRef = collection(firestoreDb, 'sales')
	const inProgressSnap = await getDocs(query(inProgressRef, where('status', '==', 'in_progress')))
	const inProgressSalesAll = inProgressSnap.docs
		.map((d) => toSaleReportView(d.id, d.data()))
		.filter((s): s is SaleReportView => Boolean(s))
		.filter((s) => s.createdAt.getTime() <= to.getTime())

	const inProgressSaleIds = inProgressSalesAll.map((s) => s.id)
	const [beneficiaryExistsBySaleId, contractSignedBySaleId] = await Promise.all([
		fetchBeneficiaryExistsBySaleIds(inProgressSaleIds),
		fetchContractSignedBySaleIds(inProgressSaleIds),
	])

	const eventsInRangeBySaleId: Record<string, EventReportView[]> = {}
	for (const e of eventsInRange) {
		if (!eventsInRangeBySaleId[e.saleId]) eventsInRangeBySaleId[e.saleId] = []
		eventsInRangeBySaleId[e.saleId].push(e)
	}

	type BlockedSaleComputed = {
		saleId: string
		reasons: BlockedSaleReason[]
		primaryReason?: BlockedSaleReason
		blockedStartAtByReason: Partial<Record<BlockedSaleReason, Date>>
	}

	const blockedComputed: BlockedSaleComputed[] = []

	for (const sale of inProgressSalesAll) {
		const reasons = computeBlockedReasons({
			sale,
			beneficiaryExists: beneficiaryExistsBySaleId[sale.id] ?? false,
			contractSigned: contractSignedBySaleId[sale.id] ?? false,
		})

		if (reasons.length === 0) continue

		const blockedStartAtByReason: Partial<Record<BlockedSaleReason, Date>> = {}
		for (const reason of reasons) {
			blockedStartAtByReason[reason] = computeBlockedStartAt({
				sale,
				reason,
				from,
				to,
				eventsInRangeBySaleId,
				statusEventsInRangeBySaleId: statusEventsBySaleId,
			})
		}

		blockedComputed.push({
			saleId: sale.id,
			reasons,
			primaryReason: pickPrimaryBlockedReason(reasons),
			blockedStartAtByReason,
		})
	}

	// Count blocked only if the blocked interval overlaps the range.
	const blockedWithOverlap = blockedComputed.filter((b) => {
		const startAt = b.primaryReason ? b.blockedStartAtByReason[b.primaryReason] : undefined
		if (!startAt) return false
		return startAt.getTime() <= to.getTime()
	})

	const salesBlocked = blockedWithOverlap.length

	const allReasons: BlockedSaleReason[] = [
		'CONTRACT_NOT_SIGNED',
		'PAYMENT_PENDING',
		'BENEFICIARY_REQUIRED',
		'INCOMPLETE_DATA',
	]

	const blockedReasons = allReasons.map((reason) => {
		const starts = blockedWithOverlap
			.filter((b) => b.reasons.includes(reason))
			.map((b) => b.blockedStartAtByReason[reason])
			.filter((d): d is Date => Boolean(d))

		const days = starts.map((startAt) => computeBlockedDaysWithinRange({ startAt, from, to }))
		const count = days.length
		const averageDaysBlocked = count > 0 ? days.reduce((a, b) => a + b, 0) / count : 0

		return { reason, count, averageDaysBlocked }
	})

	// 4) Timeline: include sales with any activity in range, plus those blocked at end.
	const saleIdsFromCreated = salesCreatedInRange.map((s) => s.id)
	const saleIdsFromEvents = Array.from(new Set(eventsInRange.map((e) => e.saleId)))
	const blockedSaleIds = blockedWithOverlap.map((b) => b.saleId)
	const timelineSaleIds = Array.from(new Set([...saleIdsFromCreated, ...saleIdsFromEvents, ...blockedSaleIds]))

	const salesById = await fetchSalesByIds(timelineSaleIds)
	const clientIds = Object.values(salesById).map((s) => s.clientId)
	const clientsById = await salesService.getClientsByIds(clientIds)

	const blockedPrimaryReasonBySaleId = new Map(blockedWithOverlap.map((b) => [b.saleId, b.primaryReason] as const))

	const salesTimeline = timelineSaleIds
		.map((saleId) => {
			const sale = salesById[saleId]
			if (!sale) return null

			const customerName = clientsById[sale.clientId]?.fullName ?? ''
			const evs = (eventsInRangeBySaleId[saleId] ?? []).map((e) => ({
				type: `${e.entity}.${e.field}`,
				date: e.createdAt,
			}))

			return {
				saleId,
				customerName,
				events: evs,
				currentStatus: sale.status,
				blockedReason: blockedPrimaryReasonBySaleId.get(saleId),
			}
		})
		.filter((x): x is NonNullable<typeof x> => Boolean(x))
		.sort((a, b) => {
			const aLast = a.events[a.events.length - 1]?.date?.getTime() ?? 0
			const bLast = b.events[b.events.length - 1]?.date?.getTime() ?? 0
			return bLast - aLast
		})

	return {
		range: { from, to },
		summary: {
			leadsCreated,
			leadsDropped,
			leadsDropRate,
			salesCreated,
			salesClosed,
			salesBlocked,
		},
		funnel: {
			leads: leadsCreated,
			sales: salesCreated,
			closed: salesClosed,
		},
		blockedSales: {
			total: salesBlocked,
			reasons: blockedReasons,
		},
		salesTimeline,
	}
}
