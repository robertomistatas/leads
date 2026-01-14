import { useEffect, useMemo, useState } from 'react'
import { salesService, type BeneficiaryView, type ClientView, type CommercialTermsView, type SaleView } from '../services/sales.service'
import type { SaleStatus } from '../models/Sale'
import { eventsService, type EventView } from '../services/events.service'
import type { SaleStepView } from '../services/sales.service'

export function useSales(status?: SaleStatus) {
	const [sales, setSales] = useState<SaleView[]>([])
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		const unsub = salesService.listenSales((next) => {
			setSales(next)
			setLoading(false)
		}, status)
		return () => unsub()
	}, [status])

	return { sales, loading }
}

export function useSaleEvents(saleId: string | undefined) {
	const [events, setEvents] = useState<EventView[]>([])
	const [loading, setLoading] = useState(Boolean(saleId))

	useEffect(() => {
		if (!saleId) {
			setEvents([])
			setLoading(false)
			return
		}

		setLoading(true)
		const unsub = eventsService.listenSaleEvents(saleId, (next) => {
			setEvents(next)
			setLoading(false)
		})
		return () => unsub()
	}, [saleId])

	return { events, loading }
}

export function useSaleSteps(saleId: string | undefined) {
	const [steps, setSteps] = useState<SaleStepView[]>([])
	const [loading, setLoading] = useState(Boolean(saleId))

	useEffect(() => {
		if (!saleId) {
			setSteps([])
			setLoading(false)
			return
		}

		setLoading(true)
		const unsub = salesService.listenSaleSteps(saleId, (next) => {
			setSteps(next)
			setLoading(false)
		})
		return () => unsub()
	}, [saleId])

	return { steps, loading }
}

export function useClient(clientId: string | undefined) {
	const [client, setClient] = useState<ClientView | null>(null)
	const [loading, setLoading] = useState(Boolean(clientId))

	useEffect(() => {
		if (!clientId) {
			setClient(null)
			setLoading(false)
			return
		}
		setLoading(true)
		const unsub = salesService.listenClient(clientId, (next) => {
			setClient(next)
			setLoading(false)
		})
		return () => unsub()
	}, [clientId])

	return { client, loading }
}

export function useClientsByIds(clientIds: Array<string | undefined>) {
	const ids = useMemo(() => Array.from(new Set(clientIds.filter(Boolean))) as string[], [clientIds])
	const [clientsById, setClientsById] = useState<Record<string, ClientView>>({})
	const [loading, setLoading] = useState(ids.length > 0)

	useEffect(() => {
		let alive = true
		if (ids.length === 0) {
			setClientsById({})
			setLoading(false)
			return
		}

		setLoading(true)
		void salesService
			.getClientsByIds(ids)
			.then((map) => {
				if (!alive) return
				setClientsById(map)
				setLoading(false)
			})
			.catch((err) => {
				// eslint-disable-next-line no-console
				console.error('[useClientsByIds] failed', err)
				if (!alive) return
				setLoading(false)
			})

		return () => {
			alive = false
		}
	}, [ids])

	return { clientsById, loading }
}

export function useBeneficiary(saleId: string | undefined) {
	const [beneficiary, setBeneficiary] = useState<BeneficiaryView | null>(null)
	const [loading, setLoading] = useState(Boolean(saleId))

	useEffect(() => {
		if (!saleId) {
			setBeneficiary(null)
			setLoading(false)
			return
		}
		setLoading(true)
		const unsub = salesService.listenBeneficiaryBySale(saleId, (next) => {
			setBeneficiary(next)
			setLoading(false)
		})
		return () => unsub()
	}, [saleId])

	return { beneficiary, loading }
}

export function useCommercialTerms(saleId: string | undefined) {
	const [terms, setTerms] = useState<CommercialTermsView | null>(null)
	const [loading, setLoading] = useState(Boolean(saleId))

	useEffect(() => {
		if (!saleId) {
			setTerms(null)
			setLoading(false)
			return
		}
		setLoading(true)
		const unsub = salesService.listenCommercialTermsBySale(saleId, (next) => {
			setTerms(next)
			setLoading(false)
		})
		return () => unsub()
	}, [saleId])

	return { terms, loading }
}

