import { collection, doc, getDoc } from 'firebase/firestore'
import { firestoreDb } from './firebase'

export type UserRole = 'ventas' | 'operaciones' | 'admin' | 'superadmin' | 'finanzas' | 'administracion' | 'unknown'

function normalizeRole(role: unknown): UserRole {
	const raw = String(role ?? '').trim().toLowerCase()
	if (!raw) return 'unknown'
	if (raw === 'admin') return 'admin'
	if (raw === 'superadmin') return 'superadmin'
	if (raw === 'ventas') return 'ventas'
	if (raw === 'operaciones') return 'operaciones'
	if (raw === 'finanzas') return 'finanzas'
	if (raw === 'administracion' || raw === 'administración') return 'administracion'
	return 'unknown'
}

export type UserProfileView = {
	uid: string
	role: UserRole
}

export const usersService = {
	getUserProfile: async (uid: string): Promise<UserProfileView> => {
		const ref = doc(collection(firestoreDb, 'users'), uid)
		const snap = await getDoc(ref)
		if (!snap.exists()) {
			return { uid, role: 'unknown' }
		}
		const data = snap.data() as Record<string, unknown>
		return { uid, role: normalizeRole(data.role) }
	},
}
