import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { firebaseAuth } from './firebase'

export const authService = {
  onAuthStateChanged: (cb: (user: User | null) => void) => onAuthStateChanged(firebaseAuth, cb),

  signInWithEmailAndPassword: async (email: string, password: string) => {
    return await signInWithEmailAndPassword(firebaseAuth, email, password)
  },

  signOut: async () => {
    await signOut(firebaseAuth)
  },
}
