import { useMemo, useState } from 'react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import type { PlanPricing } from '../../models/Plan'
import type { PlanView } from '../../services/plans.service'
import { formatClp } from '../../utils/currency'

type Draft = {
	code: string
	name: string
	active: boolean
	monthlySubscriptionClp: string
	activationFeeClp: string
	teleassistanceEnabled: boolean
	teleassistanceMonthlyFeeClp: string
	annualCreditCard: boolean
	monthsBilled: string
	waiveActivationFee: boolean
}

const DEFAULT_MONTHS_BILLED = 12

function toDraft(plan?: PlanView | null): Draft {
	if (!plan) {
		return {
			code: '',
			name: '',
			active: true,
			monthlySubscriptionClp: '',
			activationFeeClp: '',
			teleassistanceEnabled: false,
			teleassistanceMonthlyFeeClp: '',
			annualCreditCard: false,
			monthsBilled: String(DEFAULT_MONTHS_BILLED),
			waiveActivationFee: false,
		}
	}

	return {
		code: plan.code,
		name: plan.name,
		active: plan.active,
		monthlySubscriptionClp: String(plan.pricing.monthlySubscriptionClp ?? 0),
		activationFeeClp: String(plan.pricing.activationFeeClp ?? 0),
		teleassistanceEnabled: Boolean(plan.teleassistance?.enabled ?? false),
		teleassistanceMonthlyFeeClp: String(plan.teleassistance?.monthlyFeeClp ?? 0),
		annualCreditCard: plan.annualCreditCard,
		monthsBilled: String(plan.pricing.monthsBilled ?? DEFAULT_MONTHS_BILLED),
		waiveActivationFee: plan.pricing.waiveActivationFee,
	}
}

function parseClp(input: string): number {
	const n = Number(String(input).replace(/[^0-9]/g, ''))
	if (!Number.isFinite(n)) return 0
	return n
}

function parseIntSafe(input: string, fallback: number): number {
	const n = Number.parseInt(String(input).trim(), 10)
	return Number.isFinite(n) ? n : fallback
}

export function PlanModal(props: {
	open: boolean
	plan: PlanView | null
	onClose: () => void
	onSave: (input: {
		planId?: string
		code: string
		name: string
		active: boolean
		pricing: PlanPricing
		teleassistance: { enabled: boolean; monthlyFeeClp: number }
		annualCreditCard: boolean
	}) => Promise<void>
}) {
	const { open, plan, onClose, onSave } = props
	const [saving, setSaving] = useState(false)
	const [draft, setDraft] = useState<Draft>(() => toDraft(plan))

	const title = useMemo(() => (plan ? 'Editar plan' : 'Crear plan'), [plan])

	if (!open) return null

	const close = () => {
		if (saving) return
		onClose()
		setDraft(toDraft(plan))
	}

	return (
		<div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onMouseDown={close}>
			<div
				className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-lg"
				onMouseDown={(e) => e.stopPropagation()}
			>
				<div className="flex items-start justify-between gap-3">
					<div>
						<div className="text-lg font-semibold text-slate-900">{title}</div>
						<div className="text-sm text-slate-600">Define precios oficiales por plan</div>
					</div>
					<Button variant="secondary" onClick={close} disabled={saving}>
						Cerrar
					</Button>
				</div>

				<div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
					<div className="space-y-2">
						<Label>Código</Label>
						<Input value={draft.code} onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))} />
					</div>
					<div className="space-y-2">
						<Label>Nombre</Label>
						<Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
					</div>

					<div className="space-y-2">
						<Label>Suscripción mensual (CLP)</Label>
						<Input
							value={draft.monthlySubscriptionClp}
							onChange={(e) => setDraft((d) => ({ ...d, monthlySubscriptionClp: e.target.value }))}
						/>
						<div className="text-xs text-slate-600">{formatClp(parseClp(draft.monthlySubscriptionClp))}</div>
					</div>

					<div className="space-y-2">
						<Label>Costo de habilitación (CLP)</Label>
						<Input
							value={draft.activationFeeClp}
							onChange={(e) => setDraft((d) => ({ ...d, activationFeeClp: e.target.value }))}
							disabled={draft.waiveActivationFee}
						/>
						<div className="text-xs text-slate-600">
							{draft.waiveActivationFee ? 'Exento' : formatClp(parseClp(draft.activationFeeClp))}
						</div>
					</div>

					<div className="space-y-2">
						<Label>Meses facturados (tarjeta anual)</Label>
						<Input
							value={draft.monthsBilled}
							onChange={(e) => setDraft((d) => ({ ...d, monthsBilled: e.target.value }))}
						/>
						<div className="text-xs text-slate-500">Default: {DEFAULT_MONTHS_BILLED}</div>
					</div>

					<div className="space-y-2">
						<Label>Teleasistencia</Label>
						<label className="flex items-center gap-2 text-sm text-slate-700">
							<input
								type="checkbox"
								checked={draft.teleassistanceEnabled}
								onChange={(e) =>
									setDraft((d) => ({
										...d,
										teleassistanceEnabled: e.target.checked,
									}))
								}
							/>
							Teleasistencia disponible
						</label>
						<div className="space-y-2">
							<Label>Valor adicional mensual (CLP)</Label>
							<Input
								value={draft.teleassistanceMonthlyFeeClp}
								onChange={(e) =>
									setDraft((d) => ({ ...d, teleassistanceMonthlyFeeClp: e.target.value }))
								}
								disabled={!draft.teleassistanceEnabled}
							/>
							<div className="text-xs text-slate-600">
								{draft.teleassistanceEnabled
									? formatClp(parseClp(draft.teleassistanceMonthlyFeeClp))
									: 'No aplica'}
							</div>
						</div>
					</div>

					<div className="space-y-2">
						<Label>Opciones</Label>
						<label className="flex items-center gap-2 text-sm text-slate-700">
							<input
								type="checkbox"
								checked={draft.active}
								onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))}
							/>
							Activo
						</label>
						<label className="flex items-center gap-2 text-sm text-slate-700">
							<input
								type="checkbox"
								checked={draft.annualCreditCard}
								onChange={(e) => setDraft((d) => ({ ...d, annualCreditCard: e.target.checked }))}
							/>
							Permite tarjeta anual
						</label>
						<label className="flex items-center gap-2 text-sm text-slate-700">
							<input
								type="checkbox"
								checked={draft.waiveActivationFee}
								onChange={(e) => setDraft((d) => ({ ...d, waiveActivationFee: e.target.checked }))}
							/>
							Eximir costo de habilitación
						</label>
					</div>
				</div>

				<div className="mt-6 flex items-center justify-end gap-2">
					<Button
						onClick={async () => {
							try {
								setSaving(true)
								const pricing: PlanPricing = {
									monthlySubscriptionClp: parseClp(draft.monthlySubscriptionClp),
									activationFeeClp: parseClp(draft.activationFeeClp),
									monthsBilled: parseIntSafe(draft.monthsBilled, DEFAULT_MONTHS_BILLED),
									waiveActivationFee: draft.waiveActivationFee,
								}
								const teleassistance = {
									enabled: Boolean(draft.teleassistanceEnabled),
									monthlyFeeClp: parseClp(draft.teleassistanceMonthlyFeeClp),
								}
								await onSave({
									planId: plan?.id,
									code: draft.code.trim(),
									name: draft.name.trim(),
									active: draft.active,
									pricing,
									teleassistance,
									annualCreditCard: draft.annualCreditCard,
								})
								close()
							} finally {
								setSaving(false)
							}
						}}
						disabled={saving}
					>
						{saving ? 'Guardando…' : 'Guardar'}
					</Button>
				</div>
			</div>
		</div>
	)
}
