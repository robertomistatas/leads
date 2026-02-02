export type PlanPricing = {
	monthlySubscriptionClp: number
	activationFeeClp: number
	monthsBilled: number
	waiveActivationFee: boolean
}

export type PlanTeleassistance = {
	enabled: boolean
	monthlyFeeClp: number
}

export interface Plan {
	id: string
	code: string
	name: string
	pricing: PlanPricing
	teleassistance?: PlanTeleassistance
	annualCreditCard: boolean
	active: boolean
	updatedAt?: Date
}
