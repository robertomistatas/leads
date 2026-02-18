import { useEffect, useMemo, useState } from 'react'
import type { SaleStepType } from '../../models/SaleStep'
import type { SaleStepView, SaleView } from '../../services/sales.service'
import { salesService } from '../../services/sales.service'
import { useAlerts } from '../../hooks/useAlerts'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader } from '../ui/card'
import { saleStepStatusLabel, saleStepTypeLabel } from '../../utils/labels'

type PaymentMethod = 'FLOW' | 'TRANSFERENCIA' | 'EFECTIVO'

type PaymentSentVia = NonNullable<SaleView['paymentSentVia']>

type PaymentStepStatus = 'PENDING' | 'SENT' | 'DONE'

type Props = {
	sale: SaleView
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
		default:
			return [
				{ value: 'PENDING', label: saleStepStatusLabel('PENDING') },
				{ value: 'IN_PROGRESS', label: saleStepStatusLabel('IN_PROGRESS') },
				{ value: 'DONE', label: saleStepStatusLabel('DONE') },
			]
	}
}

function paymentSentViaLabel(v: PaymentSentVia) {
	switch (v) {
		case 'PAYMENT_LINK':
			return 'Link de pago'
		case 'PAYMENT_BUTTON':
			return 'Botón de pago'
		case 'AMAIA_PAYMENT':
			return 'Pago por AMAIA'
		default:
			return String(v)
	}
}

export function SaleStepsCard({ sale, saleId, actorUserId, steps, requiredTypes }: Props) {
	const alerts = useAlerts()
	const [savingType, setSavingType] = useState<SaleStepType | null>(null)
	const contractSigned = getStep(steps, 'CONTRACT')?.status === 'SIGNED'
	const paymentDone = getStep(steps, 'PAYMENT')?.status === 'DONE'
	const canShip = contractSigned && paymentDone

	const paymentMethod = getStep(steps, 'PAYMENT')?.method
	const [methodDraft, setMethodDraft] = useState<PaymentMethod>((paymentMethod as PaymentMethod) ?? 'TRANSFERENCIA')
	const paymentCurrentStatus = (getStep(steps, 'PAYMENT')?.status ?? 'PENDING') as PaymentStepStatus
	const [paymentStatusDraft, setPaymentStatusDraft] = useState<PaymentStepStatus>(paymentCurrentStatus)
	const [paymentSentViaDraft, setPaymentSentViaDraft] = useState<PaymentSentVia | ''>((sale.paymentSentVia as PaymentSentVia) ?? '')

	useEffect(() => {
		setMethodDraft((paymentMethod as PaymentMethod) ?? 'TRANSFERENCIA')
	}, [paymentMethod])

	useEffect(() => {
		setPaymentStatusDraft(paymentCurrentStatus)
	}, [paymentCurrentStatus])

	useEffect(() => {
		setPaymentSentViaDraft((sale.paymentSentVia as PaymentSentVia) ?? '')
	}, [sale.paymentSentVia])

	const required = useMemo(() => {
		const set = new Set(requiredTypes)
		return requiredTypes.filter((t) => set.has(t))
	}, [requiredTypes])

	async function setStatus(type: SaleStepType, nextStatus: string, extras?: { paymentSentVia?: PaymentSentVia }) {
		try {
			if (type === 'SHIPPING' && !canShip) {
				alerts.error('No puedes avanzar Envío sin contrato firmado y pago listo')
				return
			}
			if (type === 'PAYMENT') {
				if ((nextStatus === 'DONE' || nextStatus === 'SENT') && !methodDraft) {
					alerts.error('Selecciona método de pago')
					return
				}
				if (nextStatus === 'SENT') {
					if (methodDraft !== 'FLOW') {
						alerts.error('El estado Enviado solo está disponible cuando el método de pago es FLOW')
						return
					}
					if (!extras?.paymentSentVia) {
						alerts.error('Selecciona cómo se envió el pago')
						return
					}
				}
			}
			setSavingType(type)
			await salesService.updateSaleStep({
				saleId,
				actorUserId,
				type,
				status: nextStatus as any,
				method: type === 'PAYMENT' && (nextStatus === 'DONE' || nextStatus === 'SENT') ? (methodDraft as any) : undefined,
				paymentSentVia: type === 'PAYMENT' && nextStatus === 'SENT' ? extras?.paymentSentVia : undefined,
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
			<CardHeader className="p-4">
				<div className="text-sm font-semibold">Operación (Pasos)</div>
			</CardHeader>
			<CardContent className="p-4">
				<div className="space-y-3">
					{required.map((type) => {
						const current = getStep(steps, type)
						const currentStatus = current?.status ?? 'PENDING'
						const disabled = savingType === type
						const opts = statusOptions(type)
						const shippingLocked = type === 'SHIPPING' && !canShip
						const isPayment = type === 'PAYMENT'

						const paymentOpts: Array<{ value: PaymentStepStatus; label: string }> = [
							{ value: 'PENDING', label: saleStepStatusLabel('PENDING') },
							...(methodDraft === 'FLOW' || paymentCurrentStatus === 'SENT' ? [{ value: 'SENT', label: saleStepStatusLabel('SENT') } as const] : []),
							{ value: 'DONE', label: saleStepStatusLabel('DONE') },
						]

						const showSentVia = isPayment && methodDraft === 'FLOW' && paymentStatusDraft === 'SENT'
						const showPaymentSave =
							isPayment &&
							paymentStatusDraft === 'SENT' &&
							(paymentCurrentStatus !== 'SENT' || (sale.paymentSentVia ?? '') !== (paymentSentViaDraft || ''))
						return (
							<div key={type} className="rounded-xl border border-slate-200 bg-white p-3">
								<div className={isPayment ? 'flex flex-wrap items-center justify-between gap-3' : 'flex items-center justify-between gap-3'}>
									<div>
										<div className="text-sm font-medium text-slate-900">{saleStepTypeLabel(type)}</div>
										<div className="text-xs text-slate-500">Actual: {saleStepStatusLabel(currentStatus)}</div>
										{shippingLocked ? (
											<div className="text-xs text-amber-700">Bloqueado: requiere Contrato firmado y Pago listo</div>
										) : null}
									</div>
									<div
										className={
											isPayment
												? 'flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto'
												: 'flex items-center gap-2'
										}
									>
										{isPayment ? (
											<select
												className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 sm:w-44"
												value={methodDraft}
												onChange={(e) => {
													const next = e.target.value as PaymentMethod
													if (paymentCurrentStatus === 'SENT' && next !== 'FLOW') {
														alerts.error('No puedes cambiar el método de pago mientras el estado sea Enviado')
														return
													}
													setMethodDraft(next)
												}}
												disabled={disabled}
											>
												<option value="FLOW">FLOW</option>
												<option value="TRANSFERENCIA">TRANSFERENCIA</option>
												<option value="EFECTIVO">EFECTIVO</option>
											</select>
										) : null}

										{showSentVia ? (
											<select
												className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 sm:w-56"
												value={paymentSentViaDraft}
												onChange={(e) => setPaymentSentViaDraft(e.target.value as PaymentSentVia)}
												disabled={disabled}
											>
												<option value="">¿Cómo se envió el pago?</option>
												<option value="PAYMENT_LINK">{paymentSentViaLabel('PAYMENT_LINK')}</option>
												<option value="PAYMENT_BUTTON">{paymentSentViaLabel('PAYMENT_BUTTON')}</option>
												<option value="AMAIA_PAYMENT">{paymentSentViaLabel('AMAIA_PAYMENT')}</option>
											</select>
										) : null}

										<select
											className={
												isPayment
													? 'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 sm:w-40'
													: 'h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900'
											}
											value={isPayment ? paymentStatusDraft : currentStatus}
											onChange={(e) => {
												if (!isPayment) {
													setStatus(type, e.target.value)
													return
												}
												const next = e.target.value as PaymentStepStatus
												setPaymentStatusDraft(next)
												// UX explícita: Enviado requiere seleccionar "¿Cómo se envió?" antes de guardar.
												if (next === 'SENT') return
												setStatus('PAYMENT', next)
											}}
											disabled={disabled || shippingLocked}
										>
											{isPayment
												? paymentOpts.map((o) => (
														<option key={o.value} value={o.value}>
															{o.label}
														</option>
													))
												: opts.map((o) => (
														<option key={o.value} value={o.value}>
															{o.label}
														</option>
													))}
										</select>

										{showPaymentSave ? (
											<Button
												onClick={() =>
												setStatus('PAYMENT', 'SENT', {
													paymentSentVia: paymentSentViaDraft ? (paymentSentViaDraft as PaymentSentVia) : undefined,
												})
											}
												disabled={disabled || !paymentSentViaDraft}
											>
												Guardar
											</Button>
										) : null}
									</div>
								</div>
								{showSentVia && !paymentSentViaDraft ? (
									<div className="mt-2 text-xs text-amber-700">Obligatorio: selecciona cómo se envió el pago para guardar Enviado.</div>
								) : null}
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
