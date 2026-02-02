import type { Plan } from '../models/Plan'
import type { PricingPaymentMethod, PricingSummary } from '../models/Sale'

function clampPercentage(value: unknown): number {
	const n = typeof value === 'number' ? value : Number(value)
	if (!Number.isFinite(n)) return 0
	return Math.max(0, Math.min(100, n))
}

function roundClp(value: number): number {
	// CLP is integer.
	if (!Number.isFinite(value)) return 0
	return Math.round(value)
}

export function computePricingSummary(params: {
	plan: Plan
	paymentMethod: PricingPaymentMethod
	discountPercentage: number
	modality?: 'CON_TELEASISTENCIA' | 'SIN_TELEASISTENCIA'
}): PricingSummary {
	const { plan, paymentMethod } = params
	const discountPercentage = clampPercentage(params.discountPercentage)
	const hasTeleassistance = params.modality === 'CON_TELEASISTENCIA'

	const monthsCharged = paymentMethod === 'CREDIT_CARD_ANNUAL' ? Math.max(1, plan.pricing.monthsBilled ?? 12) : 1
	const monthlySubscriptionClp = roundClp(plan.pricing.monthlySubscriptionClp ?? 0)

	const setupFeeClp = plan.pricing.waiveActivationFee ? 0 : roundClp(plan.pricing.activationFeeClp ?? 0)
	const setupFeeCharged = paymentMethod === 'CREDIT_CARD_ANNUAL' ? 0 : setupFeeClp

	const subscriptionCharged = roundClp(monthsCharged * monthlySubscriptionClp)

	const teleassistanceMonthlyFeeClp = roundClp(plan.teleassistance?.monthlyFeeClp ?? 0)
	const teleassistanceCharged =
		hasTeleassistance && Boolean(plan.teleassistance?.enabled)
			? roundClp(monthsCharged * teleassistanceMonthlyFeeClp)
			: 0

	const baseAmount = roundClp(subscriptionCharged + teleassistanceCharged + setupFeeCharged)

	const discountAmount = roundClp((baseAmount * discountPercentage) / 100)
	const finalAmount = Math.max(0, roundClp(baseAmount - discountAmount))

	return {
		paymentMethod,
		monthsCharged,
		monthlySubscriptionClp,
		teleassistanceMonthlyFeeClp,
		setupFeeClp,
		setupFeeCharged,
		subscriptionCharged,
		teleassistanceCharged,
		baseAmount,
		discountPercentage,
		discountAmount,
		finalAmount,
	}
}
