export type BlockedSaleReason =
	| 'CONTRACT_NOT_SIGNED'
	| 'PAYMENT_PENDING'
	| 'BENEFICIARY_REQUIRED'
	| 'INCOMPLETE_DATA'

export type BuildExecutiveReportInput = { from: Date; to: Date }

export type ExecutiveReport = {
	range: { from: Date; to: Date }

	summary: {
		leadsCreated: number
		leadsDropped: number
		leadsDropRate: number
		salesCreated: number
		salesClosed: number
		salesBlocked: number
	}

	funnel: {
		leads: number
		sales: number
		closed: number
	}

	blockedSales: {
		total: number
		reasons: {
			reason: BlockedSaleReason
			count: number
			averageDaysBlocked: number
		}[]
	}

	salesTimeline: {
		saleId: string
		customerName: string
		events: {
			type: string
			date: Date
		}[]
		currentStatus: string
		blockedReason?: BlockedSaleReason
	}[]
}
