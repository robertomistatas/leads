export interface CommercialTerms {
	id: string
	saleId: string

	basePrice: number
	discountPercentage: number
	finalPrice: number

	discountConfirmed: boolean
	finalPriceConfirmed: boolean

	createdAt: Date
	updatedAt: Date
}
