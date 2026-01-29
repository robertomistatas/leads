export type SaleStatus = 'lead' | 'in_progress' | 'closed' | 'archived'

export type PaymentStatus = 'PENDING' | 'SENT' | 'READY'

export type PaymentSentVia = 'PAYMENT_LINK' | 'PAYMENT_BUTTON' | 'AMAIA_PAYMENT'

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

	createdAt: Date
	closedAt?: Date
	archivedAt?: Date
}
