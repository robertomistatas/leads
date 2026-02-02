import { jsPDF } from 'jspdf'
import type { ExecutiveReport } from '../models/ExecutiveReport'

export type ExecutivePdfVariant = 'summary' | 'detailed'

async function fetchAsDataUrl(url: string): Promise<string> {
	const res = await fetch(url)
	if (!res.ok) throw new Error('logo_fetch_failed')
	const blob = await res.blob()
	return await new Promise<string>((resolve, reject) => {
		const reader = new FileReader()
		reader.onerror = () => reject(new Error('logo_read_failed'))
		reader.onload = () => resolve(String(reader.result))
		reader.readAsDataURL(blob)
	})
}

function clamp(value: number, min: number, max: number) {
	return Math.max(min, Math.min(max, value))
}

function formatDate(d: Date) {
	return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' })
}

function formatDateTime(d: Date) {
	return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function toNarrativeBlockedReason(reason: string) {
	switch (reason) {
		case 'CONTRACT_NOT_SIGNED':
			return 'Contrato pendiente de firma'
		case 'PAYMENT_PENDING':
			return 'Pago pendiente'
		case 'BENEFICIARY_REQUIRED':
			return 'Falta registrar beneficiario'
		case 'INCOMPLETE_DATA':
			return 'Datos incompletos'
		default:
			return 'Bloqueo operativo'
	}
}

function saleStatusEs(status: string) {
	switch (status) {
		case 'lead':
			return 'Lead'
		case 'in_progress':
			return 'En progreso'
		case 'closed':
			return 'Cerrada'
		case 'archived':
			return 'Archivada'
		default:
			return 'Actualizada'
	}
}

export type ExecutiveNarrativeEvent = {
	label: string
	date: Date
	count: number
}

export function mapReportEventTypeToNarrative(type: string): { label: string; groupKey: string } | null {
	if (type.startsWith('COMMERCIAL.')) return null

	if (type.startsWith('CLIENT.')) {
		return { label: 'Datos del cliente registrados/actualizados', groupKey: 'client' }
	}

	if (type.startsWith('BENEFICIARY.')) {
		return { label: 'Beneficiario registrado/actualizado', groupKey: 'beneficiary' }
	}

	if (type === 'SALE.status') {
		return { label: 'Estado de la venta actualizado', groupKey: 'sale_status' }
	}

	if (type === 'SALE.plan' || type === 'SALE.modality' || type === 'SALE.serviceRegion') {
		return { label: 'Configuración del servicio actualizada', groupKey: 'sale_setup' }
	}

	if (type === 'SALE.paymentStatus') {
		return { label: 'Estado de pago actualizado', groupKey: 'payment_status' }
	}

	if (type.startsWith('STEP.')) {
		return { label: 'Avance en pasos operativos', groupKey: 'steps' }
	}

	if (type.startsWith('SALE.')) {
		return { label: 'Información de la venta actualizada', groupKey: 'sale_misc' }
	}

	return null
}

export function buildNarrativeTimeline(events: Array<{ type: string; date: Date }>): ExecutiveNarrativeEvent[] {
	const sorted = [...events].sort((a, b) => a.date.getTime() - b.date.getTime())
	const mapped = sorted
		.map((e) => {
			const m = mapReportEventTypeToNarrative(e.type)
			if (!m) return null
			return { ...e, label: m.label, groupKey: m.groupKey }
		})
		.filter((x): x is { type: string; date: Date; label: string; groupKey: string } => Boolean(x))

	const windowMs = 45 * 60 * 1000
	const out: ExecutiveNarrativeEvent[] = []

	for (const e of mapped) {
		const prev = out[out.length - 1]
		if (!prev) {
			out.push({ label: e.label, date: e.date, count: 1 })
			continue
		}

		if (prev.label === e.label && Math.abs(e.date.getTime() - prev.date.getTime()) <= windowMs) {
			prev.count += 1
			prev.date = e.date
			continue
		}

		out.push({ label: e.label, date: e.date, count: 1 })
	}

	return out
}

type PdfTheme = {
	accent: [number, number, number]
	text: [number, number, number]
	muted: [number, number, number]
	border: [number, number, number]
	bgSoft: [number, number, number]
}

const theme: PdfTheme = {
	accent: [15, 23, 42],
	text: [15, 23, 42],
	muted: [71, 85, 105],
	border: [226, 232, 240],
	bgSoft: [248, 250, 252],
}

export async function downloadExecutiveReportPdf(params: {
	report: ExecutiveReport
	variant: ExecutivePdfVariant
	logoUrl: string
	fileName?: string
}) {
	const { report, variant, logoUrl } = params

	const doc = new jsPDF({ unit: 'mm', format: 'a4' })
	const pageWidth = doc.internal.pageSize.getWidth()
	const pageHeight = doc.internal.pageSize.getHeight()

	const marginX = 16
	const marginY = 16
	const footerH = 10
	const headerH = 20
	const contentWidth = pageWidth - marginX * 2
	let y = marginY + headerH + 6

	const bottomLimit = () => pageHeight - marginY - footerH

	let headerLogoDataUrl: string | null = null

	function ensureSpace(nextHeight: number) {
		if (y + nextHeight <= bottomLimit()) return
		addPage()
	}

	function drawHeader(pageKind: 'cover' | 'body') {
		const x = marginX
		const top = marginY
		const logoW = 26
		const logoH = 10
		const titleX = x + logoW + 6
		const titleY = top + 7

		// Background line and spacing
		doc.setDrawColor(theme.border[0], theme.border[1], theme.border[2])
		doc.setLineWidth(0.3)
		doc.line(marginX, top + headerH, marginX + contentWidth, top + headerH)

		// Logo
		if (headerLogoDataUrl) {
			try {
				doc.addImage(headerLogoDataUrl, 'PNG', x, top + 4, logoW, logoH)
			} catch {
				// ignore
			}
		}

		setText(theme.text)
		doc.setFont('helvetica', 'bold')
		doc.setFontSize(pageKind === 'cover' ? 16 : 12)
		doc.text('Informe Ejecutivo', titleX, titleY)

		setText(theme.muted)
		doc.setFont('helvetica', 'normal')
		doc.setFontSize(9)
		const rangeText = `Rango: ${formatDate(report.range.from)} - ${formatDate(report.range.to)}`
		const issuedAt = `Emitido: ${formatDateTime(new Date())}`
		doc.text(rangeText, titleX, titleY + 5)
		if (pageKind === 'cover') doc.text(issuedAt, titleX, titleY + 9)
	}

	function addPage() {
		doc.addPage()
		drawHeader('body')
		y = marginY + headerH + 8
	}

	function setText(color: [number, number, number]) {
		doc.setTextColor(color[0], color[1], color[2])
	}

	function sectionTitle(text: string) {
		ensureSpace(12)
		setText(theme.text)
		doc.setFont('helvetica', 'bold')
		doc.setFontSize(12)
		doc.text(text, marginX, y)
		y += 7
	}

	function smallMuted(text: string) {
		setText(theme.muted)
		doc.setFont('helvetica', 'normal')
		doc.setFontSize(9)
		doc.text(text, marginX, y)
		y += 5
	}

	function paragraph(text: string) {
		setText(theme.text)
		doc.setFont('helvetica', 'normal')
		doc.setFontSize(10)
		const lines = doc.splitTextToSize(text, contentWidth)
		ensureSpace(lines.length * 5 + 3)
		doc.text(lines, marginX, y)
		y += lines.length * 5 + 3
	}

	function kpiRow(items: Array<{ label: string; value: string }>) {
		const cols = clamp(items.length, 1, 4)
		const gap = 4
		const cardW = (contentWidth - gap * (cols - 1)) / cols
		const cardH = 20
		ensureSpace(cardH + 4)

		items.slice(0, cols).forEach((it, idx) => {
			const x = marginX + idx * (cardW + gap)
			doc.setDrawColor(theme.border[0], theme.border[1], theme.border[2])
			doc.setFillColor(theme.bgSoft[0], theme.bgSoft[1], theme.bgSoft[2])
			doc.roundedRect(x, y, cardW, cardH, 2, 2, 'FD')

			setText(theme.muted)
			doc.setFont('helvetica', 'normal')
			doc.setFontSize(8)
			doc.text(it.label, x + 3, y + 6)

			setText(theme.text)
			doc.setFont('helvetica', 'bold')
			doc.setFontSize(16)
			doc.text(it.value, x + 3, y + 15)
		})

		y += cardH + 6
	}

	// Load logo and draw cover header.
	try {
		headerLogoDataUrl = await fetchAsDataUrl(logoUrl)
	} catch {
		headerLogoDataUrl = null
	}

	drawHeader('cover')
	y = marginY + headerH + 10

	// Executive summary
	sectionTitle('Resumen ejecutivo')

	const dropPct = Math.round(report.summary.leadsDropRate * 100)
	paragraph(
		`En el período seleccionado se generaron ${report.summary.leadsCreated} leads. De ellos, ${report.summary.leadsDropped} se cayeron (${dropPct}%). ` +
			`Se ingresaron ${report.summary.salesCreated} ventas, se cerraron ${report.summary.salesClosed} y quedaron ${report.summary.salesBlocked} trabadas al cierre del período.`,
	)

	kpiRow([
		{ label: 'Leads creados', value: String(report.summary.leadsCreated) },
		{ label: 'Leads caídos', value: String(report.summary.leadsDropped) },
		{ label: 'Ventas ingresadas', value: String(report.summary.salesCreated) },
		{ label: 'Ventas cerradas', value: String(report.summary.salesClosed) },
	])

	sectionTitle('Funnel')
	smallMuted('Leads - Ventas - Cerradas')
	kpiRow([
		{ label: 'Leads', value: String(report.funnel.leads) },
		{ label: 'Ventas', value: String(report.funnel.sales) },
		{ label: 'Cerradas', value: String(report.funnel.closed) },
	])

	sectionTitle('Ventas trabadas (diagnóstico)')
	paragraph(
		`Total de ventas trabadas al cierre del período: ${report.blockedSales.total}. A continuación, principales causas y su duración promedio.`,
	)

	const blockedRows = report.blockedSales.reasons
		.filter((r) => r.count > 0)
		.sort((a, b) => b.count - a.count)

	if (blockedRows.length === 0) {
		paragraph('No se registran ventas trabadas en el período.')
	} else {
		for (const r of blockedRows) {
			ensureSpace(8)
			setText(theme.text)
			doc.setFont('helvetica', 'bold')
			doc.setFontSize(10)
			doc.text(`${toNarrativeBlockedReason(r.reason)}: ${r.count}`, marginX, y)
			y += 5
			setText(theme.muted)
			doc.setFont('helvetica', 'normal')
			doc.setFontSize(9)
			doc.text(`Promedio: ${Math.round(r.averageDaysBlocked * 10) / 10} días`, marginX, y)
			y += 6
		}
	}

	if (variant === 'detailed') {
		addPage()

		sectionTitle('Detalle por venta')
		smallMuted('Incluye estado, bloqueo (si aplica) y un timeline narrativo de hitos relevantes.')

		const items = [...report.salesTimeline]
		items.sort((a, b) => {
			const aFirst = a.events[0]?.date?.getTime() ?? Number.MAX_SAFE_INTEGER
			const bFirst = b.events[0]?.date?.getTime() ?? Number.MAX_SAFE_INTEGER
			return aFirst - bFirst
		})

		for (const sale of items) {
			// Prepare narrative and reserve space so we don't cut the sale header in half.
			const narrative = buildNarrativeTimeline(sale.events)
			const maxHitos = 8
			const show = narrative.slice(0, maxHitos)
			const remaining = Math.max(0, narrative.length - show.length)

			const estimatedLines = show.length === 0 ? 1 : show.length
			const estimatedHeight = 22 + estimatedLines * 6 + (remaining > 0 ? 6 : 0)
			ensureSpace(estimatedHeight)

			setText(theme.text)
			doc.setFont('helvetica', 'bold')
			doc.setFontSize(12)
			doc.text(`Venta #${sale.saleId}`, marginX, y)
			y += 6

			setText(theme.muted)
			doc.setFont('helvetica', 'normal')
			doc.setFontSize(10)
			doc.text(`Cliente: ${sale.customerName || '—'}`, marginX, y)
			y += 5
			doc.text(`Estado actual: ${saleStatusEs(String(sale.currentStatus))}`, marginX, y)
			y += 5
			if (sale.blockedReason) {
				doc.text(`Motivo: ${toNarrativeBlockedReason(sale.blockedReason)}`, marginX, y)
				y += 5
			}
			if (show.length === 0) {
				setText(theme.muted)
				doc.setFontSize(9)
				doc.text('Sin eventos relevantes en el rango.', marginX, y)
				y += 6
			} else {
				for (const e of show) {
					const label = e.count > 1 ? `${e.label} (${e.count})` : e.label
					const line = `• ${label} — ${formatDateTime(e.date)}`
					const lines = doc.splitTextToSize(line, contentWidth)
					ensureSpace(lines.length * 4 + 3)
					setText(theme.text)
					doc.setFont('helvetica', 'normal')
					doc.setFontSize(9)
					doc.text(lines, marginX, y)
					y += lines.length * 4 + 3
				}

				if (remaining > 0) {
					ensureSpace(6)
					setText(theme.muted)
					doc.setFont('helvetica', 'normal')
					doc.setFontSize(9)
					doc.text(`• y ${remaining} eventos más`, marginX, y)
					y += 6
				}
			}

			y += 4
			doc.setDrawColor(theme.border[0], theme.border[1], theme.border[2])
			doc.line(marginX, y, marginX + contentWidth, y)
			y += 8
		}
	}

	const fileName =
		params.fileName ??
		`informe-ejecutivo-${variant}-${report.range.from.toISOString().slice(0, 10)}_${report.range.to.toISOString().slice(0, 10)}.pdf`

	// Footer pagination (Página X de N)
	const totalPages = doc.getNumberOfPages()
	for (let p = 1; p <= totalPages; p += 1) {
		doc.setPage(p)
		setText(theme.muted)
		doc.setFont('helvetica', 'normal')
		doc.setFontSize(9)
		doc.text(`Página ${p} de ${totalPages}`, pageWidth - marginX, pageHeight - marginY + 6, { align: 'right' })
	}

	doc.save(fileName)
}
