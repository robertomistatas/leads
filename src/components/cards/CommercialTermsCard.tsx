import { useEffect, useMemo, useRef, useState } from 'react'
import { Timestamp } from 'firebase/firestore'
import type { CommercialTermsView } from '../../services/sales.service'
import type { SaleView } from '../../services/sales.service'
import { salesService } from '../../services/sales.service'
import { useAlerts } from '../../hooks/useAlerts'
import { usePlans } from '../../hooks/usePlans'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader } from '../ui/card'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { formatClp } from '../../utils/currency'

type Props = {
	sale: SaleView
	saleId: string
	actorUserId: string
	terms: CommercialTermsView | null
}

function storedPlanToUi(plan: SaleView['plan'] | undefined) {
	if (!plan) return ''
	return plan === 'MIXTO' ? 'FLEXIBLE' : String(plan)
}

export function CommercialTermsCard({ sale, saleId, actorUserId, terms }: Props) {
	void actorUserId
	void terms
	const alerts = useAlerts()
	const { plans, loading: plansLoading } = usePlans()
	const [saving, setSaving] = useState(false)
	const [form, setForm] = useState({
		monthlyFee: sale.finalPricing?.monthlyFee ?? 0,
		setupFee: sale.finalPricing?.setupFee ?? 0,
		teleassistanceIncluded: sale.finalPricing?.teleassistanceIncluded ?? sale.modality === 'CON_TELEASISTENCIA',
		discountApplied: sale.finalPricing?.discountApplied ?? undefined,
		notes: sale.finalPricing?.notes ?? '',
	})

	useEffect(() => {
		setForm({
			monthlyFee: sale.finalPricing?.monthlyFee ?? 0,
			setupFee: sale.finalPricing?.setupFee ?? 0,
			teleassistanceIncluded: sale.finalPricing?.teleassistanceIncluded ?? sale.modality === 'CON_TELEASISTENCIA',
			discountApplied: sale.finalPricing?.discountApplied ?? undefined,
			notes: sale.finalPricing?.notes ?? '',
		})
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [sale.id])

	const selectedPlan = useMemo(() => {
		if (sale.planId) return plans.find((p) => p.id === sale.planId) ?? null
		const code = storedPlanToUi(sale.plan)
		if (!code) return null
		return plans.find((p) => p.code === code) ?? null
	}, [plans, sale.planId, sale.plan])

	function computeSuggestedFromPlan() {
		if (!selectedPlan) return null
		const monthlyFee = Number(selectedPlan.pricing?.monthlySubscriptionClp ?? 0)
		const setupFee = selectedPlan.pricing?.waiveActivationFee ? 0 : Number(selectedPlan.pricing?.activationFeeClp ?? 0)
		const teleassistanceAddon = selectedPlan.teleassistance?.enabled ? Number(selectedPlan.teleassistance?.monthlyFeeClp ?? 0) : undefined
		return {
			monthlyFee,
			setupFee,
			teleassistanceAddon,
			sourcePlanId: selectedPlan.id,
			snapshotAt: Timestamp.now(),
		}
	}

	const effectiveSuggested = useMemo(() => {
		if (sale.suggestedPricing?.sourcePlanId && selectedPlan?.id && sale.suggestedPricing.sourcePlanId === selectedPlan.id) {
			return sale.suggestedPricing
		}
		return null
	}, [sale.suggestedPricing, selectedPlan?.id])

	const autoSnapshotRef = useRef<{ saleId: string; planId: string } | null>(null)
	useEffect(() => {
		if (!selectedPlan) return
		const planId = selectedPlan.id
		const key = { saleId, planId }
		const prev = autoSnapshotRef.current
		autoSnapshotRef.current = key

		// Snapshot only when a plan is selected/changed and the current snapshot is missing or from another plan.
		if (sale.suggestedPricing?.sourcePlanId === planId) return
		if (prev && prev.saleId === saleId && prev.planId === planId) {
			// Avoid duplicate writes on re-renders.
			return
		}

		const suggestedPricing = computeSuggestedFromPlan()
		if (!suggestedPricing) return

		void salesService
			.updateSaleHybridPricing({ saleId, suggestedPricing })
			.catch(() => {
				// Non-blocking.
			})

		// Prefill local editable fields (non-blocking, no persistence until save).
		setForm((s) => ({
			...s,
			monthlyFee: suggestedPricing.monthlyFee,
			setupFee: suggestedPricing.setupFee,
			teleassistanceIncluded: sale.modality === 'CON_TELEASISTENCIA',
		}))
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedPlan?.id, saleId])

	const teleAddon = useMemo(() => {
		if (effectiveSuggested?.teleassistanceAddon !== undefined) return effectiveSuggested.teleassistanceAddon
		if (selectedPlan?.teleassistance?.enabled) return Number(selectedPlan.teleassistance?.monthlyFeeClp ?? 0)
		return 0
	}, [effectiveSuggested?.teleassistanceAddon, selectedPlan?.teleassistance])

	const suggestedTotal = useMemo(() => {
		const s = effectiveSuggested
		if (!s) return 0
		return Number(s.monthlyFee ?? 0) + Number(s.setupFee ?? 0) + (form.teleassistanceIncluded ? Number(teleAddon ?? 0) : 0)
	}, [effectiveSuggested, form.teleassistanceIncluded, teleAddon])

	const finalTotal = useMemo(() => {
		return Number(form.monthlyFee ?? 0) + Number(form.setupFee ?? 0) + (form.teleassistanceIncluded ? Number(teleAddon ?? 0) : 0)
	}, [form.monthlyFee, form.setupFee, form.teleassistanceIncluded, teleAddon])

	const pricingDeltaPreview = useMemo(() => {
		if (!effectiveSuggested || suggestedTotal <= 0) return null
		const amountDifference = finalTotal - suggestedTotal
		const percentDifference = (amountDifference / suggestedTotal) * 100
		return { amountDifference, percentDifference }
	}, [effectiveSuggested, finalTotal, suggestedTotal])

	async function onSave() {
		try {
			setSaving(true)
			const suggestedPricing = effectiveSuggested ?? computeSuggestedFromPlan() ?? undefined
			const notes = String(form.notes ?? '').trim()
			const discountAppliedNumber = form.discountApplied === undefined ? undefined : Number(form.discountApplied)
			const finalPricing = {
				monthlyFee: Number(form.monthlyFee ?? 0),
				setupFee: Number(form.setupFee ?? 0),
				teleassistanceIncluded: Boolean(form.teleassistanceIncluded),
				discountApplied: discountAppliedNumber,
				notes: notes ? notes : undefined,
			}

			const pricingDelta = pricingDeltaPreview
				? {
					amountDifference: Number(pricingDeltaPreview.amountDifference ?? 0),
					percentDifference: Number(pricingDeltaPreview.percentDifference ?? 0),
				}
				: undefined

			await salesService.updateSaleHybridPricing({
				saleId,
				suggestedPricing,
				finalPricing,
				pricingDelta,
			})
			alerts.success('Términos comerciales guardados')
		} catch {
			alerts.error('No se pudieron guardar los términos comerciales')
		} finally {
			setSaving(false)
		}
	}

	return (
		<Card>
			<CardHeader className="p-4">
				<div className="flex items-center justify-between gap-3">
					<div>
						<div className="text-sm font-semibold">Términos comerciales</div>
						<div className="text-xs text-slate-500">Edición libre (sin bloqueos) · Se registra sugerido vs acordado</div>
					</div>
					<Button variant="secondary" disabled={saving} onClick={onSave}>
						{saving ? 'Guardando…' : 'Guardar'}
					</Button>
				</div>
			</CardHeader>
			<CardContent className="p-4">
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<div className="space-y-2">
						<Label>Plan</Label>
						<div className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 flex items-center text-sm text-slate-900">
							{selectedPlan
								? `${selectedPlan.code} — ${selectedPlan.name}`
								: plansLoading
									? 'Cargando planes…'
									: 'Selecciona un plan en “Plan contratado”'}
						</div>
						{effectiveSuggested ? (
							<div className="text-xs text-slate-600">Snapshot guardado</div>
						) : (
							<div className="text-xs text-slate-500">Sin sugerido guardado aún</div>
						)}
					</div>

					<div className="space-y-2">
						<Label>Mensualidad (acordado)</Label>
						<Input
							type="number"
							value={form.monthlyFee}
							onChange={(e) => setForm((s) => ({ ...s, monthlyFee: Number(e.target.value) }))}
						/>
						<div className="text-xs text-slate-600">{formatClp(Number(form.monthlyFee ?? 0))}</div>
						<div className="text-xs text-slate-500">Sugerido: {formatClp(Number(effectiveSuggested?.monthlyFee ?? 0))}</div>
					</div>

					<div className="space-y-2">
						<Label>Habilitación (acordado)</Label>
						<Input
							type="number"
							value={form.setupFee}
							onChange={(e) => setForm((s) => ({ ...s, setupFee: Number(e.target.value) }))}
						/>
						<div className="text-xs text-slate-600">{formatClp(Number(form.setupFee ?? 0))}</div>
						<div className="text-xs text-slate-500">Sugerido: {formatClp(Number(effectiveSuggested?.setupFee ?? 0))}</div>
					</div>
				</div>

				<div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
					<div className="space-y-2">
						<Label>Teleasistencia</Label>
						<select
							className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
							value={form.teleassistanceIncluded ? 'yes' : 'no'}
							onChange={(e) => setForm((s) => ({ ...s, teleassistanceIncluded: e.target.value === 'yes' }))}
						>
							<option value="no">No incluye</option>
							<option value="yes">Incluye</option>
						</select>
						<div className="text-xs text-slate-500">Addon ref: {formatClp(Number(teleAddon ?? 0))}</div>
					</div>

					<div className="space-y-2">
						<Label>Descuento aplicado (opcional)</Label>
						<Input
							type="number"
							value={form.discountApplied ?? ''}
							onChange={(e) => {
								const v = e.target.value
								setForm((s) => ({ ...s, discountApplied: v === '' ? undefined : Number(v) }))
							}}
							placeholder="Ej: 5000"
						/>
						<div className="text-xs text-slate-500">No bloquea guardado</div>
					</div>

					<div className="space-y-2">
						<Label>Notas (opcional)</Label>
						<textarea
							className="min-h-[40px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
							value={form.notes}
							onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
							placeholder="Condiciones, contexto de la negociación, etc."
						/>
					</div>
				</div>

				<div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
					<div className="text-sm font-medium text-slate-900">Diferencias (informativo)</div>
					{!effectiveSuggested ? (
						<div className="mt-1 text-sm text-slate-600">Sin valor sugerido disponible. Selecciona un plan para generar snapshot.</div>
					) : (
						<div className="mt-2 space-y-1 text-sm text-slate-700">
							<div className="flex justify-between gap-4">
								<span>Valor sugerido</span>
								<span>{formatClp(suggestedTotal)}</span>
							</div>
							<div className="flex justify-between gap-4">
								<span>Valor acordado</span>
								<span>{formatClp(finalTotal)}</span>
							</div>
							<div className="mt-2 flex justify-between gap-4 font-medium text-slate-900">
								<span>Diferencia</span>
								<span>
									{formatClp(pricingDeltaPreview?.amountDifference ?? 0)} ({(pricingDeltaPreview?.percentDifference ?? 0).toFixed(1)}%)
								</span>
							</div>
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	)
}
