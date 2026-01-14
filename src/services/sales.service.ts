import {
	collection,
	doc,
	documentId,
	getDoc,
	getDocs,
	limit,
	onSnapshot,
	query,
	serverTimestamp,
	setDoc,
	updateDoc,
	where,
	type DocumentData,
	type Unsubscribe,
} from 'firebase/firestore'
import { firestoreDb } from './firebase'
import type { Beneficiary } from '../models/Beneficiary'
import type { Client } from '../models/Client'
import type { CommercialTerms } from '../models/CommercialTerms'
import type { Sale, SaleStatus } from '../models/Sale'
import type { SaleStep, SaleStepStatus, SaleStepType } from '../models/SaleStep'
import type { DomainResult, SaleDomainError } from '../models/domainResult'
import { eventsService } from './events.service'
import { updateWithEvents } from './_internal/updateWithEvents'
import { coerceToDate } from '../utils/date'
import { toControlledRegion, type ControlledRegion } from '../utils/region'
import { cleanUndefined } from '../utils/cleanUndefined'

export type SaleView = {
	id: string
	clientId: string
	status: SaleStatus
	plan?: Sale['plan']
	modality?: Sale['modality']
	serviceRegion?: string
	createdAt?: Date
	closedAt?: Date
	archivedAt?: Date
	hasIncompleteData: boolean
}

export type SaleStepView = {
	id: string
	saleId: string
	type: SaleStepType
	status: SaleStepStatus
	method?: SaleStep['method']
	metadata?: SaleStep['metadata']
	updatedAt?: Date
	updatedBy?: string
}

export type ClientView = Client

export type BeneficiaryView = Beneficiary

export type CommercialTermsView = CommercialTerms

function computeHasIncompleteData(sale: Partial<SaleView>) {
	// Minimal, non-opinionated: if plan/modality missing, it is incomplete.
	return !sale.plan || !sale.modality
}

function toSaleView(id: string, data: DocumentData): SaleView | null {
	const status = data.status as SaleStatus | undefined
	const clientId = data.clientId as string | undefined
	if (!status || !clientId) return null

	const plan = data.plan as Sale['plan'] | undefined
	const modality = data.modality as Sale['modality'] | undefined

	const view: SaleView = {
		id,
		clientId,
		status,
		plan,
		modality,
		serviceRegion: data.serviceRegion ? String(data.serviceRegion) : undefined,
		createdAt: coerceToDate(data.createdAt),
		closedAt: coerceToDate(data.closedAt),
		archivedAt: coerceToDate(data.archivedAt),
		hasIncompleteData: computeHasIncompleteData({ plan, modality }),
	}

	return view
}

function toSaleStepView(id: string, data: DocumentData): SaleStepView | null {
	const saleId = data.saleId as string | undefined
	const type = data.type as SaleStepView['type'] | undefined
	const status = data.status as SaleStepView['status'] | undefined
	if (!saleId || !type || !status) return null

	return {
		id,
		saleId,
		type,
		status,
		method: data.method as SaleStepView['method'] | undefined,
		metadata: data.metadata as SaleStepView['metadata'] | undefined,
		updatedAt: coerceToDate(data.updatedAt),
		updatedBy: data.updatedBy ? String(data.updatedBy) : undefined,
	}
}

function toClientView(id: string, data: DocumentData): ClientView | null {
	const fullName = data.fullName as string | undefined
	if (!fullName) return null

	return {
		id,
		fullName,
		rut: data.rut ? String(data.rut) : undefined,
		phone: data.phone ? String(data.phone) : undefined,
		email: data.email ? String(data.email) : undefined,
		address: data.address ? String(data.address) : undefined,
		profession: data.profession ? String(data.profession) : undefined,
		region: data.region ? String(data.region) : undefined,
		createdAt: coerceToDate(data.createdAt) ?? new Date(0),
		updatedAt: coerceToDate(data.updatedAt) ?? new Date(0),
	}
}

function toBeneficiaryView(id: string, data: DocumentData): BeneficiaryView | null {
	const saleId = data.saleId as string | undefined
	const fullName = data.fullName as string | undefined
	const serviceAddress = data.serviceAddress as string | undefined
	const region = data.region as string | undefined
	if (!saleId || !fullName || !serviceAddress || !region) return null

	return {
		id,
		saleId,
		fullName,
		rut: data.rut ? String(data.rut) : undefined,
		serviceAddress,
		region,
		createdAt: coerceToDate(data.createdAt) ?? new Date(0),
	}
}

function toCommercialTermsView(id: string, data: DocumentData): CommercialTermsView | null {
	const saleId = data.saleId as string | undefined
	const basePrice = data.basePrice as number | undefined
	const discountPercentage = data.discountPercentage as number | undefined
	const finalPrice = data.finalPrice as number | undefined
	const discountConfirmed = data.discountConfirmed as boolean | undefined
	const finalPriceConfirmed = data.finalPriceConfirmed as boolean | undefined
	if (
		!saleId ||
		typeof basePrice !== 'number' ||
		typeof discountPercentage !== 'number' ||
		typeof finalPrice !== 'number' ||
		typeof discountConfirmed !== 'boolean' ||
		typeof finalPriceConfirmed !== 'boolean'
	)
		return null

	return {
		id,
		saleId,
		basePrice,
		discountPercentage,
		finalPrice,
		discountConfirmed,
		finalPriceConfirmed,
		createdAt: coerceToDate(data.createdAt) ?? new Date(0),
		updatedAt: coerceToDate(data.updatedAt) ?? new Date(0),
	}
}

function normalizeString(value: unknown): string | undefined {
	if (value === null || value === undefined) return undefined
	const s = String(value).trim()
	return s.length === 0 ? undefined : s
}

function numberToString(value: unknown): string | undefined {
	if (value === null || value === undefined) return undefined
	if (typeof value === 'number' && Number.isFinite(value)) return String(value)
	return normalizeString(value)
}

export type CreateLeadInput = {
	fullName: string
	rut?: string
	phone?: string
	email?: string
	address?: string
	profession?: string
	region?: string
}

export const salesService = {
	listenSales: (cb: (sales: SaleView[]) => void, status?: SaleStatus): Unsubscribe => {
		const salesRef = collection(firestoreDb, 'sales')
		const q = status ? query(salesRef, where('status', '==', status)) : salesRef

		return onSnapshot(
			q,
			(snap) => {
				const sales = snap.docs
					.map((d) => toSaleView(d.id, d.data()))
					.filter((s): s is SaleView => Boolean(s))
				cb(sales)
			},
			() => cb([]),
		)
	},

	listenSaleSteps: (saleId: string, cb: (steps: SaleStepView[]) => void): Unsubscribe => {
		const stepsRef = collection(firestoreDb, 'sale_steps')
		const q = query(stepsRef, where('saleId', '==', saleId))

		return onSnapshot(
			q,
			(snap) => {
				const steps = snap.docs
					.map((d) => toSaleStepView(d.id, d.data()))
					.filter((s): s is SaleStepView => Boolean(s))
				cb(steps)
			},
			() => cb([]),
		)
	},

	listenClient: (clientId: string, cb: (client: ClientView | null) => void): Unsubscribe => {
		const ref = doc(collection(firestoreDb, 'clients'), clientId)
		return onSnapshot(
			ref,
			(snap) => {
				if (!snap.exists()) {
					cb(null)
					return
				}
				cb(toClientView(snap.id, snap.data()) ?? null)
			},
			() => cb(null),
		)
	},

	getClientsByIds: async (clientIds: string[]): Promise<Record<string, ClientView>> => {
		const ids = Array.from(new Set(clientIds.filter(Boolean)))
		if (ids.length === 0) return {}

		const clientsRef = collection(firestoreDb, 'clients')
		const out: Record<string, ClientView> = {}

		for (let i = 0; i < ids.length; i += 10) {
			const chunk = ids.slice(i, i + 10)
			const q = query(clientsRef, where(documentId(), 'in', chunk))
			const snap = await getDocs(q)
			for (const d of snap.docs) {
				const v = toClientView(d.id, d.data())
				if (v) out[d.id] = v
			}
		}

		return out
	},

	listenBeneficiaryBySale: (saleId: string, cb: (beneficiary: BeneficiaryView | null) => void): Unsubscribe => {
		const ref = collection(firestoreDb, 'beneficiaries')
		const q = query(ref, where('saleId', '==', saleId), limit(1))
		return onSnapshot(
			q,
			(snap) => {
				const first = snap.docs[0]
				if (!first) {
					cb(null)
					return
				}
				cb(toBeneficiaryView(first.id, first.data()) ?? null)
			},
			() => cb(null),
		)
	},

	listenCommercialTermsBySale: (
		saleId: string,
		cb: (terms: CommercialTermsView | null) => void,
	): Unsubscribe => {
		const ref = collection(firestoreDb, 'commercial_terms')
		const q = query(ref, where('saleId', '==', saleId), limit(1))
		return onSnapshot(
			q,
			(snap) => {
				const first = snap.docs[0]
				if (!first) {
					cb(null)
					return
				}
				cb(toCommercialTermsView(first.id, first.data()) ?? null)
			},
			() => cb(null),
		)
	},

	updateClient: async (input: {
		saleId: string
		clientId: string
		actorUserId: string
		patch: Partial<Pick<Client, 'fullName' | 'rut' | 'phone' | 'email' | 'address' | 'profession' | 'region'>>
	}) => {
		const { saleId, clientId, actorUserId, patch } = input
		const clientRef = doc(collection(firestoreDb, 'clients'), clientId)
		const snap = await getDoc(clientRef)
		if (!snap.exists()) throw new Error('client_not_found')
		const current = toClientView(snap.id, snap.data())
		if (!current) throw new Error('client_invalid')

		// Enforce rut uniqueness when setting/changing rut.
		const nextRut = normalizeString(patch.rut)
		if (nextRut && nextRut !== current.rut) {
			const clientsRef = collection(firestoreDb, 'clients')
			const q = query(clientsRef, where('rut', '==', nextRut), limit(2))
			const dupSnap = await getDocs(q)
			const dup = dupSnap.docs.find((d) => d.id !== clientId)
			if (dup) throw new Error('rut_in_use')
		}

		const updates: Record<string, unknown> = {}
		const fields: Array<keyof typeof patch> = [
			'fullName',
			'rut',
			'phone',
			'email',
			'address',
			'profession',
			'region',
		]

		for (const f of fields) {
			if (patch[f] === undefined) continue
			if (f === 'region') {
				updates[f] = toControlledRegion(patch[f]) ?? 'REGIONES'
				continue
			}
			updates[f] = patch[f]
		}

		if (Object.keys(updates).length === 0) return

		updates.updatedAt = serverTimestamp()
		await updateDoc(clientRef, cleanUndefined(updates))

		for (const f of fields) {
			if (patch[f] === undefined) continue
			const prev = (current as any)[f] as unknown
			const next = f === 'region' ? (updates[f] as ControlledRegion) : ((patch as any)[f] as unknown)
			if ((prev ?? '') === (next ?? '')) continue
			await eventsService.createEvent({
				saleId,
				userId: actorUserId,
				entity: 'CLIENT',
				field: String(f),
				previousValue: prev === undefined ? undefined : String(prev),
				newValue: next === undefined ? '' : String(next),
			})
		}
	},

	upsertBeneficiary: async (input: {
		saleId: string
		actorUserId: string
		mode?: 'save' | 'replace'
		beneficiary: Omit<Beneficiary, 'id' | 'saleId' | 'createdAt'> & { id?: string }
	}) => {
		const { saleId, actorUserId } = input
		const mode = input.mode ?? 'save'
		const ref = collection(firestoreDb, 'beneficiaries')
		const q = query(ref, where('saleId', '==', saleId), limit(1))
		const existing = await getDocs(q)
		const first = existing.docs[0]
		const normalizedRegion = toControlledRegion(input.beneficiary.region) ?? 'REGIONES'

		const nextData = {
			fullName: input.beneficiary.fullName,
			rut: input.beneficiary.rut,
			serviceAddress: input.beneficiary.serviceAddress,
			region: normalizedRegion,
		}

		let beneficiaryId: string
		let previous: BeneficiaryView | null = null
		let isCreate = false
		if (first) {
			beneficiaryId = first.id
			previous = toBeneficiaryView(first.id, first.data())
			await updateDoc(doc(ref, beneficiaryId), cleanUndefined(nextData))
		} else {
			const benRef = doc(ref)
			beneficiaryId = benRef.id
			isCreate = true
			await setDoc(
				benRef,
				cleanUndefined({
					id: beneficiaryId,
					saleId,
					...nextData,
					createdAt: serverTimestamp(),
				}),
			)
		}

		if (!isCreate && previous && mode === 'replace') {
			await eventsService.createEvent({
				saleId,
				userId: actorUserId,
				entity: 'BENEFICIARY',
				field: 'replaced',
				previousValue: previous.fullName,
				newValue: nextData.fullName,
			})
		} else {
			// Events per changed field
			const fields: Array<keyof typeof nextData> = ['fullName', 'rut', 'serviceAddress', 'region']
			for (const f of fields) {
				const prev = previous ? (previous as any)[f] : undefined
				const next = (nextData as any)[f]
				if (!isCreate && (prev ?? '') === (next ?? '')) continue
				await eventsService.createEvent({
					saleId,
					userId: actorUserId,
					entity: 'BENEFICIARY',
					field: String(f),
					previousValue: prev === undefined ? undefined : String(prev),
					newValue: next === undefined ? '' : String(next),
					comment: isCreate ? 'Creación de beneficiario' : undefined,
				})
			}
		}

		// Beneficiary defines sale.serviceRegion
		const salesRef = collection(firestoreDb, 'sales')
		const saleRef = doc(salesRef, saleId)
		const saleSnap = await getDoc(saleRef)
		const saleData = saleSnap.exists() ? (saleSnap.data() as Record<string, unknown>) : null
		const prevRegion = saleData?.serviceRegion ? String(saleData.serviceRegion) : undefined
		const nextRegion = nextData.region
		if (nextRegion && prevRegion !== nextRegion) {
			await updateDoc(saleRef, cleanUndefined({ serviceRegion: nextRegion }))
			await eventsService.createEvent({
				saleId,
				userId: actorUserId,
				entity: 'SALE',
				field: 'serviceRegion',
				previousValue: prevRegion,
				newValue: nextRegion,
				comment: 'Región de servicio definida por beneficiario',
			})
		}

		return { beneficiaryId }
	},

	upsertCommercialTerms: async (input: {
		saleId: string
		actorUserId: string
		terms: Omit<CommercialTerms, 'id' | 'saleId' | 'createdAt' | 'updatedAt'>
	}) => {
		const { saleId, actorUserId, terms } = input
		const ref = collection(firestoreDb, 'commercial_terms')
		const q = query(ref, where('saleId', '==', saleId), limit(1))
		const existing = await getDocs(q)
		const first = existing.docs[0]

		let termsId: string
		let previous: CommercialTermsView | null = null
		let isCreate = false
		if (first) {
			termsId = first.id
			previous = toCommercialTermsView(first.id, first.data())
			await updateDoc(
				doc(ref, termsId),
				cleanUndefined({
					basePrice: terms.basePrice,
					discountPercentage: terms.discountPercentage,
					finalPrice: terms.finalPrice,
					discountConfirmed: terms.discountConfirmed,
					finalPriceConfirmed: terms.finalPriceConfirmed,
					updatedAt: serverTimestamp(),
				}),
			)
		} else {
			const ctRef = doc(ref)
			termsId = ctRef.id
			isCreate = true
			await setDoc(
				ctRef,
				cleanUndefined({
					id: termsId,
					saleId,
					basePrice: terms.basePrice,
					discountPercentage: terms.discountPercentage,
					finalPrice: terms.finalPrice,
					discountConfirmed: terms.discountConfirmed,
					finalPriceConfirmed: terms.finalPriceConfirmed,
					createdAt: serverTimestamp(),
					updatedAt: serverTimestamp(),
				}),
			)
		}

		const fields: Array<keyof typeof terms> = [
			'basePrice',
			'discountPercentage',
			'finalPrice',
			'discountConfirmed',
			'finalPriceConfirmed',
		]
		for (const f of fields) {
			const prev = previous ? (previous as any)[f] : undefined
			const next = (terms as any)[f]
			const prevStr = numberToString(prev)
			const nextStr = numberToString(next)
			if (!isCreate && (prevStr ?? '') === (nextStr ?? '')) continue
			await eventsService.createEvent({
				saleId,
				userId: actorUserId,
				entity: 'COMMERCIAL',
				field: String(f),
				previousValue: prevStr,
				newValue: nextStr ?? '',
				comment: isCreate ? 'Creación términos comerciales' : undefined,
			})
		}

		return { termsId }
	},

	updateSalePlanAndModality: async (input: {
		saleId: string
		actorUserId: string
		plan?: Sale['plan']
		modality?: Sale['modality']
	}) => {
		const { saleId, actorUserId, plan, modality } = input
		const saleRef = doc(collection(firestoreDb, 'sales'), saleId)
		const snap = await getDoc(saleRef)
		if (!snap.exists()) throw new Error('sale_not_found')
		const current = snap.data() as Sale

		const patch: Partial<Sale> = {}
		if (plan !== undefined) patch.plan = plan
		if (modality !== undefined) patch.modality = modality

		await updateWithEvents<Sale>({
			entity: 'SALE',
			docRef: saleRef as unknown as import('firebase/firestore').DocumentReference<Sale>,
			current,
			patch,
			actorUserId,
			saleId,
			fieldMap: {
				plan: 'plan',
				modality: 'modality',
			},
		})
	},

	closeSale: async (input: {
		saleId: string
		actorUserId: string
	}): Promise<DomainResult<void, SaleDomainError>> => {
		const { saleId, actorUserId } = input
		const salesRef = collection(firestoreDb, 'sales')
		const saleRef = doc(salesRef, saleId)
		const saleSnap = await getDoc(saleRef)
		if (!saleSnap.exists()) return { ok: false, error: 'SALE_NOT_FOUND' }
		const sale = saleSnap.data() as Record<string, unknown>
		const currentStatus = sale.status as SaleStatus | undefined
		if (!currentStatus) return { ok: false, error: 'SALE_INCOMPLETE' }
		if (currentStatus === 'archived') return { ok: false, error: 'SALE_NOT_FOUND' }
		if (currentStatus === 'closed') return { ok: true, data: undefined }

		const plan = sale.plan as Sale['plan'] | undefined
		const modality = sale.modality as Sale['modality'] | undefined
		if (!plan || !modality) return { ok: false, error: 'SALE_INCOMPLETE' }

		// Must have a Beneficiary.
		const benRef = collection(firestoreDb, 'beneficiaries')
		const benQ = query(benRef, where('saleId', '==', saleId), limit(1))
		const benSnap = await getDocs(benQ)
		if (!benSnap.docs[0]) return { ok: false, error: 'BENEFICIARY_REQUIRED' }

		// Only by CONTRACT = SIGNED.
		const stepsRef = collection(firestoreDb, 'sale_steps')
		const contractQ = query(stepsRef, where('saleId', '==', saleId), where('type', '==', 'CONTRACT'), limit(1))
		const contractSnap = await getDocs(contractQ)
		const contract = contractSnap.docs[0]?.data() as Record<string, unknown> | undefined
		const contractStatus = contract?.status as SaleStepStatus | undefined
		if (contractStatus !== 'SIGNED') return { ok: false, error: 'CONTRACT_NOT_SIGNED' }

		await updateDoc(
			saleRef,
			cleanUndefined({
				status: 'closed',
				closedAt: serverTimestamp(),
			}),
		)

		await eventsService.createEvent({
			saleId,
			userId: actorUserId,
			entity: 'SALE',
			field: 'status',
			previousValue: currentStatus,
			newValue: 'closed',
			comment: 'Cierre de venta',
		})

		return { ok: true, data: undefined }
	},

	archiveSale: async (input: {
		saleId: string
		actorUserId: string
	}) => {
		const { saleId, actorUserId } = input
		const salesRef = collection(firestoreDb, 'sales')
		const saleRef = doc(salesRef, saleId)
		const saleSnap = await getDoc(saleRef)
		if (!saleSnap.exists()) throw new Error('sale_not_found')
		const sale = saleSnap.data() as Record<string, unknown>
		const currentStatus = sale.status as SaleStatus | undefined
		if (!currentStatus) throw new Error('sale_invalid')
		if (currentStatus === 'archived') return

		await updateWithEvents<Record<string, unknown>>({
			entity: 'SALE',
			docRef: saleRef as unknown as import('firebase/firestore').DocumentReference<Record<string, unknown>>,
			current: sale,
			patch: {
				status: 'archived',
				archivedAt: serverTimestamp(),
			},
			actorUserId,
			saleId,
			fieldMap: {
				status: 'status',
				archivedAt: 'archivedAt',
			},
		})
	},

	ensureSaleStepsForSale: async (input: {
		saleId: string
		actorUserId: string
		serviceRegion?: string
	}) => {
		const { saleId, actorUserId, serviceRegion } = input
		const required = computeRequiredStepTypes(serviceRegion)
		const stepsRef = collection(firestoreDb, 'sale_steps')
		const q = query(stepsRef, where('saleId', '==', saleId))
		const snap = await getDocs(q)
		const existingTypes = new Set<SaleStepType>()
		for (const d of snap.docs) {
			const data = d.data() as Record<string, unknown>
			const type = data.type as SaleStepType | undefined
			if (type) existingTypes.add(type)
		}

		for (const type of required) {
			if (existingTypes.has(type)) continue
			const stepRef = doc(stepsRef)
			await setDoc(
				stepRef,
				cleanUndefined({
					id: stepRef.id,
					saleId,
					type,
					status: 'PENDING',
					updatedAt: serverTimestamp(),
					updatedBy: actorUserId,
				} satisfies Omit<SaleStep, 'updatedAt'> & { updatedAt: unknown }),
			)
			await eventsService.createEvent({
				saleId,
				userId: actorUserId,
				entity: 'STEP',
				field: 'status',
				newValue: 'PENDING',
				comment: `Inicializa paso ${type}`,
			})
		}
	},

	updateSaleStep: async (input: {
		saleId: string
		actorUserId: string
		type: SaleStepType
		status?: SaleStepStatus
		method?: SaleStep['method']
	}) => {
		const { saleId, actorUserId, type, status, method } = input
		const stepsRef = collection(firestoreDb, 'sale_steps')
		const q = query(stepsRef, where('saleId', '==', saleId), where('type', '==', type), limit(1))
		const existing = await getDocs(q)
		const first = existing.docs[0]
		if (!first) throw new Error('step_not_found')
		const current = toSaleStepView(first.id, first.data())
		if (!current) throw new Error('step_invalid')

		const updates: Record<string, unknown> = {
			updatedAt: serverTimestamp(),
			updatedBy: actorUserId,
		}
		if (status) updates.status = status
		if (method !== undefined) updates.method = method

		await updateDoc(doc(stepsRef, first.id), cleanUndefined(updates))

		if (status && current.status !== status) {
			await eventsService.createEvent({
				saleId,
				userId: actorUserId,
				entity: 'STEP',
				field: 'status',
				previousValue: current.status,
				newValue: status,
				comment: `Paso ${type}`,
			})
		}
		if (method !== undefined && (current.method ?? '') !== (method ?? '')) {
			await eventsService.createEvent({
				saleId,
				userId: actorUserId,
				entity: 'STEP',
				field: 'method',
				previousValue: current.method,
				newValue: method ?? '',
				comment: `Paso ${type}`,
			})
		}
	},

	createLead: async (input: CreateLeadInput, actorUserId: string): Promise<{ saleId: string; clientId: string }> => {
		const logAndThrow = (stage: string, err: unknown) => {
			// eslint-disable-next-line no-console
			console.error('[firestore][sales] createLead failed', { stage, input, actorUserId, err })
			throw err
		}

		// 1) Create or reuse Client (only dedupe by RUT, per contract hint).
		let clientId: string | undefined
		let createdClient = false
		if (input.rut) {
			const clientsRef = collection(firestoreDb, 'clients')
			const q = query(clientsRef, where('rut', '==', input.rut), limit(1))
			const snap = await getDocs(q)
			const first = snap.docs[0]
			if (first) clientId = first.id
		}

		if (!clientId) {
			const clientRef = doc(collection(firestoreDb, 'clients'))
			clientId = clientRef.id
			createdClient = true
			try {
				await setDoc(
					clientRef,
					cleanUndefined({
						id: clientId,
						fullName: input.fullName,
						rut: input.rut,
						phone: input.phone,
						email: input.email,
						address: input.address,
						profession: input.profession,
						region: input.region,
						createdAt: serverTimestamp(),
						updatedAt: serverTimestamp(),
					}),
				)
			} catch (err) {
				logAndThrow('clients.setDoc', err)
			}
		}

		// 2) Create Sale as Lead. Note: plan/modality are explicitly allowed to be missing for status='lead'.
		const saleRef = doc(collection(firestoreDb, 'sales'))
		const saleId = saleRef.id
		try {
			await setDoc(
				saleRef,
				cleanUndefined({
					id: saleId,
					clientId,
					status: 'lead',
					createdAt: serverTimestamp(),
				}),
			)
		} catch (err) {
			logAndThrow('sales.setDoc', err)
		}

		// 3) Create Events (saleId is required for ALL events).
		if (createdClient) {
			try {
				await eventsService.createEvent({
					saleId,
					userId: actorUserId,
					entity: 'CLIENT',
					field: 'fullName',
					newValue: input.fullName,
					comment: 'Creación de cliente',
				})
			} catch (err) {
				logAndThrow('events.createEvent(client.fullName)', err)
			}
			if (input.rut) {
				try {
					await eventsService.createEvent({
						saleId,
						userId: actorUserId,
						entity: 'CLIENT',
						field: 'rut',
						newValue: input.rut,
					})
				} catch (err) {
					logAndThrow('events.createEvent(client.rut)', err)
				}
			}
			if (input.phone) {
				try {
					await eventsService.createEvent({
						saleId,
						userId: actorUserId,
						entity: 'CLIENT',
						field: 'phone',
						newValue: input.phone,
					})
				} catch (err) {
					logAndThrow('events.createEvent(client.phone)', err)
				}
			}
			if (input.email) {
				try {
					await eventsService.createEvent({
						saleId,
						userId: actorUserId,
						entity: 'CLIENT',
						field: 'email',
						newValue: input.email,
					})
				} catch (err) {
					logAndThrow('events.createEvent(client.email)', err)
				}
			}
		}

		try {
			await eventsService.createEvent({
				saleId,
				userId: actorUserId,
				entity: 'SALE',
				field: 'clientId',
				newValue: clientId,
				comment: 'Asociación cliente → venta',
			})
		} catch (err) {
			logAndThrow('events.createEvent(sale.clientId)', err)
		}

		try {
			await eventsService.createEvent({
				saleId,
				userId: actorUserId,
				entity: 'SALE',
				field: 'status',
				newValue: 'lead',
				comment: 'Creación de lead',
			})
		} catch (err) {
			logAndThrow('events.createEvent(sale.status=lead)', err)
		}

		return { saleId, clientId }
	},

	convertLeadToInProgress: async (saleId: string, actorUserId: string) => {
		const salesRef = collection(firestoreDb, 'sales')
		await updateDoc(doc(salesRef, saleId), cleanUndefined({ status: 'in_progress' }))

		await eventsService.createEvent({
			saleId,
			userId: actorUserId,
			entity: 'SALE',
			field: 'status',
			previousValue: 'lead',
			newValue: 'in_progress',
			comment: 'Conversión Lead → Venta',
		})
	},
}

export function computeRequiredStepTypes(serviceRegion?: string): SaleStepType[] {
	const base: SaleStepType[] = ['CONTRACT', 'PAYMENT', 'DEVICE_CONFIG', 'CREDENTIALS']
	const region = toControlledRegion(serviceRegion) ?? 'REGIONES'
	const isSantiago = region === 'SANTIAGO'
	const isValparaiso = region === 'VALPARAISO'

	if (isSantiago || isValparaiso) {
		return [...base, 'INSTALLATION']
	}

	return [...base, 'SHIPPING', 'REMOTE_SUPPORT']
}
