import {
	addDoc,
	collection,
	doc,
	getDocs,
	limit,
	orderBy,
	query,
	serverTimestamp,
	Timestamp,
	where,
} from 'firebase/firestore'
import { firebaseAuth, firestoreDb } from './firebase'
import { cleanUndefined } from '../utils/cleanUndefined'
import type { AuditAction, AuditActor, AuditChange, AuditEntityType, AuditLog } from '../models/AuditLog'

function currentActor(): AuditActor {
	const u = firebaseAuth.currentUser
	return cleanUndefined({
		uid: u?.uid,
		userId: u?.uid,
		email: u?.email ?? undefined,
		role: undefined,
	})
}

function toDate(value: unknown): Date | undefined {
	if (value instanceof Timestamp) return value.toDate()
	if (value instanceof Date) return value
	return undefined
}

function mapAuditLog(id: string, data: Record<string, unknown>): AuditLog {
	return {
		id,
		action: String(data.action ?? 'UPDATE') as AuditAction,
		entityType: String(data.entityType ?? 'PLAN') as AuditEntityType,
		entityId: String(data.entityId ?? ''),
		summary: String(data.summary ?? ''),
		changes: (data.changes as AuditChange[] | undefined) ?? undefined,
		actor: (data.actor as AuditActor | undefined) ?? undefined,
		createdAt: toDate(data.createdAt),
	}
}

export function newAuditLogDocRef() {
	return doc(collection(firestoreDb, 'audit_logs'))
}

export function buildAuditLogData(input: {
	action: AuditAction
	entityType: AuditEntityType
	entityId: string
	summary: string
	changes?: AuditChange[]
}) {
	return cleanUndefined({
		action: input.action,
		entityType: input.entityType,
		entityId: input.entityId,
		summary: input.summary,
		changes: input.changes,
		actor: currentActor(),
		createdAt: serverTimestamp(),
	})
}

export const auditLogsService = {
	currentActor,

	write: async (input: Omit<AuditLog, 'id' | 'createdAt' | 'actor'> & { actor?: AuditActor }) => {
		await addDoc(collection(firestoreDb, 'audit_logs'), {
			...cleanUndefined({
				action: input.action,
				entityType: input.entityType,
				entityId: input.entityId,
				summary: input.summary,
				changes: input.changes,
				actor: input.actor ?? currentActor(),
			}),
			createdAt: serverTimestamp(),
		})
	},

	listRecent: async (opts: { actorUid?: string; max?: number } = {}): Promise<AuditLog[]> => {
		const max = Math.max(1, Math.min(500, opts.max ?? 200))
		const base = collection(firestoreDb, 'audit_logs')
		const q = opts.actorUid
			? query(base, where('actor.uid', '==', opts.actorUid), orderBy('createdAt', 'desc'), limit(max))
			: query(base, orderBy('createdAt', 'desc'), limit(max))
		const snap = await getDocs(q)
		return snap.docs.map((d) => mapAuditLog(d.id, d.data() as Record<string, unknown>))
	},
}
