import { useAuth } from './useAuth'
import type { UserRole } from '../services/users.service'

export function useUserProfile() {
	const { user, role, isSuperAdmin, isComercial, initializing, isActive } = useAuth()
	const canAccessPaidSales = Boolean(user)

	return {
		profile: user ? { uid: user.uid, role: role as UserRole | null } : null,
		role,
		isSuperAdmin,
		isComercial,
		isActive,
		canAccessPaidSales,
		loading: initializing,
	}
}
