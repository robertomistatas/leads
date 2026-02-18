export interface User {
	id: string // Firebase UID
	name: string
	email: string
	role?: 'ventas' | 'admin' | 'superadmin' | 'administracion' | 'finanzas' | 'operaciones' // informativo
	active: boolean
	createdAt: Date
}
