import { deleteApp, initializeApp } from 'firebase/app'
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth'
import type { FirebaseError } from 'firebase/app'
import {
	collection,
	doc,
	getDoc,
	getDocs,
	orderBy,
	query,
	serverTimestamp,
	setDoc,
	Timestamp,
	updateDoc,
} from 'firebase/firestore'
import { firebaseApp, firebaseConfig, firestoreDb } from './firebase'

export type UserRole = 'SUPER_ADMIN' | 'COMERCIAL'

export type UserProfileView = {
	uid: string
	email: string
	role: UserRole | null
	isActive: boolean
	createdBy?: string
	createdAt?: Date
	updatedAt?: Date
}

export type UserAccessState = 'AUTHORIZED' | 'UNAUTHORIZED' | 'PENDING_ACTIVATION'

export type UserAccessResult = {
	status: UserAccessState
	profile: UserProfileView | null
}

const USERS_COLLECTION = 'users'
const AUTO_SUPER_ADMIN_EMAIL = 'roberto@mistatas.com'

function normalizeRole(role: unknown): UserRole | null {
	const raw = String(role ?? '').trim().toUpperCase()
	if (raw === 'SUPER_ADMIN') return 'SUPER_ADMIN'
	if (raw === 'COMERCIAL') return 'COMERCIAL'
	if (raw === 'SUPERADMIN' || raw === 'ADMIN') return 'SUPER_ADMIN'
	if (raw === 'VENTAS' || raw === 'OPERACIONES') return 'COMERCIAL'
	if (raw === 'SUPER ADMIN' || raw === 'ROL SUPER ADMIN') return 'SUPER_ADMIN'
	if (raw === 'ROL COMERCIAL') return 'COMERCIAL'
	if (raw.includes('SUPER') && raw.includes('ADMIN')) return 'SUPER_ADMIN'
	if (raw.includes('COMERCIAL')) return 'COMERCIAL'
	return null
}

function toDate(value: unknown): Date | undefined {
	if (value instanceof Timestamp) return value.toDate()
	if (value instanceof Date) return value
	return undefined
}

function toProfile(uid: string, data: Record<string, unknown>): UserProfileView {
	const normalizedRole = normalizeRole(data.role)
	const isActive =
		typeof data.isActive === 'boolean'
			? data.isActive
			: typeof data.active === 'boolean'
				? data.active
				: false
	const email = String(data.email ?? '').trim().toLowerCase()

	return {
		uid,
		email,
		role: normalizedRole,
		isActive,
		createdBy: typeof data.createdBy === 'string' ? data.createdBy : undefined,
		createdAt: toDate(data.createdAt),
		updatedAt: toDate(data.updatedAt),
	}
}

async function createBootstrapSuperAdmin(uid: string, email: string) {
	const userRef = doc(collection(firestoreDb, USERS_COLLECTION), uid)
	await setDoc(userRef, {
		uid,
		email,
		role: 'SUPER_ADMIN',
		isActive: true,
		createdAt: serverTimestamp(),
		createdBy: 'system:auto-bootstrap',
		updatedAt: serverTimestamp(),
	})
}

async function createAuthUserWithoutSwitchingSession(email: string, password: string): Promise<string> {
	const secondaryName = `secondary-${Date.now()}-${Math.random().toString(36).slice(2)}`
	const secondaryApp = initializeApp(firebaseConfig, secondaryName)
	const secondaryAuth = getAuth(secondaryApp)
	try {
		const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password)
		return cred.user.uid
	} finally {
		await signOut(secondaryAuth).catch(() => undefined)
		await deleteApp(secondaryApp).catch(() => undefined)
	}
}

function mapCreateUserError(error: unknown): string {
	const firebaseCode = (error as FirebaseError | undefined)?.code
	if (!firebaseCode) return 'No se pudo crear el usuario en Auth. Revisa la configuración de Firebase.'

	switch (firebaseCode) {
		case 'auth/email-already-in-use':
			return 'El email ya está registrado en Firebase Auth.'
		case 'auth/invalid-email':
			return 'El email no tiene un formato válido.'
		case 'auth/weak-password':
			return 'La contraseña es demasiado débil. Usa al menos 6 caracteres.'
		case 'auth/operation-not-allowed':
			return 'Email/Password no está habilitado en Firebase Authentication.'
		case 'auth/admin-restricted-operation':
			return 'La operación fue restringida por la configuración del proyecto Firebase.'
		case 'auth/unauthorized-domain':
			return 'El dominio actual no está autorizado en Firebase Authentication.'
		case 'auth/invalid-app-credential':
			return 'Firebase rechazó la credencial de la app (posible reCAPTCHA/app verification).'
		case 'auth/network-request-failed':
			return 'Fallo de red al intentar crear el usuario en Firebase.'
		default:
			return `No se pudo crear el usuario en Auth (${firebaseCode}).`
	}
}

export const usersService = {
	getUserProfile: async (uid: string): Promise<UserProfileView | null> => {
		const ref = doc(collection(firestoreDb, USERS_COLLECTION), uid)
		const snap = await getDoc(ref)
		if (!snap.exists()) return null
		return toProfile(uid, snap.data() as Record<string, unknown>)
	},

	ensureUserAccess: async (input: { uid: string; email: string | null }): Promise<UserAccessResult> => {
		const email = String(input.email ?? '').trim().toLowerCase()
		if (!email) return { status: 'UNAUTHORIZED', profile: null }

		const ref = doc(collection(firestoreDb, USERS_COLLECTION), input.uid)
		let snap = await getDoc(ref)

		if (!snap.exists() && email === AUTO_SUPER_ADMIN_EMAIL) {
			await createBootstrapSuperAdmin(input.uid, email)
			snap = await getDoc(ref)
		}

		if (!snap.exists()) {
			return { status: 'UNAUTHORIZED', profile: null }
		}

		const profile = toProfile(input.uid, snap.data() as Record<string, unknown>)

		if (email === AUTO_SUPER_ADMIN_EMAIL) {
			const role = profile.role ?? 'SUPER_ADMIN'
			const isActive = true
			if (profile.role !== 'SUPER_ADMIN' || !profile.isActive || profile.email !== AUTO_SUPER_ADMIN_EMAIL) {
				await updateDoc(ref, {
					email: AUTO_SUPER_ADMIN_EMAIL,
					role,
					isActive,
					updatedAt: serverTimestamp(),
				}).catch(() => undefined)
			}
			return {
				status: 'AUTHORIZED',
				profile: {
					...profile,
					email: AUTO_SUPER_ADMIN_EMAIL,
					role: 'SUPER_ADMIN',
					isActive: true,
				},
			}
		}

		if (!profile.role) return { status: 'UNAUTHORIZED', profile }
		if (!profile.isActive) return { status: 'PENDING_ACTIVATION', profile }
		return { status: 'AUTHORIZED', profile }
	},

	listUsers: async (): Promise<UserProfileView[]> => {
		const q = query(collection(firestoreDb, USERS_COLLECTION), orderBy('email', 'asc'))
		const snap = await getDocs(q)
		return snap.docs.map((d) => toProfile(d.id, d.data() as Record<string, unknown>))
	},

	createUserWithProfile: async (input: {
		email: string
		password: string
		role: UserRole
		isActive: boolean
		createdBy: string
	}): Promise<UserProfileView> => {
		const normalizedEmail = input.email.trim().toLowerCase()
		let uid: string
		try {
			uid = await createAuthUserWithoutSwitchingSession(normalizedEmail, input.password)
		} catch (error) {
			throw new Error(mapCreateUserError(error))
		}
		await setDoc(doc(collection(firestoreDb, USERS_COLLECTION), uid), {
			uid,
			email: normalizedEmail,
			role: input.role,
			isActive: input.isActive,
			createdAt: serverTimestamp(),
			createdBy: input.createdBy,
			updatedAt: serverTimestamp(),
		})

		return {
			uid,
			email: normalizedEmail,
			role: input.role,
			isActive: input.isActive,
			createdBy: input.createdBy,
		}
	},

	updateUserActive: async (uid: string, isActive: boolean) => {
		await updateDoc(doc(collection(firestoreDb, USERS_COLLECTION), uid), {
			isActive,
			updatedAt: serverTimestamp(),
		})
	},

	appName: firebaseApp.name,
}
