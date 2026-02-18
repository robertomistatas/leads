import { useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { usersService, type UserProfileView, type UserRole } from '../services/users.service'

export function useUserProfile() {
	const { user } = useAuth()
	const [profile, setProfile] = useState<UserProfileView | null>(null)
	const [loading, setLoading] = useState(Boolean(user))

	useEffect(() => {
		let alive = true
		if (!user) {
			setProfile(null)
			setLoading(false)
			return
		}

		setLoading(true)
		void usersService
			.getUserProfile(user.uid)
			.then((p) => {
				if (!alive) return
				setProfile(p)
				setLoading(false)
			})
			.catch(() => {
				if (!alive) return
				setProfile({ uid: user.uid, role: 'unknown' })
				setLoading(false)
			})

		return () => {
			alive = false
		}
	}, [user])

	const role: UserRole | null = profile?.role ?? null
	const canAccessPaidSales =
		role === 'superadmin' || role === 'admin' || role === 'administracion' || role === 'finanzas'

	return { profile, role, canAccessPaidSales, loading }
}
