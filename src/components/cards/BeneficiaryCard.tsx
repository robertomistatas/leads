import { useEffect, useMemo, useState } from 'react'
import type { BeneficiaryView } from '../../services/sales.service'
import { salesService } from '../../services/sales.service'
import { useAlerts } from '../../hooks/useAlerts'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader } from '../ui/card'
import { Input } from '../ui/input'
import { Label } from '../ui/label'

type Props = {
	saleId: string
	actorUserId: string
	beneficiary: BeneficiaryView | null
}

export function BeneficiaryCard({ saleId, actorUserId, beneficiary }: Props) {
	const alerts = useAlerts()
	const [saving, setSaving] = useState(false)
	const [replaceMode, setReplaceMode] = useState(false)
	const [form, setForm] = useState({
		fullName: beneficiary?.fullName ?? '',
		rut: beneficiary?.rut ?? '',
		serviceAddress: beneficiary?.serviceAddress ?? '',
		region: beneficiary?.region ?? '',
	})

	useEffect(() => {
		setForm({
			fullName: beneficiary?.fullName ?? '',
			rut: beneficiary?.rut ?? '',
			serviceAddress: beneficiary?.serviceAddress ?? '',
			region: beneficiary?.region ?? '',
		})
	}, [beneficiary])

	const canSave = useMemo(() => {
		return form.fullName.trim().length > 0 && form.serviceAddress.trim().length > 0 && form.region.trim().length > 0
	}, [form])

	async function onSave() {
		try {
			setSaving(true)
			await salesService.upsertBeneficiary({
				saleId,
				actorUserId,
				mode: replaceMode ? 'replace' : 'save',
				beneficiary: {
					fullName: form.fullName.trim(),
					rut: form.rut.trim() || undefined,
					serviceAddress: form.serviceAddress.trim(),
					region: form.region.trim(),
				},
			})
			alerts.success(replaceMode ? 'Beneficiario reemplazado' : 'Beneficiario guardado')
			setReplaceMode(false)
		} catch {
			alerts.error('No se pudo guardar el beneficiario')
		} finally {
			setSaving(false)
		}
	}

	return (
		<Card>
			<CardHeader className="p-4">
				<div className="flex items-center justify-between gap-3">
					<div>
						<div className="text-sm font-semibold">Beneficiario</div>
						<div className="text-xs text-slate-500">Obligatorio antes de cerrar · Define región del servicio</div>
					</div>
					<div className="flex items-center gap-2">
						{beneficiary ? (
							<Button
								variant={replaceMode ? 'default' : 'ghost'}
								disabled={saving}
								onClick={() => {
									if (!beneficiary) return
									if (!replaceMode) {
										setReplaceMode(true)
										alerts.warning('Modo reemplazo: al guardar se registra EVENT replaced')
									} else {
										setReplaceMode(false)
									}
								}}
							>
								{replaceMode ? 'Reemplazo activo' : 'Reemplazar'}
							</Button>
						) : null}
						<Button variant="secondary" disabled={!canSave || saving} onClick={onSave}>
							{saving ? 'Guardando…' : 'Guardar'}
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent className="p-4">
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div className="space-y-2">
						<Label>Nombre completo</Label>
						<Input value={form.fullName} onChange={(e) => setForm((s) => ({ ...s, fullName: e.target.value }))} />
					</div>
					<div className="space-y-2">
						<Label>RUT</Label>
						<Input value={form.rut} onChange={(e) => setForm((s) => ({ ...s, rut: e.target.value }))} />
					</div>
					<div className="space-y-2 md:col-span-2">
						<Label>Dirección de servicio</Label>
						<Input
							value={form.serviceAddress}
							onChange={(e) => setForm((s) => ({ ...s, serviceAddress: e.target.value }))}
						/>
					</div>
					<div className="space-y-2">
						<Label>Región</Label>
						<Input value={form.region} onChange={(e) => setForm((s) => ({ ...s, region: e.target.value }))} />
					</div>
				</div>
			</CardContent>
		</Card>
	)
}
