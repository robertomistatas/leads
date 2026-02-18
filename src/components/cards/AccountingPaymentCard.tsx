import { useEffect, useMemo, useState } from 'react'
import { Timestamp, serverTimestamp } from 'firebase/firestore'
import type { SaleView } from '../../services/sales.service'
import { salesService } from '../../services/sales.service'
import { useAlerts } from '../../hooks/useAlerts'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader } from '../ui/card'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { formatClp } from '../../utils/currency'

type PaymentStatus = 'PENDING' | 'PAID'

type BillingModel = 'ANNUAL_CC' | 'MONTHLY'

type Provider = 'FLOW' | 'TRANSFER' | 'CASH' | 'OTHER'

function toDateInputValue(d: Date | undefined) {
	if (!d) return ''
	const yyyy = d.getFullYear()
	const mm = String(d.getMonth() + 1).padStart(2, '0')
	const dd = String(d.getDate()).padStart(2, '0')
	return `${yyyy}-${mm}-${dd}`
}

function fromDateInputValue(value: string): Date | undefined {
	if (!value) return undefined
	const [y, m, d] = value.split('-').map(Number)
	if (!y || !m || !d) return undefined
	const dt = new Date(y, m - 1, d)
	return Number.isFinite(dt.getTime()) ? dt : undefined
}

function toBillingHelper(model: BillingModel | '') {
	if (model === 'ANNUAL_CC') return 'Helper: se usará como monto anual.'
	if (model === 'MONTHLY') return 'Helper: se usará como monto mensual.'
	return 'Selecciona un modelo de cobro/facturación.'
}

type Props = {
	sale: SaleView
	saleId: string
	actorUserId: string
}

export function AccountingPaymentCard({ sale, saleId, actorUserId }: Props) {
	const alerts = useAlerts()
	const [saving, setSaving] = useState(false)

	const initial = useMemo(() => {
		const p = (sale as any).payment as any | undefined
		const status: PaymentStatus = p?.status === 'PAID' ? 'PAID' : 'PENDING'
		const billing_model: BillingModel | '' = p?.billing_model === 'ANNUAL_CC' || p?.billing_model === 'MONTHLY' ? p.billing_model : ''
		const provider: Provider | '' =
			p?.provider === 'FLOW' || p?.provider === 'TRANSFER' || p?.provider === 'CASH' || p?.provider === 'OTHER'
				? p.provider
				: ''
		const paidAt: Date | undefined = p?.paid_at?.toDate ? p.paid_at.toDate() : undefined
		return {
			status,
			billing_model,
			amount_paid: typeof p?.amount_paid === 'number' ? p.amount_paid : 0,
			provider,
			paid_at: paidAt,
			notes: typeof p?.notes === 'string' ? p.notes : '',
		}
	}, [sale])

	const [form, setForm] = useState(initial)

	useEffect(() => {
		setForm(initial)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [saleId])

	const isPaid = form.status === 'PAID'
	const missingRequired = isPaid
		? {
			billing_model: !form.billing_model,
			amount_paid: !(Number(form.amount_paid) > 0),
			provider: !form.provider,
			paid_at: !form.paid_at,
		}
		: null

	async function onSave() {
		if (isPaid) {
			if (!form.billing_model || !form.provider || !form.paid_at || !(Number(form.amount_paid) > 0)) {
				alerts.error('Completa los campos obligatorios para marcar como Pagado.')
				return
			}
		}

		try {
			setSaving(true)

			const paymentPatch: any = {
				status: form.status,
				billing_model: form.billing_model || undefined,
				amount_paid: Number(form.amount_paid ?? 0) || 0,
				currency: 'CLP',
				paid_at: form.paid_at ? Timestamp.fromDate(form.paid_at) : undefined,
				provider: form.provider || undefined,
				notes: String(form.notes ?? '').trim() || undefined,
				updated_at: serverTimestamp(),
				updated_by: actorUserId,
			}

			await salesService.updateSaleAccountingPayment({ saleId, actorUserId, payment: paymentPatch })
			alerts.success('Pago registrado guardado')
		} catch {
			alerts.error('No se pudo guardar el pago registrado')
		} finally {
			setSaving(false)
		}
	}

	return (
		<Card>
			<CardHeader className="p-4">
				<div className="flex items-center justify-between gap-3">
					<div>
						<div className="text-sm font-semibold">Pago registrado (contabilidad)</div>
						<div className="text-xs text-slate-500">Hecho contable (fuente de verdad) · No reemplaza mensualidad/plan</div>
					</div>
					<Button variant="secondary" disabled={saving} onClick={onSave}>
						{saving ? 'Guardando…' : 'Guardar'}
					</Button>
				</div>
			</CardHeader>
			<CardContent className="p-4">
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<div className="space-y-2">
						<Label>Estado de pago</Label>
						<select
							className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
							value={form.status}
							onChange={(e) => setForm((s) => ({ ...s, status: e.target.value as PaymentStatus }))}
						>
							<option value="PENDING">Pendiente</option>
							<option value="PAID">Pagado</option>
						</select>
					</div>

					<div className="space-y-2">
						<Label>Modelo de cobro/facturación</Label>
						<select
							className={
								'h-10 w-full rounded-xl border bg-white px-3 text-sm text-slate-900 ' +
								(missingRequired?.billing_model ? 'border-red-300' : 'border-slate-200')
							}
							value={form.billing_model}
							onChange={(e) => setForm((s) => ({ ...s, billing_model: e.target.value as any }))}
							disabled={!isPaid}
						>
							<option value="">Seleccionar…</option>
							<option value="ANNUAL_CC">Pago anual adelantado</option>
							<option value="MONTHLY">Pago mensual</option>
						</select>
						<div className="text-xs text-slate-500">{toBillingHelper(form.billing_model)}</div>
					</div>

					<div className="space-y-2">
						<Label>Monto pagado (CLP)</Label>
						<Input
							type="number"
							value={form.amount_paid}
							onChange={(e) => setForm((s) => ({ ...s, amount_paid: Number(e.target.value) }))}
							disabled={!isPaid}
							className={missingRequired?.amount_paid ? 'border-red-300' : ''}
						/>
						<div className="text-xs text-slate-600">{formatClp(Number(form.amount_paid ?? 0))} CLP</div>
					</div>
				</div>

				<div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
					<div className="space-y-2">
						<Label>Vía de pago</Label>
						<select
							className={
								'h-10 w-full rounded-xl border bg-white px-3 text-sm text-slate-900 ' +
								(missingRequired?.provider ? 'border-red-300' : 'border-slate-200')
							}
							value={form.provider}
							onChange={(e) => setForm((s) => ({ ...s, provider: e.target.value as any }))}
							disabled={!isPaid}
						>
							<option value="">Seleccionar…</option>
							<option value="FLOW">Flow</option>
							<option value="TRANSFER">Transferencia</option>
							<option value="CASH">Efectivo</option>
							<option value="OTHER">Otro</option>
						</select>
					</div>

					<div className="space-y-2">
						<Label>Fecha de pago</Label>
						<input
							type="date"
							className={
								'h-10 w-full rounded-xl border bg-white px-3 text-sm text-slate-900 ' +
								(missingRequired?.paid_at ? 'border-red-300' : 'border-slate-200')
							}
							value={toDateInputValue(form.paid_at)}
							onChange={(e) => setForm((s) => ({ ...s, paid_at: fromDateInputValue(e.target.value) }))}
							disabled={!isPaid}
						/>
					</div>

					<div className="space-y-2">
						<Label>Notas (opcional)</Label>
						<textarea
							className="min-h-[40px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
							value={form.notes}
							onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
							placeholder="Contexto contable, referencia, etc."
						/>
					</div>
				</div>

				{isPaid ? (
					<div className="mt-3 text-xs text-slate-500">
						Al marcar como Pagado, este registro se usará como fuente de verdad para el módulo “Ventas Pagadas”.
					</div>
				) : (
					<div className="mt-3 text-xs text-slate-500">En Pendiente no se considera para reportes contables.</div>
				)}
			</CardContent>
		</Card>
	)
}
