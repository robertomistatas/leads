import { useEffect, useMemo, useState } from 'react'
import type { CommercialTermsView } from '../../services/sales.service'
import { salesService } from '../../services/sales.service'
import { useAlerts } from '../../hooks/useAlerts'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader } from '../ui/card'
import { Input } from '../ui/input'
import { Label } from '../ui/label'

type Props = {
	saleId: string
	actorUserId: string
	terms: CommercialTermsView | null
}

export function CommercialTermsCard({ saleId, actorUserId, terms }: Props) {
	const alerts = useAlerts()
	const [saving, setSaving] = useState(false)
	const [finalPriceManual, setFinalPriceManual] = useState(false)
	const [form, setForm] = useState({
		basePrice: terms?.basePrice ?? 0,
		discountPercentage: terms?.discountPercentage ?? 0,
		finalPrice: terms?.finalPrice ?? 0,
		discountConfirmed: terms?.discountConfirmed ?? false,
		finalPriceConfirmed: terms?.finalPriceConfirmed ?? false,
	})

	useEffect(() => {
		setFinalPriceManual(false)
		setForm({
			basePrice: terms?.basePrice ?? 0,
			discountPercentage: terms?.discountPercentage ?? 0,
			finalPrice: terms?.finalPrice ?? 0,
			discountConfirmed: terms?.discountConfirmed ?? false,
			finalPriceConfirmed: terms?.finalPriceConfirmed ?? false,
		})
	}, [terms])

	function computeFinalPrice(basePrice: number, discountPercentage: number) {
		const base = Number(basePrice) || 0
		const discount = Number(discountPercentage) || 0
		const raw = base * (1 - discount / 100)
		if (!Number.isFinite(raw)) return 0
		return Number(raw.toFixed(2))
	}

	const needsDiscountConfirm = form.discountPercentage >= 51
	const canSave = useMemo(() => {
		if (form.basePrice <= 0) return false
		if (form.finalPrice <= 0) return false
		if (needsDiscountConfirm && !form.discountConfirmed) return false
		if (!form.finalPriceConfirmed) return false
		return true
	}, [form, needsDiscountConfirm])

	async function onSave() {
		try {
			setSaving(true)
			if (needsDiscountConfirm && !form.discountConfirmed) {
				alerts.error('Confirma el descuento (>= 51%) para guardar')
				return
			}
			if (!form.finalPriceConfirmed) {
				alerts.error('Confirma el precio final para guardar')
				return
			}
			await salesService.upsertCommercialTerms({
				saleId,
				actorUserId,
				terms: {
					basePrice: Number(form.basePrice) || 0,
					discountPercentage: Number(form.discountPercentage) || 0,
					finalPrice: Number(form.finalPrice) || 0,
					discountConfirmed: Boolean(form.discountConfirmed),
					finalPriceConfirmed: Boolean(form.finalPriceConfirmed),
				},
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
			<CardHeader>
				<div className="flex items-center justify-between gap-3">
					<div>
						<div className="text-sm font-semibold">Términos comerciales</div>
						<div className="text-xs text-slate-500">Confirmaciones obligatorias para guardar</div>
					</div>
					<Button variant="secondary" disabled={!canSave || saving} onClick={onSave}>
						{saving ? 'Guardando…' : 'Guardar'}
					</Button>
				</div>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<div className="space-y-2">
						<Label>Precio base</Label>
						<Input
							type="number"
							value={form.basePrice}
							onChange={(e) => {
								const basePrice = Number(e.target.value)
								const nextFinal = computeFinalPrice(basePrice, form.discountPercentage)
								setFinalPriceManual(false)
								setForm((s) => ({
									...s,
									basePrice,
									finalPrice: nextFinal,
									discountConfirmed: false,
									finalPriceConfirmed: false,
								}))
							}}
						/>
					</div>
					<div className="space-y-2">
						<Label>Descuento %</Label>
						<Input
							type="number"
							value={form.discountPercentage}
							onChange={(e) => {
								const discountPercentage = Number(e.target.value)
								const nextFinal = computeFinalPrice(form.basePrice, discountPercentage)
								setFinalPriceManual(false)
								setForm((s) => ({
									...s,
									discountPercentage,
									finalPrice: nextFinal,
									discountConfirmed: false,
									finalPriceConfirmed: false,
								}))
							}}
						/>
					</div>
					<div className="space-y-2">
						<Label>Precio final</Label>
						<Input
							type="number"
							value={form.finalPrice}
							onChange={(e) => {
								const finalPrice = Number(e.target.value)
								setFinalPriceManual(true)
								setForm((s) => ({ ...s, finalPrice, finalPriceConfirmed: false }))
							}}
						/>
						{finalPriceManual ? <div className="text-xs text-slate-500">Editado manualmente</div> : null}
					</div>
				</div>

				<div className="mt-4 space-y-2">
					<label className="flex items-center gap-2 text-sm text-slate-700">
						<input
							type="checkbox"
							checked={form.discountConfirmed}
							onChange={(e) => setForm((s) => ({ ...s, discountConfirmed: e.target.checked }))}
						/>
						Confirmo el descuento{needsDiscountConfirm ? ' (>= 51%)' : ''}
					</label>
					<label className="flex items-center gap-2 text-sm text-slate-700">
						<input
							type="checkbox"
							checked={form.finalPriceConfirmed}
							onChange={(e) => setForm((s) => ({ ...s, finalPriceConfirmed: e.target.checked }))}
						/>
						Confirmo que el precio final es correcto
					</label>
				</div>
			</CardContent>
		</Card>
	)
}
