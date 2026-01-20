import type { SaleView } from '../../services/sales.service'
import type { SaleStepView } from '../../services/sales.service'
import type { BeneficiaryView } from '../../services/sales.service'
import { getCloseSaleReadiness, salesService } from '../../services/sales.service'
import { useAlerts } from '../../hooks/useAlerts'
import { saleErrorMessages } from '@/utils/domainErrorMessages'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader } from '../ui/card'

type Props = {
	sale: SaleView
	steps: SaleStepView[]
	beneficiary: BeneficiaryView | null
	actorUserId: string
}

export function SaleActionsCard({ sale, steps, beneficiary, actorUserId }: Props) {
	const alerts = useAlerts()
	const contractSigned = steps.find((s) => s.type === 'CONTRACT')?.status === 'SIGNED'
	const beneficiaryExists = Boolean(beneficiary)
	const readiness = getCloseSaleReadiness({
		sale: sale as unknown as import('@/models/Sale').Sale,
		beneficiaryExists,
		contractSigned,
	})
	const canArchive = sale.status !== 'archived'

	function StatusIcon({ kind }: { kind: 'blocked' | 'ready' | 'item' }) {
		if (kind === 'ready') {
			return (
				<svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
					<path
						fill="currentColor"
						d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1 14.2-3.6-3.6 1.4-1.4 2.2 2.2 4.9-4.9 1.4 1.4L11 16.2Z"
					/>
				</svg>
			)
		}

		if (kind === 'blocked') {
			return (
				<svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
					<path
						fill="currentColor"
						d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-5 11h10v-2H7v2Z"
					/>
				</svg>
			)
		}

		return (
			<svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
				<path
					fill="currentColor"
					d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 14a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm1-3V6h-2v7h2Z"
				/>
			</svg>
		)
	}

	async function onClose() {
		const result = await salesService.closeSale({ saleId: sale.id, actorUserId })
		if (!result.ok) {
			alerts.error(saleErrorMessages[result.error])
			return
		}
		alerts.success('Venta cerrada correctamente')
	}

	async function onArchive() {
		if (!canArchive) return
		if (!window.confirm('¿Archivar esta venta? No generará alertas runtime.')) return
		try {
			await salesService.archiveSale({ saleId: sale.id, actorUserId })
			alerts.success('Venta archivada')
		} catch {
			alerts.error('No se pudo archivar la venta')
		}
	}

	return (
		<Card>
			<CardHeader>
				<div className="text-sm font-semibold">Acciones</div>
			</CardHeader>
			<CardContent>
				{!readiness.canClose ? (
					<div className="mb-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
						<div className="flex items-start gap-2">
							<div className="mt-0.5 text-slate-700">
								<StatusIcon kind="blocked" />
							</div>
							<div>
								<div className="font-medium">Esta venta no puede cerrarse todavía</div>
								<div className="mt-1 text-xs text-slate-600">Falta completar:</div>
								<ul className="mt-2 space-y-1">
									{readiness.blockers.map((blocker) => (
										<li key={blocker} className="flex items-start gap-2 text-xs text-slate-700">
											<span className="mt-0.5 text-slate-500" aria-hidden="true">
												<StatusIcon kind="item" />
											</span>
											<span>{saleErrorMessages[blocker]}</span>
										</li>
									))}
								</ul>
							</div>
						</div>
					</div>
				) : (
					<div className="mb-3 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-800">
						<div className="flex items-center gap-2">
							<div className="text-slate-700">
								<StatusIcon kind="ready" />
							</div>
							<div className="font-medium">Esta venta está lista para cerrarse</div>
						</div>
					</div>
				)}

				<div className="flex flex-wrap items-center gap-2">
					<Button variant="default" onClick={onClose}>
						Cerrar venta
					</Button>
					<Button variant="secondary" disabled={!canArchive} onClick={onArchive}>
						Archivar
					</Button>
				</div>
			</CardContent>
		</Card>
	)
}
