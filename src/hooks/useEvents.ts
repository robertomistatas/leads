import { useEffect, useState } from 'react'
import { eventsService, type EventView } from '../services/events.service'

export function useRecentEvents(take: number) {
	const [events, setEvents] = useState<EventView[]>([])
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		setLoading(true)
		const unsub = eventsService.listenRecentEvents(take, (next) => {
			setEvents(next)
			setLoading(false)
		})
		return () => unsub()
	}, [take])

	return { events, loading }
}
