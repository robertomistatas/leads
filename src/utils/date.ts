export function nowIso() {
  return new Date().toISOString()
}

// Firestore helpers
import { Timestamp } from 'firebase/firestore'

export function coerceToDate(value: unknown): Date | undefined {
  if (!value) return undefined
  if (value instanceof Date) return value
  if (value instanceof Timestamp) return value.toDate()
  return undefined
}

