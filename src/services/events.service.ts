import {
	collection,
	doc,
	limit,
	onSnapshot,
	orderBy,
	query,
	serverTimestamp,
	setDoc,
	where,
	type Unsubscribe,
} from 'firebase/firestore'
import { firestoreDb } from './firebase'
import type { Event, EventEntity } from '../models/Event'
import { coerceToDate } from '../utils/date'
import { cleanUndefined } from '../utils/cleanUndefined'

type CreateEventInput = {
	saleId: string
	userId: string
	entity: EventEntity
	field: string
	previousValue?: string
	newValue?: string
	comment?: string
}

export type EventView = Event

export const eventsService = {
	createEvent: async (input: CreateEventInput): Promise<string> => {
		const ref = doc(collection(firestoreDb, 'events'))
		const id = ref.id

		try {
			// Store `id` as a field too (contract requires it).
			await setDoc(
				ref,
				cleanUndefined({
					id,
					saleId: input.saleId,
					userId: input.userId,
					entity: input.entity,
					field: input.field,
					previousValue: input.previousValue,
					newValue: input.newValue,
					comment: input.comment,
					createdAt: serverTimestamp(),
				}),
			)
		} catch (err) {
			// eslint-disable-next-line no-console
			console.error('[firestore][events] createEvent failed', {
				saleId: input.saleId,
				entity: input.entity,
				field: input.field,
				userId: input.userId,
				err,
			})
			throw err
		}

		return id
	},

	listenSaleEvents: (saleId: string, cb: (events: EventView[]) => void): Unsubscribe => {
		const eventsRef = collection(firestoreDb, 'events')
		const q = query(eventsRef, where('saleId', '==', saleId), orderBy('createdAt', 'desc'))

		return onSnapshot(
			q,
			(snap) => {
				const events = snap.docs
					.map((d) => {
						const data = d.data() as Record<string, unknown>
						return {
							id: String(data.id ?? d.id),
							saleId: String(data.saleId ?? ''),
							userId: String(data.userId ?? ''),
							entity: data.entity as EventEntity,
							field: String(data.field ?? ''),
							previousValue: data.previousValue ? String(data.previousValue) : undefined,
							newValue: data.newValue ? String(data.newValue) : undefined,
							comment: data.comment ? String(data.comment) : undefined,
							createdAt: coerceToDate(data.createdAt) ?? new Date(0),
						} satisfies EventView
					})
					.filter((e) => e.saleId === saleId)

				cb(events)
			},
			() => cb([]),
		)
	},

	listenRecentEvents: (take: number, cb: (events: EventView[]) => void): Unsubscribe => {
		const eventsRef = collection(firestoreDb, 'events')
		const q = query(eventsRef, orderBy('createdAt', 'desc'), limit(take))

		return onSnapshot(
			q,
			(snap) => {
				const events = snap.docs.map((d) => {
					const data = d.data() as Record<string, unknown>
					return {
						id: String(data.id ?? d.id),
						saleId: String(data.saleId ?? ''),
						userId: String(data.userId ?? ''),
						entity: data.entity as EventEntity,
						field: String(data.field ?? ''),
						previousValue: data.previousValue ? String(data.previousValue) : undefined,
						newValue: data.newValue ? String(data.newValue) : undefined,
						comment: data.comment ? String(data.comment) : undefined,
						createdAt: coerceToDate(data.createdAt) ?? new Date(0),
					} satisfies EventView
				})
				cb(events)
			},
			() => cb([]),
		)
	},
}

