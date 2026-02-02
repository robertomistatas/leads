import { useEffect, useState } from 'react'
import { plansService, type PlanView } from '../services/plans.service'

export function usePlans() {
	const [plans, setPlans] = useState<PlanView[]>([])
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		const unsub = plansService.listenPlans((next) => {
			setPlans(next)
			setLoading(false)
		})
		return () => unsub()
	}, [])

	return { plans, loading }
}
