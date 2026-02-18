import { jsPDF } from 'jspdf'
import type { PaidSaleView } from '../models/PaidSale'
import { paidSaleBadgeLabel } from './paidSales'
import { formatClp } from './currency'

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

function formatDateDmy(d: Date): string {
	const dd = String(d.getDate()).padStart(2, '0')
	const mm = String(d.getMonth() + 1).padStart(2, '0')
	const yyyy = String(d.getFullYear())
	return `${dd}-${mm}-${yyyy}`
}

function formatDateTimeDmyHm(d: Date): string {
	const hh = String(d.getHours()).padStart(2, '0')
	const min = String(d.getMinutes()).padStart(2, '0')
	return `${formatDateDmy(d)} ${hh}:${min}`
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

export async function downloadPaidSalesPdf(params: {
	sales: PaidSaleView[]
	logoUrl: string
	generatedAt?: Date
	fileName?: string
}) {
	const { sales, logoUrl } = params
	const generatedAt = params.generatedAt ?? new Date()

	const totals = sales.reduce(
		(acc, s) => {
			if (s.amount.period === 'ANNUAL') acc.annual += s.amount.value
			else acc.monthly += s.amount.value
			return acc
		},
		{ annual: 0, monthly: 0 },
	)

	const doc = new jsPDF({ unit: 'mm', format: 'a4' })
	const pageWidth = doc.internal.pageSize.getWidth()
	const pageHeight = doc.internal.pageSize.getHeight()

	// Page container (consistent margins)
	const marginX = 18
	const marginY = 16
	const footerH = 12
	const headerH = 24
	const contentWidth = pageWidth - marginX * 2
	let y = marginY + headerH + 6

	const bottomLimit = () => pageHeight - marginY - footerH
	const ensureSpace = (nextHeight: number) => {
		if (y + nextHeight <= bottomLimit()) return
		addPage()
	}

	let headerLogoDataUrl: string | null = null
	try {
		headerLogoDataUrl = await fetchAsDataUrl(logoUrl)
	} catch {
		headerLogoDataUrl = null
	}

	function setText(color: [number, number, number]) {
		doc.setTextColor(color[0], color[1], color[2])
	}

	function drawHeader(_kind: 'cover' | 'body') {
		const x = marginX
		const top = marginY
		const logoW = 28
		const logoH = 11
		const titleX = x + logoW + 6
		const titleY = top + 7

		// Divider
		doc.setDrawColor(theme.border[0], theme.border[1], theme.border[2])
		doc.setLineWidth(0.3)
		doc.line(marginX, top + headerH, marginX + contentWidth, top + headerH)

		// Logo
		if (headerLogoDataUrl) {
			try {
				doc.addImage(headerLogoDataUrl, 'PNG', x, top + 5, logoW, logoH)
			} catch {
				// ignore
			}
		}

		// Title + subtitle
		setText(theme.text)
		doc.setFont('helvetica', 'bold')
		doc.setFontSize(14)
		doc.text('Informe de Ventas Pagadas', titleX, titleY)

		setText(theme.muted)
		doc.setFont('helvetica', 'normal')
		doc.setFontSize(9)
		doc.text('Área: Contabilidad / Finanzas', titleX, titleY + 5)

		// Generated at (right aligned)
		const rightX = marginX + contentWidth
		setText(theme.muted)
		doc.setFont('helvetica', 'normal')
		doc.setFontSize(9)
		doc.text(`Generado: ${formatDateTimeDmyHm(generatedAt)}`, rightX, titleY, { align: 'right' })
	}

	function addPage() {
		doc.addPage()
		drawHeader('body')
		y = marginY + headerH + 8
	}

	function h2(text: string) {
		ensureSpace(10)
		setText(theme.text)
		doc.setFont('helvetica', 'bold')
		doc.setFontSize(12)
		doc.text(text, marginX, y)
		y += 7
	}

	function kpiRow(items: Array<{ label: string; value: string }>) {
		const cols = Math.min(3, Math.max(1, items.length))
		const gap = 4
		const cardW = (contentWidth - gap * (cols - 1)) / cols
		const cardH = 20
		ensureSpace(cardH + 6)

		items.slice(0, cols).forEach((it, idx) => {
			const x = marginX + idx * (cardW + gap)
			doc.setDrawColor(theme.border[0], theme.border[1], theme.border[2])
			doc.setFillColor(theme.bgSoft[0], theme.bgSoft[1], theme.bgSoft[2])
			doc.roundedRect(x, y, cardW, cardH, 2, 2, 'FD')

			setText(theme.muted)
			doc.setFont('helvetica', 'normal')
			doc.setFontSize(8.5)
			doc.text(it.label, x + 4, y + 7)

			setText(theme.text)
			doc.setFont('helvetica', 'bold')
			doc.setFontSize(12)
			doc.text(it.value, x + 4, y + 15)
		})

		y += cardH + 8
	}


	function paragraphAt(text: string, x: number, width: number) {
		setText(theme.text)
		doc.setFont('helvetica', 'normal')
		doc.setFontSize(10)
		const lines = doc.splitTextToSize(text, width)
		ensureSpace(lines.length * 5 + 2)
		doc.text(lines, x, y)
		y += lines.length * 5 + 2
	}

	function infoLineAt(text: string, x: number, width: number) {
		setText(theme.text)
		doc.setFont('helvetica', 'normal')
		doc.setFontSize(10)
		const lines = doc.splitTextToSize(text, width)
		ensureSpace(lines.length * 5 + 1)
		doc.text(lines, x, y)
		y += Math.max(5, lines.length * 5)
	}

	// First page
	drawHeader('cover')
	y = marginY + headerH + 10

	h2('Resumen ejecutivo')
	kpiRow([
		{ label: 'Total de ventas incluidas', value: String(sales.length) },
		{ label: 'Total anual visible', value: `${formatClp(totals.annual)} CLP` },
		{ label: 'Total mensual visible', value: `${formatClp(totals.monthly)} CLP` },
	])

	// Aire antes de listado
	y += 2
	h2('Ventas')

	for (const s of sales) {
		const cardPadding = 7
		const cardGap = 6
		const cardX = marginX
		const cardY = y
		const cardW = contentWidth
		const innerX = cardX + cardPadding
		const innerW = cardW - cardPadding * 2

		// Pre-measure to draw the card once (prevents border redraw glitches)
		doc.setFont('helvetica', 'bold')
		doc.setFontSize(12)
		const nameLines = doc.splitTextToSize(s.client.full_name || 'Cliente', innerW)
		doc.setFont('helvetica', 'normal')
		doc.setFontSize(9)
		const modalityLines = doc.splitTextToSize(paidSaleBadgeLabel(s.billing_model), innerW)
		doc.setFont('helvetica', 'bold')
		doc.setFontSize(11)
		const amountLabel = s.amount.period === 'ANNUAL' ? 'Monto anual' : 'Monto mensual'
		const amountLines = doc.splitTextToSize(`${amountLabel}: ${formatClp(s.amount.value)} CLP`, innerW)
		doc.setFont('helvetica', 'normal')
		doc.setFontSize(10)
		const paidAtLines = doc.splitTextToSize(`Pagado el: ${formatDateDmy(s.paid_at)}`, innerW)
		const rutLines = doc.splitTextToSize(`RUT: ${s.client.rut || '—'}`, innerW)
		const phoneLines = doc.splitTextToSize(`Teléfono: ${s.client.phone || '—'}`, innerW)
		const emailLines = doc.splitTextToSize(`Correo: ${s.client.email || '—'}`, innerW)
		const addrLines = doc.splitTextToSize(`Dirección: ${s.client.address || '—'}`, innerW)
		const serviceLines = doc.splitTextToSize(`Servicio: ${s.service.plan_name || '—'}`, innerW)

		const lineH = 5
		const cardH =
			cardPadding +
			2 +
			nameLines.length * lineH +
			1 +
			modalityLines.length * lineH +
			2 +
			amountLines.length * lineH +
			1 +
			paidAtLines.length * lineH +
			8 +
			lineH +
			2 +
			rutLines.length * lineH +
			phoneLines.length * lineH +
			emailLines.length * lineH +
			addrLines.length * lineH +
			6 +
			lineH +
			2 +
			serviceLines.length * lineH +
			cardPadding

		ensureSpace(cardH + cardGap)

		// Card (single block)
		doc.setDrawColor(theme.border[0], theme.border[1], theme.border[2])
		doc.setLineWidth(0.25)
		doc.setFillColor(255, 255, 255)
		doc.roundedRect(cardX, cardY, cardW, cardH, 2, 2, 'FD')

		let cy = cardY + cardPadding + 2

		// Client name
		setText(theme.text)
		doc.setFont('helvetica', 'bold')
		doc.setFontSize(12)
		doc.text(nameLines, innerX, cy)
		cy += nameLines.length * lineH + 1

		// Modality (secondary)
		setText(theme.muted)
		doc.setFont('helvetica', 'normal')
		doc.setFontSize(9)
		doc.text(modalityLines, innerX, cy)
		cy += modalityLines.length * lineH + 2

		// Amount + date
		setText(theme.text)
		doc.setFont('helvetica', 'bold')
		doc.setFontSize(11)
		doc.text(amountLines, innerX, cy)
		cy += amountLines.length * lineH + 1
		setText(theme.text)
		doc.setFont('helvetica', 'normal')
		doc.setFontSize(10)
		doc.text(paidAtLines, innerX, cy)
		cy += paidAtLines.length * lineH + 8

		// Sections (no internal lines; only air)
		setText(theme.text)
		doc.setFont('helvetica', 'bold')
		doc.setFontSize(10)
		doc.text('Datos del cliente', innerX, cy)
		cy += lineH + 2
		y = cy
		infoLineAt(`RUT: ${s.client.rut || '—'}`, innerX, innerW)
		infoLineAt(`Teléfono: ${s.client.phone || '—'}`, innerX, innerW)
		infoLineAt(`Correo: ${s.client.email || '—'}`, innerX, innerW)
		infoLineAt(`Dirección: ${s.client.address || '—'}`, innerX, innerW)
		y += 6

		setText(theme.text)
		doc.setFont('helvetica', 'bold')
		doc.setFontSize(10)
		doc.text('Servicio contratado', innerX, y)
		y += lineH + 2
		paragraphAt(`Servicio: ${s.service.plan_name || '—'}`, innerX, innerW)

		y = cardY + cardH + cardGap
	}

	// Footer page numbers
	const pageCount = doc.getNumberOfPages()
	for (let i = 1; i <= pageCount; i++) {
		doc.setPage(i)
		// Slightly lighter footer
		doc.setTextColor(148, 163, 184)
		doc.setFont('helvetica', 'normal')
		doc.setFontSize(7.5)
		const footerY = pageHeight - marginY
		const footerText = 'Documento interno generado por el sistema MisTatas para fines administrativos y contables.'
		doc.text(footerText, pageWidth / 2, footerY, { align: 'center' })
		// Keep discreet page number on the right without adding new info.
		doc.text(`${i}/${pageCount}`, marginX + contentWidth, footerY, { align: 'right' })
	}

	doc.save(params.fileName ?? `ventas-pagadas_${formatDateDmy(generatedAt)}.pdf`)
}
