import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getAnalytics, isSupported } from 'firebase/analytics'

// NOTE: This is a client-side app (GitHub Pages). Firebase web config is not a secret.
// Security must be enforced with Firebase Auth + Firestore Security Rules.
const defaultFirebaseConfig = {
  apiKey: 'AIzaSyCpkmpdv75fO1CVuhwGq96h2ruVI2yZJFU',
  authDomain: 'leads-3b5e9.firebaseapp.com',
  projectId: 'leads-3b5e9',
  storageBucket: 'leads-3b5e9.firebasestorage.app',
  messagingSenderId: '933705139114',
  appId: '1:933705139114:web:67f648cb32077fb2c6e1d3',
  measurementId: 'G-2BFX3BN8PK',
}

export const firebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY as string | undefined) ?? defaultFirebaseConfig.apiKey,
  authDomain:
    (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined) ?? defaultFirebaseConfig.authDomain,
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined) ?? defaultFirebaseConfig.projectId,
  storageBucket:
    (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined) ?? defaultFirebaseConfig.storageBucket,
  messagingSenderId:
    (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined) ??
    defaultFirebaseConfig.messagingSenderId,
  appId: (import.meta.env.VITE_FIREBASE_APP_ID as string | undefined) ?? defaultFirebaseConfig.appId,
  measurementId:
    (import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string | undefined) ??
    defaultFirebaseConfig.measurementId,
}

// Firebase throws confusing errors when config is missing; fail fast.
if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId || !firebaseConfig.appId) {
  // eslint-disable-next-line no-console
  console.warn(
    '[firebase] Missing VITE_FIREBASE_* env vars. Auth/Firestore will not work until configured.',
  )
}

export const firebaseApp = initializeApp(firebaseConfig)
export const firebaseAuth = getAuth(firebaseApp)
export const firestoreDb = getFirestore(firebaseApp)

// Optional: Analytics (won't block app if unsupported or not configured)
export async function initAnalytics() {
  if (!firebaseConfig.measurementId) return null
  if (!(await isSupported())) return null
  return getAnalytics(firebaseApp)
}
