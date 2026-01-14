export type EventEntity = 'CLIENT' | 'SALE' | 'BENEFICIARY' | 'COMMERCIAL' | 'STEP'

export interface Event {
	id: string

	saleId: string // SIEMPRE obligatorio
	userId: string // actor (Firebase UID)

	entity: EventEntity
	field: string // nombre del campo modificado

	previousValue?: string
	newValue?: string

	comment?: string

	createdAt: Date
}

