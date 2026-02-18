export type AuditAction = 'CREATE' | 'UPDATE' | 'ACTIVATE' | 'DEACTIVATE'

export type AuditEntityType = 'PLAN' | 'USER'

export type AuditActor = {
	uid?: string
	userId?: string
	email?: string
	role?: string
}

export type AuditChange = {
	field: string
	from: unknown
	to: unknown
}

export interface AuditLog {
	id: string
	action: AuditAction
	entityType: AuditEntityType
	entityId: string
	summary: string
	changes?: AuditChange[]
	actor?: AuditActor
	createdAt?: Date
}
