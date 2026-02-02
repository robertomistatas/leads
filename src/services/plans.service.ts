import {
	collection,
	doc,
	getDoc,
	getDocs,
	onSnapshot,
	runTransaction,
	serverTimestamp,
	type DocumentData,
	type Unsubscribe,
} from 'firebase/firestore'
import { firestoreDb } from './firebase'
import type { Plan, PlanPricing, PlanTeleassistance } from '../models/Plan'
import { coerceToDate } from '../utils/date'
import type { AuditChange } from '../models/AuditLog'
import { buildAuditLogData, newAuditLogDocRef } from './auditLogs.service'

export type PlanView = Plan

type PlanFirestore = {
	code: string
	name: string
	pricing: PlanPricing
	teleassistance?: PlanTeleassistance
	annualCreditCard: boolean
	active: boolean
	updatedAt?: unknown
}

function toPlanView(id: string, data: DocumentData): PlanView | null {
	const code = data.code as string | undefined
	const name = data.name as string | undefined
	const pricing = data.pricing as PlanPricing | undefined
	const annualCreditCard = data.annualCreditCard as boolean | undefined
	const active = data.active as boolean | undefined

	if (!code || !name || !pricing || typeof annualCreditCard !== 'boolean' || typeof active !== 'boolean') return null

	return {
		id,
		code,
		name,
		pricing: {
			monthlySubscriptionClp: Number(pricing.monthlySubscriptionClp ?? 0),
			activationFeeClp: Number(pricing.activationFeeClp ?? 0),
			monthsBilled: Number(pricing.monthsBilled ?? 12),
			waiveActivationFee: Boolean(pricing.waiveActivationFee ?? false),
		},
		teleassistance: {
			enabled: Boolean((data as any).teleassistance?.enabled ?? false),
			monthlyFeeClp: Number((data as any).teleassistance?.monthlyFeeClp ?? 0),
		},
		annualCreditCard,
		active,
		updatedAt: coerceToDate(data.updatedAt),
	}
}

function computePlanDiff(from: PlanFirestore, to: PlanFirestore): AuditChange[] {
	const changes: AuditChange[] = []

	const push = (field: string, a: unknown, b: unknown) => {
		const same = JSON.stringify(a) === JSON.stringify(b)
		if (!same) changes.push({ field, from: a, to: b })
	}

	push('code', from.code, to.code)
	push('name', from.name, to.name)
	push('annualCreditCard', from.annualCreditCard, to.annualCreditCard)
	push('active', from.active, to.active)
	push('pricing.monthlySubscriptionClp', from.pricing?.monthlySubscriptionClp, to.pricing?.monthlySubscriptionClp)
	push('pricing.activationFeeClp', from.pricing?.activationFeeClp, to.pricing?.activationFeeClp)
	push('pricing.monthsBilled', from.pricing?.monthsBilled, to.pricing?.monthsBilled)
	push('pricing.waiveActivationFee', from.pricing?.waiveActivationFee, to.pricing?.waiveActivationFee)
	push('teleassistance.enabled', from.teleassistance?.enabled ?? false, to.teleassistance?.enabled ?? false)
	push('teleassistance.monthlyFeeClp', from.teleassistance?.monthlyFeeClp ?? 0, to.teleassistance?.monthlyFeeClp ?? 0)

	return changes
}

export const plansService = {
	listenPlans: (cb: (plans: PlanView[]) => void): Unsubscribe => {
		const ref = collection(firestoreDb, 'plans')
		return onSnapshot(
			ref,
			(snap) => {
				const plans = snap.docs
					.map((d) => toPlanView(d.id, d.data()))
					.filter((p): p is PlanView => Boolean(p))
					.sort((a, b) => a.code.localeCompare(b.code, 'es'))
				cb(plans)
			},
			() => cb([]),
		)
	},

	getPlans: async (): Promise<PlanView[]> => {
		const ref = collection(firestoreDb, 'plans')
		const snap = await getDocs(ref)
		return snap.docs
			.map((d) => toPlanView(d.id, d.data()))
			.filter((p): p is PlanView => Boolean(p))
			.sort((a, b) => a.code.localeCompare(b.code, 'es'))
	},

	getPlan: async (planId: string): Promise<PlanView | null> => {
		const ref = doc(collection(firestoreDb, 'plans'), planId)
		const snap = await getDoc(ref)
		if (!snap.exists()) return null
		return toPlanView(snap.id, snap.data())
	},

	createPlan: async (input: {
		code: string
		name: string
		pricing: PlanPricing
		teleassistance?: PlanTeleassistance
		annualCreditCard: boolean
		active: boolean
	}) => {
		const plansRef = collection(firestoreDb, 'plans')
		const planRef = doc(plansRef)
		const planId = planRef.id

		const data: PlanFirestore = {
			code: input.code,
			name: input.name,
			pricing: input.pricing,
			teleassistance: input.teleassistance,
			annualCreditCard: input.annualCreditCard,
			active: input.active,
			updatedAt: serverTimestamp(),
		}

		await runTransaction(firestoreDb, async (tx) => {
			tx.set(planRef, data)
			tx.set(
				newAuditLogDocRef(),
				buildAuditLogData({
					action: 'CREATE',
					entityType: 'PLAN',
					entityId: planId,
					summary: `Creación de plan ${input.code}`,
				}),
			)
		})

		return planId
	},

	updatePlan: async (planId: string, patch: Partial<Omit<PlanFirestore, 'updatedAt'>>) => {
		const planRef = doc(collection(firestoreDb, 'plans'), planId)
		await runTransaction(firestoreDb, async (tx) => {
			const snap = await tx.get(planRef)
			if (!snap.exists()) throw new Error('PLAN_NOT_FOUND')
			const before = snap.data() as PlanFirestore

			const next: PlanFirestore = {
				code: patch.code ?? before.code,
				name: patch.name ?? before.name,
				pricing: {
					monthlySubscriptionClp:
						patch.pricing?.monthlySubscriptionClp ?? before.pricing?.monthlySubscriptionClp ?? 0,
					activationFeeClp: patch.pricing?.activationFeeClp ?? before.pricing?.activationFeeClp ?? 0,
					monthsBilled: patch.pricing?.monthsBilled ?? before.pricing?.monthsBilled ?? 12,
					waiveActivationFee: patch.pricing?.waiveActivationFee ?? before.pricing?.waiveActivationFee ?? false,
				},
				teleassistance: {
					enabled: Boolean(patch.teleassistance?.enabled ?? before.teleassistance?.enabled ?? false),
					monthlyFeeClp: Number(patch.teleassistance?.monthlyFeeClp ?? before.teleassistance?.monthlyFeeClp ?? 0),
				},
				annualCreditCard: patch.annualCreditCard ?? before.annualCreditCard,
				active: patch.active ?? before.active,
				updatedAt: serverTimestamp(),
			}

			const changes = computePlanDiff(before, { ...next, updatedAt: before.updatedAt })

			tx.update(planRef, {
				code: next.code,
				name: next.name,
				pricing: next.pricing,
				teleassistance: next.teleassistance,
				annualCreditCard: next.annualCreditCard,
				active: next.active,
				updatedAt: serverTimestamp(),
			})

			if (changes.length > 0) {
				tx.set(
					newAuditLogDocRef(),
					buildAuditLogData({
						action: 'UPDATE',
						entityType: 'PLAN',
						entityId: planId,
						summary: `Actualización de plan ${before.code}`,
						changes,
					}),
				)
			}
		})
	},

	activatePlan: async (planId: string) => {
		await plansService.setPlanActive(planId, true)
	},

	deactivatePlan: async (planId: string) => {
		await plansService.setPlanActive(planId, false)
	},

	setPlanActive: async (planId: string, active: boolean) => {
		const planRef = doc(collection(firestoreDb, 'plans'), planId)
		await runTransaction(firestoreDb, async (tx) => {
			const snap = await tx.get(planRef)
			if (!snap.exists()) throw new Error('PLAN_NOT_FOUND')
			const before = snap.data() as PlanFirestore
			if (before.active === active) return
			tx.update(planRef, { active, updatedAt: serverTimestamp() })
			tx.set(
				newAuditLogDocRef(),
				buildAuditLogData({
					action: active ? 'ACTIVATE' : 'DEACTIVATE',
					entityType: 'PLAN',
					entityId: planId,
					summary: active ? `Activación de plan ${before.code}` : `Desactivación de plan ${before.code}`,
				}),
			)
		})
	},
}
