import { useEffect, useMemo, useState } from 'react'
import type { ClientView } from '../../services/sales.service'
import { salesService } from '../../services/sales.service'
import { useAlerts } from '../../hooks/useAlerts'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader } from '../ui/card'
import { Input } from '../ui/input'
import { Label } from '../ui/label'

type Props = {
	saleId: string
	actorUserId: string
	client: ClientView
}

export function ClientInfoCard({ saleId, actorUserId, client }: Props) {
	const alerts = useAlerts()
	const [saving, setSaving] = useState(false)
	const [form, setForm] = useState({
		fullName: client.fullName ?? '',
		rut: client.rut ?? '',
		phone: client.phone ?? '',
		email: client.email ?? '',
		address: client.address ?? '',
		profession: client.profession ?? '',
		region: client.region ?? '',
	})

	useEffect(() => {
		setForm({
			fullName: client.fullName ?? '',
			rut: client.rut ?? '',
			phone: client.phone ?? '',
			email: client.email ?? '',
			address: client.address ?? '',
			profession: client.profession ?? '',
			region: client.region ?? '',
		})
	}, [client])

	const changed = useMemo(() => {
		return (
			(form.fullName ?? '') !== (client.fullName ?? '') ||
			(form.rut ?? '') !== (client.rut ?? '') ||
			(form.phone ?? '') !== (client.phone ?? '') ||
			(form.email ?? '') !== (client.email ?? '') ||
			(form.address ?? '') !== (client.address ?? '') ||
			(form.profession ?? '') !== (client.profession ?? '') ||
			(form.region ?? '') !== (client.region ?? '')
		)
	}, [form, client])

	async function onSave() {
		try {
			setSaving(true)
			await salesService.updateClient({
				saleId,
				clientId: client.id,
				actorUserId,
				patch: {
					fullName: form.fullName.trim(),
					rut: form.rut.trim() || undefined,
					phone: form.phone.trim() || undefined,
					email: form.email.trim() || undefined,
					address: form.address.trim() || undefined,
					profession: form.profession.trim() || undefined,
					region: form.region.trim() || undefined,
				},
			})
			alerts.success('Cliente actualizado')
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e)
			if (message === 'rut_in_use') alerts.error('Ese RUT ya existe en otro cliente')
			else alerts.error('No se pudo guardar el cliente')
		} finally {
			setSaving(false)
		}
	}

	return (
		<Card>
			<CardHeader className="p-4">
				<div className="flex items-center justify-between gap-3">
					<div>
						<div className="text-sm font-semibold">Información general (Cliente)</div>
						<div className="text-xs text-slate-500">Cada cambio genera un evento</div>
					</div>
					<Button variant="secondary" disabled={!changed || saving} onClick={onSave}>
						{saving ? 'Guardando…' : 'Guardar'}
					</Button>
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
					<div className="space-y-2">
						<Label>Teléfono</Label>
						<Input value={form.phone} onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))} />
					</div>
					<div className="space-y-2">
						<Label>Email</Label>
						<Input value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} />
					</div>
					<div className="space-y-2 md:col-span-2">
						<Label>Dirección</Label>
						<Input value={form.address} onChange={(e) => setForm((s) => ({ ...s, address: e.target.value }))} />
					</div>
					<div className="space-y-2">
						<Label>Profesión</Label>
						<Input value={form.profession} onChange={(e) => setForm((s) => ({ ...s, profession: e.target.value }))} />
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
