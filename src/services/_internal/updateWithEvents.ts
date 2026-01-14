import { updateDoc, type DocumentReference, type UpdateData } from 'firebase/firestore'
import { cleanUndefined } from '../../utils/cleanUndefined'
import { eventsService } from '../events.service'
import type { EventEntity } from '../../models/Event'

/**
 * Low-level helper to:
 * - Detect real field-by-field changes from a partial patch
 * - Perform a single Firestore update with only changed fields (cleanUndefined)
 * - Emit one audit event per changed field
 */
export async function updateWithEvents<T extends Record<string, any>>(params: {
	entity: 'SALE' | 'CLIENT' | 'BENEFICIARY' | 'COMMERCIAL' | 'STEP'
	docRef: DocumentReference<T>
	current: T
	patch: Partial<T>
	actorUserId: string
	saleId?: string
	fieldMap?: Partial<Record<keyof T, string>>
}): Promise<void> {
	const { entity, docRef, current, patch, actorUserId, fieldMap } = params

	// IMPORTANT: `saleId` is required for audit events.
	// This helper never tries to infer it; callers must pass it explicitly.
	// If not provided, we still perform the Firestore update but emit no events.
	const saleId = params.saleId

	// 1) Detect real changes: only fields present in `patch`, non-undefined, and != current.
	const changedPatch: Partial<T> = {}
	const changedFields: Array<keyof T> = []

	for (const field of Object.keys(patch) as Array<keyof T>) {
		const nextValue = patch[field]
		if (nextValue === undefined) continue

		const prevValue = current[field]
		if (Object.is(prevValue, nextValue)) continue

		changedPatch[field] = nextValue
		changedFields.push(field)
	}

	// 4) If no real changes, exit silently: no write, no events.
	if (changedFields.length === 0) return

	// 3) Single Firestore update, only changed fields, with undefined stripped.
	// Firebase v12 types distinguish between AppModel and DbModel types.
	// This helper accepts `DocumentReference<T>` as requested, so we perform a safe
	// cast for the update payload to keep strict mode happy without affecting runtime.
	await updateDoc(
		docRef as unknown as DocumentReference<Record<string, unknown>, Record<string, unknown>>,
		cleanUndefined(changedPatch as Record<string, unknown>) as UpdateData<Record<string, unknown>>,
	)

	// 2) Emit one event per changed field.
	// Only emit when `saleId` is provided (events schema requires it).
	if (!saleId) return

	for (const field of changedFields) {
		const prevValue = current[field]
		const nextValue = changedPatch[field]

		await eventsService.createEvent({
			saleId,
			userId: actorUserId,
			entity: entity as EventEntity,
			field: fieldMap?.[field] ?? String(field),
			previousValue: prevValue === undefined ? undefined : String(prevValue),
			newValue: nextValue === undefined ? undefined : String(nextValue),
		})
	}
}
