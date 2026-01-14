export type SaleStepType =
	| 'CONTRACT'
	| 'PAYMENT'
	| 'DEVICE_CONFIG'
	| 'CREDENTIALS'
	| 'SHIPPING'
	| 'INSTALLATION'
	| 'REMOTE_SUPPORT'

export type SaleStepStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'SENT' | 'SIGNED'

export interface SaleStep {
	id: string
	saleId: string

	type: SaleStepType
	status: SaleStepStatus

	method?: 'FLOW' | 'TRANSFERENCIA' | 'EFECTIVO'
	metadata?: {
		trackingCode?: string
		signatureType?: 'DOCUSIGN' | 'TERRENO'
	}

	updatedAt: Date
	updatedBy: string // userId
}
