import type { SaleDomainError } from '@/models/domainResult'

export const saleErrorMessages: Record<SaleDomainError, string> = {
	SALE_NOT_FOUND: 'La venta no existe o ya no está disponible.',
	SALE_INCOMPLETE: 'Faltan datos obligatorios para cerrar la venta.',
	BENEFICIARY_REQUIRED: 'Debe registrar un beneficiario antes de cerrar la venta.',
	CONTRACT_NOT_SIGNED: 'El contrato aún no está firmado.',
	PLAN_REQUIRED: 'Debe definir el plan contratado.',
	MODALITY_REQUIRED: 'Debe definir la modalidad del servicio.',
}
