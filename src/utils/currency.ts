const clpFormatter = new Intl.NumberFormat('es-CL', {
	style: 'currency',
	currency: 'CLP',
	maximumFractionDigits: 0,
})

export function formatClp(value: number | undefined | null): string {
	if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
	return clpFormatter.format(value)
}
