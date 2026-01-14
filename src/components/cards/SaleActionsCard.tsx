import type { SaleView } from '../../services/sales.service'
import type { SaleStepView } from '../../services/sales.service'
import type { BeneficiaryView } from '../../services/sales.service'
import { salesService } from '../../services/sales.service'
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
	const canClose = sale.status === 'in_progress' && contractSigned && Boolean(beneficiary) && Boolean(sale.plan) && Boolean(sale.modality)
	const canArchive = sale.status !== 'archived'

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
				<div className="flex flex-wrap items-center gap-2">
					<Button variant="default" disabled={!canClose} onClick={onClose}>
						Cerrar venta
					</Button>
					<Button variant="secondary" disabled={!canArchive} onClick={onArchive}>
						Archivar
					</Button>
				</div>

				<div className="mt-3 text-xs text-slate-600">
					<div>Requisitos para cerrar: Contrato firmado + Beneficiario + Plan + Modalidad.</div>
					<div>Archivar: desactiva alertas runtime para la venta.</div>
				</div>
			</CardContent>
		</Card>
	)
}
