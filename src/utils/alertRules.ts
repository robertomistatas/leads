import type { SaleStatus } from '../models/Sale'
import type { EventView } from '../services/events.service'
import type { SaleStepView } from '../services/sales.service'
import type { SaleStepType } from '../models/SaleStep'
import { saleStepTypeLabel } from './labels'

function missingFieldLabel(key: string) {
	switch (key) {
		case 'CLIENT.fullName':
			return 'Cliente: nombre completo'
		case 'CLIENT.phone|email':
			return 'Cliente: teléfono o email'
		case 'CLIENT.region':
			return 'Cliente: región'
		case 'BENEFICIARY.fullName':
			return 'Beneficiario: nombre completo'
		case 'BENEFICIARY.serviceAddress':
			return 'Beneficiario: dirección de servicio'
		case 'BENEFICIARY.region':
			return 'Beneficiario: región'
		case 'SALE.plan':
			return 'Venta: plan'
		case 'SALE.modality':
			return 'Venta: modalidad'
		default:
			return key
	}
}

export type AlertLevel = 'ok' | 'warning' | 'critical'

export type SaleRuntimeAlerts = {
	level: AlertLevel
	reasons: string[]
}

export type SaleForAlerts = {
	id: string
	status: SaleStatus
	createdAt?: Date
	closedAt?: Date
	archivedAt?: Date
	plan?: unknown
	modality?: unknown
}

export function computeSaleRuntimeAlerts(input: {
	sale: SaleForAlerts
	events: EventView[]
	steps?: SaleStepView[]
	requiredStepTypes?: SaleStepType[]
	criticalMissingFields?: string[]
}): SaleRuntimeAlerts {
	const { sale, events, steps = [], requiredStepTypes, criticalMissingFields } = input

	if (sale.status === 'archived' || sale.archivedAt) {
		return { level: 'ok', reasons: [] }
	}

	const reasons: string[] = []
	const now = Date.now()

	const latestEventAt = events[0]?.createdAt
	const baseAt = latestEventAt ?? sale.createdAt
	if (baseAt) {
		const hours = (now - baseAt.getTime()) / (1000 * 60 * 60)
		if (hours >= 48) reasons.push('48h sin eventos')
		else if (hours >= 24) reasons.push('24h sin eventos')

		if (hours >= 24 && criticalMissingFields && criticalMissingFields.length > 0) {
			reasons.push(`Datos incompletos >24h: ${criticalMissingFields.map(missingFieldLabel).join(', ')}`)
		}
	}

	// Basic dependencies + shipping SLA
	const contract = steps.find((s) => s.type === 'CONTRACT')
	const payment = steps.find((s) => s.type === 'PAYMENT')
	const isContractSigned = contract?.status === 'SIGNED'
	const isPaymentDone = payment?.status === 'DONE'
	const hasPaymentMethod = Boolean(payment?.method)
	if (isPaymentDone && !hasPaymentMethod) {
		reasons.push('Pago listo sin método')
	}

	const shippingRequired = requiredStepTypes ? requiredStepTypes.includes('SHIPPING') : true
	const shipping = steps.find((s) => s.type === 'SHIPPING')
	const isShippingSent = shipping?.status === 'SENT' || shipping?.status === 'DONE'

	if (shippingRequired && isShippingSent && (!isContractSigned || !isPaymentDone)) {
		reasons.push('Dependencia rota: envío sin contrato/pago')
	}

	if (shippingRequired && isContractSigned && isPaymentDone && !isShippingSent) {
		const contractAt = contract?.updatedAt
		const paymentAt = payment?.updatedAt
		const startAt = contractAt && paymentAt ? (contractAt > paymentAt ? contractAt : paymentAt) : contractAt ?? paymentAt
		if (startAt) {
			const days = (now - startAt.getTime()) / (1000 * 60 * 60 * 24)
			if (days >= 4) reasons.push('Envío pendiente >4 días')
		}
	}

	if (sale.status === 'closed' && requiredStepTypes && requiredStepTypes.length > 0) {
		const isDone = (type: SaleStepType, status: string | undefined) => {
			if (!status) return false
			if (type === 'CONTRACT') return status === 'SIGNED'
			if (type === 'PAYMENT') return status === 'DONE'
			if (type === 'SHIPPING') return status === 'SENT' || status === 'DONE'
			return status === 'DONE'
		}
		const missing = requiredStepTypes.filter((t) => !isDone(t, steps.find((s) => s.type === t)?.status))
		if (missing.length > 0) reasons.push(`Venta cerrada con pasos pendientes: ${missing.map(saleStepTypeLabel).join(', ')}`)
	}

	const level: AlertLevel = reasons.includes('48h sin eventos')
		? 'critical'
		: reasons.length > 0
			? 'warning'
			: 'ok'

	return { level, reasons }
}

