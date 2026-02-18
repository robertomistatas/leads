import type { PaidSaleBillingModel, PaidSaleAmountPeriod } from '../models/PaidSale'

export function paidSaleBadgeLabel(model: PaidSaleBillingModel): string {
	switch (model) {
		case 'ANNUAL_CC':
			return 'Pago Anual – Tarjeta de Crédito'
		case 'MONTHLY':
			return 'Pago Mensual'
		case 'MONTHLY_MANUAL':
			return 'Pago Mensual – Manual (AMAIA)'
		case 'MONTHLY_AUTOMATIC':
			return 'Pago Mensual – Automático (AMAIA)'
		default:
			return 'Modalidad'
	}
}

export function periodFromBillingModel(model: PaidSaleBillingModel): PaidSaleAmountPeriod {
	if (model === 'ANNUAL_CC') return 'ANNUAL'
	return 'MONTHLY'
}
