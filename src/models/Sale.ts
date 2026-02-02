import type { Timestamp } from 'firebase/firestore'

export type SaleStatus = 'lead' | 'in_progress' | 'closed' | 'archived'

export type PaymentStatus = 'PENDING' | 'SENT' | 'READY'

export type PaymentSentVia = 'PAYMENT_LINK' | 'PAYMENT_BUTTON' | 'AMAIA_PAYMENT'

export type PricingPaymentMethod = 'MONTHLY' | 'CREDIT_CARD_ANNUAL'

export type PlanSnapshot = {
	// Firestore `plans` doc id
	id: string
	code: string
	name: string
	pricing: {
		monthlySubscriptionClp: number
		activationFeeClp: number
		monthsBilled: number
		waiveActivationFee: boolean
	}
	teleassistance?: {
		enabled: boolean
		monthlyFeeClp: number
	}
	annualCreditCard: boolean
	active: boolean
	updatedAt?: Date
}

export type PricingSummary = {
	paymentMethod: PricingPaymentMethod
	monthsCharged: number
	monthlySubscriptionClp: number
	teleassistanceMonthlyFeeClp?: number
	setupFeeClp: number
	setupFeeCharged: number
	subscriptionCharged: number
	teleassistanceCharged?: number
	baseAmount: number
	discountPercentage: number
	discountAmount: number
	finalAmount: number
}

export type BillingSummary = {
	monthsCharged: number
	setupFeeCharged: number
}

export type SuggestedPricing = {
	monthlyFee: number
	setupFee: number
	teleassistanceAddon?: number
	sourcePlanId: string
	snapshotAt: Timestamp
}

export type FinalPricing = {
	monthlyFee: number
	setupFee: number
	teleassistanceIncluded: boolean
	discountApplied?: number
	notes?: string
}

export type PricingDelta = {
	amountDifference: number
	percentDifference: number
}

export interface Sale {
	id: string
	clientId: string

	status: SaleStatus

	plan: 'APP' | 'STARTER' | 'MAYOR' | 'GPS_TRACKER' | 'FULL' | 'MIXTO'

	modality: 'CON_TELEASISTENCIA' | 'SIN_TELEASISTENCIA'

	serviceRegion?: string

	hasIncompleteData: boolean // calculado
	hasAlerts: boolean // calculado

	// Pago (campos opcionales para compatibilidad con ventas existentes)
	paymentStatus?: PaymentStatus
	paymentSentVia?: PaymentSentVia

	// Pricing (opcional para no romper ventas existentes)
	planId?: string
	planSnapshot?: PlanSnapshot
	paymentMethod?: PricingPaymentMethod
	pricingSummary?: PricingSummary
	billing?: BillingSummary

	// Hybrid pricing (opcional para no romper ventas existentes)
	suggestedPricing?: SuggestedPricing
	finalPricing?: FinalPricing
	pricingDelta?: PricingDelta

	createdAt: Date
	closedAt?: Date
	archivedAt?: Date
}
