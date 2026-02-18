import type { Timestamp } from 'firebase/firestore'

export type PaidSalePaymentStatus = 'PAID' | 'PENDING' | 'FAILED'

export type PaidSaleBillingModel = 'ANNUAL_CC' | 'MONTHLY' | 'MONTHLY_MANUAL' | 'MONTHLY_AUTOMATIC'

export type PaidSaleAmountPeriod = 'ANNUAL' | 'MONTHLY'

export type PaidSaleAmount = {
	value: number
	currency: 'CLP'
	period: PaidSaleAmountPeriod
}

export type PaidSaleClient = {
	full_name: string
	rut: string
	address: string
	phone: string
	email: string
}

export type PaidSaleService = {
	plan_id: string
	plan_name: string
}

export interface PaidSale {
	sale_id: string
	client: PaidSaleClient
	payment_status: PaidSalePaymentStatus
	billing_model: PaidSaleBillingModel
	amount: PaidSaleAmount
	paid_at: Timestamp
	service: PaidSaleService
}

export interface PaidSaleView {
	sale_id: string
	client: PaidSaleClient
	payment_status: 'PAID'
	billing_model: PaidSaleBillingModel
	amount: PaidSaleAmount
	paid_at: Date
	service: PaidSaleService
}
