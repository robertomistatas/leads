export interface Beneficiary {
  id: string
  saleId: string

  fullName: string
  rut?: string
  serviceAddress: string
  region: string

  createdAt: Date
}
