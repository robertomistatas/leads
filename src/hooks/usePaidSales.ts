import { useEffect, useMemo, useState } from 'react'
import { paidSalesService, type PaidSalesFilters } from '../services/paidSales.service'
import type { PaidSaleView } from '../models/PaidSale'

export function usePaidSales(filters: PaidSalesFilters) {
	const memoFilters = useMemo(
		() => ({
			from: filters.from ? new Date(filters.from) : undefined,
			to: filters.to ? new Date(filters.to) : undefined,
		}),
		[filters.from?.getTime(), filters.to?.getTime()],
	)

	const [sales, setSales] = useState<PaidSaleView[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		let alive = true
		setLoading(true)
		setError(null)

		void paidSalesService
			.getPaidSales(memoFilters)
			.then((next) => {
				if (!alive) return
				setSales(next)
				setLoading(false)
			})
			.catch((e) => {
				if (!alive) return
				setSales([])
				setLoading(false)
				setError(e instanceof Error ? e.message : 'load_failed')
			})

		return () => {
			alive = false
		}
	}, [memoFilters.from?.getTime(), memoFilters.to?.getTime()])

	return { sales, loading, error }
}
