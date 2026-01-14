export type ControlledRegion = 'SANTIAGO' | 'VALPARAISO' | 'REGIONES'

function normalizeRaw(input: string) {
	return input
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.trim()
		.toLowerCase()
}

export function toControlledRegion(input: string | undefined | null): ControlledRegion | undefined {
	if (input === undefined || input === null) return undefined
	const raw = normalizeRaw(String(input))
	if (raw.length === 0) return undefined
	if (raw.includes('santiago') || raw.includes('stgo')) return 'SANTIAGO'
	if (raw.includes('valparaiso') || raw.includes('valpo') || raw.includes('v region')) return 'VALPARAISO'
	return 'REGIONES'
}
