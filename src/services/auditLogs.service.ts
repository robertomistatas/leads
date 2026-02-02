import { addDoc, collection, doc, serverTimestamp } from 'firebase/firestore'
import { firebaseAuth, firestoreDb } from './firebase'
import { cleanUndefined } from '../utils/cleanUndefined'
import type { AuditAction, AuditActor, AuditChange, AuditEntityType, AuditLog } from '../models/AuditLog'

function currentActor(): AuditActor {
	const u = firebaseAuth.currentUser
	return cleanUndefined({
		userId: u?.uid,
		email: u?.email ?? undefined,
		role: undefined,
	})
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
}
