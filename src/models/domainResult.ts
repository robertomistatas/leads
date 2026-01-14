export type DomainResult<T, E> =
	| { ok: true; data: T }
	| { ok: false; error: E }

export type SaleDomainError =
	| 'SALE_NOT_FOUND'
	| 'SALE_INCOMPLETE'
	| 'BENEFICIARY_REQUIRED'
	| 'CONTRACT_NOT_SIGNED'
	| 'PLAN_REQUIRED'
	| 'MODALITY_REQUIRED'
