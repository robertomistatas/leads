import { useState } from 'react'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader } from '../../components/ui/card'
import { usePlans } from '../../hooks/usePlans'
import { plansService, type PlanView } from '../../services/plans.service'
import { useAlerts } from '../../hooks/useAlerts'
import type { PlanPricing } from '../../models/Plan'
import { formatClp } from '../../utils/currency'
import { PlanModal } from './PlanModal'

export function ValuesPage() {
	const { plans, loading } = usePlans()
	const alerts = useAlerts()

	const [modalOpen, setModalOpen] = useState(false)
	const [editingPlan, setEditingPlan] = useState<PlanView | null>(null)

	const openCreate = () => {
		setEditingPlan(null)
		setModalOpen(true)
	}

	const openEdit = (plan: PlanView) => {
		setEditingPlan(plan)
		setModalOpen(true)
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<div>
					<div className="text-xl font-semibold text-slate-900">Valores</div>
					<div className="text-sm text-slate-600">Planes comerciales</div>
				</div>
				<Button onClick={openCreate}>Nuevo plan</Button>
			</div>

			<Card>
				<CardHeader className="flex items-center justify-between">
					<div className="font-semibold text-slate-900">Planes</div>
					<div className="text-sm text-slate-600">{loading ? 'Cargando…' : `${plans.length} planes`}</div>
				</CardHeader>
				<CardContent>
					{loading ? (
						<div className="text-sm text-slate-600">Cargando…</div>
					) : plans.length === 0 ? (
						<div className="text-sm text-slate-600">No hay planes.</div>
					) : (
						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<thead>
									<tr className="text-left text-slate-500 border-b">
										<th className="py-2 pr-4">Código</th>
										<th className="py-2 pr-4">Nombre</th>
										<th className="py-2 pr-4">Suscripción mensual</th>
										<th className="py-2 pr-4">Teleasistencia</th>
										<th className="py-2 pr-4">Habilitación</th>
										<th className="py-2 pr-4">Meses (anual)</th>
										<th className="py-2 pr-4">Activo</th>
										<th className="py-2 pr-4"></th>
									</tr>
								</thead>
								<tbody>
									{plans.map((p) => {
										const activationLabel = p.pricing.waiveActivationFee
											? 'Exento'
											: formatClp(p.pricing.activationFeeClp)
										return (
											<tr key={p.id} className="border-b last:border-b-0">
												<td className="py-3 pr-4 text-slate-900 font-medium">{p.code}</td>
												<td className="py-3 pr-4 text-slate-800">{p.name}</td>
												<td className="py-3 pr-4 text-slate-800">{formatClp(p.pricing.monthlySubscriptionClp)}</td>
												<td className="py-3 pr-4 text-slate-800">
													{p.teleassistance?.enabled ? formatClp(p.teleassistance?.monthlyFeeClp ?? 0) : '—'}
												</td>
												<td className="py-3 pr-4 text-slate-800">{activationLabel}</td>
												<td className="py-3 pr-4 text-slate-800">{p.pricing.monthsBilled}</td>
												<td className="py-3 pr-4 text-slate-800">{p.active ? 'Sí' : 'No'}</td>
												<td className="py-3 pr-4 text-right">
													<Button variant="secondary" onClick={() => openEdit(p)}>
														Editar
													</Button>
												</td>
											</tr>
										)
									})}
								</tbody>
							</table>
						</div>
					)}
				</CardContent>
			</Card>

			<PlanModal
				open={modalOpen}
				plan={editingPlan}
				onClose={() => setModalOpen(false)}
				onSave={async (input) => {
					try {
						const pricing: PlanPricing = input.pricing
						if (!input.code || !input.name) {
							alerts.error('Código y nombre son obligatorios')
							return
						}
						if (!input.planId) {
							await plansService.createPlan({
								code: input.code,
								name: input.name,
								pricing,
								teleassistance: input.teleassistance,
								annualCreditCard: input.annualCreditCard,
								active: input.active,
							})
							alerts.success('Plan creado')
							return
						}
						await plansService.updatePlan(input.planId, {
							code: input.code,
							name: input.name,
							pricing,
							teleassistance: input.teleassistance,
							annualCreditCard: input.annualCreditCard,
							active: input.active,
						})
						alerts.success('Plan actualizado')
					} catch {
						alerts.error('No se pudo guardar el plan')
					}
				}}
			/>
		</div>
	)
}
