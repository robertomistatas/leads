export interface User {
	id: string // Firebase UID
	name: string
	email: string
	role?: 'ventas' | 'admin' | 'operaciones' // informativo
	active: boolean
	createdAt: Date
}
