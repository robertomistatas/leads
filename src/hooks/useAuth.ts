import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { authService } from '../services/auth.service'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    const unsub = authService.onAuthStateChanged((next) => {
      setUser(next)
      setInitializing(false)
    })
    return () => unsub()
  }, [])

  return { user, initializing }
}
