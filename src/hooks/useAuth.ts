import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { User } from 'firebase/auth'
import { authService } from '../services/auth.service'
import { usersService, type UserAccessState, type UserRole } from '../services/users.service'

type AuthState = {
  user: User | null
  initializing: boolean
  role: UserRole | null
  isSuperAdmin: boolean
  isComercial: boolean
  isActive: boolean
  accessState: UserAccessState | 'SIGNED_OUT'
}

const AuthContext = createContext<AuthState | null>(null)

const DEFAULT_AUTH_STATE: AuthState = {
  user: null,
  initializing: true,
  role: null,
  isSuperAdmin: false,
  isComercial: false,
  isActive: false,
  accessState: 'SIGNED_OUT',
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(DEFAULT_AUTH_STATE)

  useEffect(() => {
    let seq = 0
    const unsub = authService.onAuthStateChanged((next) => {
      seq += 1
      const current = seq

      if (!next) {
        setState({
          user: null,
          initializing: false,
          role: null,
          isSuperAdmin: false,
          isComercial: false,
          isActive: false,
          accessState: 'SIGNED_OUT',
        })
        return
      }

      setState((prev) => ({
        ...prev,
        user: next,
        initializing: true,
      }))

      void usersService
        .ensureUserAccess({ uid: next.uid, email: next.email })
        .then((result) => {
          if (current !== seq) return
          const role = result.profile?.role ?? null
          const isActive = result.profile?.isActive ?? false
          setState({
            user: next,
            initializing: false,
            role,
            isSuperAdmin: role === 'SUPER_ADMIN',
            isComercial: role === 'COMERCIAL',
            isActive,
            accessState: result.status,
          })
        })
        .catch(() => {
          if (current !== seq) return
          setState({
            user: next,
            initializing: false,
            role: null,
            isSuperAdmin: false,
            isComercial: false,
            isActive: false,
            accessState: 'UNAUTHORIZED',
          })
        })
    })
    return () => {
      seq += 1
      unsub()
    }
  }, [])

  const value = useMemo(() => state, [state])

  return createElement(AuthContext.Provider, { value }, children)
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return ctx
}
