export type SaleStatus = 'lead' | 'in_progress' | 'closed' | 'archived'

export interface Sale {
	id: string
	clientId: string

	status: SaleStatus

	plan: 'APP' | 'STARTER' | 'MAYOR' | 'GPS_TRACKER' | 'FULL' | 'MIXTO'

	modality: 'CON_TELEASISTENCIA' | 'SIN_TELEASISTENCIA'

	serviceRegion?: string

	hasIncompleteData: boolean // calculado
	hasAlerts: boolean // calculado

	createdAt: Date
	closedAt?: Date
	archivedAt?: Date
}
