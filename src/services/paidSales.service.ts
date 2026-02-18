import { collection, getDocs, orderBy, query, Timestamp, where } from 'firebase/firestore'
import { firestoreDb } from './firebase'
import type { PaidSaleBillingModel, PaidSaleClient, PaidSaleService, PaidSaleView } from '../models/PaidSale'
import { coerceToDate } from '../utils/date'
import { salesService } from './sales.service'

function startOfDay(d: Date) {
	const out = new Date(d)
	out.setHours(0, 0, 0, 0)
	return out
}

function endOfDay(d: Date) {
	const out = new Date(d)
	out.setHours(23, 59, 59, 999)
	return out
}

function isBillingModel(value: unknown): value is PaidSaleBillingModel {
	return value === 'ANNUAL_CC' || value === 'MONTHLY' || value === 'MONTHLY_MANUAL' || value === 'MONTHLY_AUTOMATIC'
}

function toStringSafe(value: unknown): string {
	if (value === null || value === undefined) return ''
	return String(value)
}

function normalizeClient(raw: unknown, fallback?: Partial<PaidSaleClient>): PaidSaleClient {
	const obj = (raw ?? {}) as Record<string, unknown>
	return {
		full_name: toStringSafe(obj.full_name ?? fallback?.full_name),
		rut: toStringSafe(obj.rut ?? fallback?.rut),
		address: toStringSafe(obj.address ?? fallback?.address),
		phone: toStringSafe(obj.phone ?? fallback?.phone),
		email: toStringSafe(obj.email ?? fallback?.email),
	}
}

function normalizeService(raw: unknown, fallback?: Partial<PaidSaleService>): PaidSaleService {
	const obj = (raw ?? {}) as Record<string, unknown>
	return {
		plan_id: toStringSafe(obj.plan_id ?? fallback?.plan_id),
		plan_name: toStringSafe(obj.plan_name ?? fallback?.plan_name),
	}
}

export type PaidSalesFilters = {
	from?: Date
	to?: Date
}

export const paidSalesService = {
	getPaidSales: async (filters: PaidSalesFilters = {}): Promise<PaidSaleView[]> => {
		const salesRef = collection(firestoreDb, 'sales')

		const constraints: any[] = [where('payment_status', '==', 'PAID')]

		if (filters.from) {
			constraints.push(where('paid_at', '>=', Timestamp.fromDate(startOfDay(filters.from))))
		}
		if (filters.to) {
			constraints.push(where('paid_at', '<=', Timestamp.fromDate(endOfDay(filters.to))))
		}

		constraints.push(orderBy('paid_at', 'desc'))
		const q = query(salesRef, ...constraints)
		const snap = await getDocs(q)

		// Optional compatibility: if older docs don't embed client, try resolving via clientId.
		const clientIds = snap.docs
			.map((d) => (d.data() as any).clientId)
			.filter((x: any): x is string => typeof x === 'string' && x.trim().length > 0)
		const clientsById = clientIds.length > 0 ? await salesService.getClientsByIds(clientIds) : {}

		const out: PaidSaleView[] = []

		for (const d of snap.docs) {
			const data = d.data() as Record<string, unknown>
			const payment = (data as any).payment as any | undefined
			const billing_model =
				payment && isBillingModel(payment.billing_model)
					? (payment.billing_model as PaidSaleBillingModel)
					: isBillingModel(data.billing_model)
						? (data.billing_model as PaidSaleBillingModel)
						: null
			if (!billing_model) continue

			const amountRaw = (data.amount ?? {}) as Record<string, unknown>
			const value =
				payment && Number.isFinite(Number(payment.amount_paid))
					? Number(payment.amount_paid)
					: Number(amountRaw.value)
			if (!Number.isFinite(value)) continue

			const currency = String(amountRaw.currency ?? 'CLP')
			if (currency !== 'CLP') continue

			const paidAt = coerceToDate(payment?.paid_at) ?? coerceToDate(data.paid_at)
			if (!paidAt) continue

			const clientFallbackId = typeof (data as any).clientId === 'string' ? String((data as any).clientId) : ''
			const clientFallback = clientFallbackId ? clientsById[clientFallbackId] : undefined

			const client = normalizeClient(data.client, {
				full_name: clientFallback?.fullName,
				rut: clientFallback?.rut,
				phone: clientFallback?.phone,
				email: clientFallback?.email,
				address: clientFallback?.address,
			})

			const planSnapshot = (data as any).planSnapshot as any
			const service = normalizeService(data.service, {
				plan_id: toStringSafe((data as any).plan_id ?? (data as any).planId ?? planSnapshot?.id),
				plan_name: toStringSafe((data as any).plan_name ?? planSnapshot?.name),
			})

			out.push({
				sale_id: toStringSafe((data as any).sale_id ?? d.id),
				payment_status: 'PAID',
				billing_model,
				amount: {
					value,
					currency: 'CLP',
					period:
						billing_model === 'ANNUAL_CC' ? 'ANNUAL' : 'MONTHLY',
				},
				paid_at: paidAt,
				client,
				service,
			})
		}

		return out
	},
}
