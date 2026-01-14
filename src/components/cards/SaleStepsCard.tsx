import { useMemo, useState } from 'react'
import type { SaleStepType } from '../../models/SaleStep'
import type { SaleStepView } from '../../services/sales.service'
import { salesService } from '../../services/sales.service'
import { useAlerts } from '../../hooks/useAlerts'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader } from '../ui/card'
import { saleStepStatusLabel, saleStepTypeLabel } from '../../utils/labels'

type PaymentMethod = 'FLOW' | 'TRANSFERENCIA' | 'EFECTIVO'

type Props = {
	saleId: string
	actorUserId: string
	steps: SaleStepView[]
	requiredTypes: SaleStepType[]
}

function getStep(steps: SaleStepView[], type: SaleStepType) {
	return steps.find((s) => s.type === type)
}

function statusOptions(type: SaleStepType): Array<{ value: string; label: string }> {
	switch (type) {
		case 'CONTRACT':
			return [
				{ value: 'PENDING', label: saleStepStatusLabel('PENDING') },
				{ value: 'SENT', label: saleStepStatusLabel('SENT') },
				{ value: 'SIGNED', label: saleStepStatusLabel('SIGNED') },
			]
		case 'PAYMENT':
			return [
				{ value: 'PENDING', label: saleStepStatusLabel('PENDING') },
				{ value: 'DONE', label: saleStepStatusLabel('DONE') },
			]
		default:
			return [
				{ value: 'PENDING', label: saleStepStatusLabel('PENDING') },
				{ value: 'IN_PROGRESS', label: saleStepStatusLabel('IN_PROGRESS') },
				{ value: 'DONE', label: saleStepStatusLabel('DONE') },
			]
	}
}

export function SaleStepsCard({ saleId, actorUserId, steps, requiredTypes }: Props) {
	const alerts = useAlerts()
	const [savingType, setSavingType] = useState<SaleStepType | null>(null)
	const contractSigned = getStep(steps, 'CONTRACT')?.status === 'SIGNED'
	const paymentDone = getStep(steps, 'PAYMENT')?.status === 'DONE'
	const canShip = contractSigned && paymentDone

	const paymentMethod = getStep(steps, 'PAYMENT')?.method
	const [methodDraft, setMethodDraft] = useState<PaymentMethod>((paymentMethod as PaymentMethod) ?? 'TRANSFERENCIA')

	const required = useMemo(() => {
		const set = new Set(requiredTypes)
		return requiredTypes.filter((t) => set.has(t))
	}, [requiredTypes])

	async function setStatus(type: SaleStepType, nextStatus: string) {
		try {
			if (type === 'SHIPPING' && !canShip) {
				alerts.error('No puedes avanzar Envío sin contrato firmado y pago listo')
				return
			}
			if (type === 'PAYMENT' && nextStatus === 'DONE' && !methodDraft) {
				alerts.error('Selecciona método de pago')
				return
			}
			setSavingType(type)
			await salesService.updateSaleStep({
				saleId,
				actorUserId,
				type,
				status: nextStatus as any,
				method: type === 'PAYMENT' && nextStatus === 'DONE' ? (methodDraft as any) : undefined,
			})
			alerts.success(`Paso actualizado: ${saleStepTypeLabel(type)}`)
		} catch {
			alerts.error('No se pudo actualizar el paso')
		} finally {
			setSavingType(null)
		}
	}

	return (
		<Card>
			<CardHeader>
				<div className="text-sm font-semibold">Operación (Pasos)</div>
			</CardHeader>
			<CardContent>
				<div className="space-y-3">
					{required.map((type) => {
						const current = getStep(steps, type)
						const currentStatus = current?.status ?? 'PENDING'
						const disabled = savingType === type
						const opts = statusOptions(type)
						const shippingLocked = type === 'SHIPPING' && !canShip
						return (
							<div key={type} className="rounded-xl border border-slate-200 bg-white p-3">
								<div className="flex items-center justify-between gap-3">
									<div>
										<div className="text-sm font-medium text-slate-900">{saleStepTypeLabel(type)}</div>
										<div className="text-xs text-slate-500">Actual: {saleStepStatusLabel(currentStatus)}</div>
										{shippingLocked ? (
											<div className="text-xs text-amber-700">Bloqueado: requiere Contrato firmado y Pago listo</div>
										) : null}
									</div>
									<div className="flex items-center gap-2">
										{type === 'PAYMENT' ? (
											<select
												className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
												value={methodDraft}
												onChange={(e) => setMethodDraft(e.target.value as PaymentMethod)}
												disabled={disabled}
											>
												<option value="FLOW">FLOW</option>
												<option value="TRANSFERENCIA">TRANSFERENCIA</option>
												<option value="EFECTIVO">EFECTIVO</option>
											</select>
										) : null}
										<select
											className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
											value={currentStatus}
											onChange={(e) => setStatus(type, e.target.value)}
											disabled={disabled || shippingLocked}
										>
											{opts.map((o) => (
												<option key={o.value} value={o.value}>
													{o.label}
												</option>
											))}
										</select>
									</div>
								</div>
							</div>
						)
					})}

					<div className="flex items-center justify-end">
						<Button
							variant="ghost"
							onClick={() => salesService.ensureSaleStepsForSale({ saleId, actorUserId })}
							disabled={savingType !== null}
						>
							Sincronizar pasos
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}
