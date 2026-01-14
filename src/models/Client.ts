export interface Client {
	id: string
	fullName: string // obligatorio
	rut?: string // deseable, único
	phone?: string
	email?: string
	address?: string
	profession?: string
	region?: string

	createdAt: Date
	updatedAt: Date
}
