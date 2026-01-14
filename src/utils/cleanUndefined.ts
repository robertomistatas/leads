export function cleanUndefined<T>(value: T): T {
	return _clean(value) as T
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (!value || typeof value !== 'object') return false
	const proto = Object.getPrototypeOf(value)
	return proto === Object.prototype || proto === null
}

function _clean(value: unknown): unknown {
	if (value === undefined) return undefined
	if (Array.isArray(value)) {
		const items = value
			.map((v) => _clean(v))
			.filter((v) => v !== undefined)
		return items
	}
	if (isPlainObject(value)) {
		const out: Record<string, unknown> = {}
		for (const [k, v] of Object.entries(value)) {
			const cleaned = _clean(v)
			if (cleaned === undefined) continue
			out[k] = cleaned
		}
		return out
	}
	// Preserve non-plain objects (Date, Firestore FieldValue, etc.)
	return value
}
