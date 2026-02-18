import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { useUserProfile } from '../../hooks/useUserProfile'
import { usePaidSales } from '../../hooks/usePaidSales'
import { paidSaleBadgeLabel } from '../../utils/paidSales'
import { formatClp } from '../../utils/currency'
import mistatasLogo from '../../img/logonew.png'
import { downloadPaidSalesPdf } from '../../utils/paidSalesPdf'

function formatDateDmy(d: Date | undefined): string {
	if (!d) return '—'
	const dd = String(d.getDate()).padStart(2, '0')
	const mm = String(d.getMonth() + 1).padStart(2, '0')
	const yyyy = String(d.getFullYear())
	return `${dd}-${mm}-${yyyy}`
}

function toDateOrUndefined(value: string): Date | undefined {
	if (!value) return undefined
	// value is YYYY-MM-DD
	const [y, m, d] = value.split('-').map(Number)
	if (!y || !m || !d) return undefined
	const dt = new Date(y, m - 1, d)
	return Number.isFinite(dt.getTime()) ? dt : undefined
}

export function PaidSalesPage() {
	const { canAccessPaidSales, loading: authzLoading } = useUserProfile()

	const [fromRaw, setFromRaw] = useState('')
	const [toRaw, setToRaw] = useState('')
	const from = useMemo(() => toDateOrUndefined(fromRaw), [fromRaw])
	const to = useMemo(() => toDateOrUndefined(toRaw), [toRaw])

	const { sales, loading, error } = usePaidSales({ from, to })

	const totals = useMemo(() => {
		let annual = 0
		let monthly = 0
		for (const s of sales) {
			if (s.amount.period === 'ANNUAL') annual += s.amount.value
			else monthly += s.amount.value
		}
		return { annual, monthly }
	}, [sales])

	if (authzLoading) {
		return (
			<div className="p-6">
				<Card>
					<CardHeader>
						<div className="text-sm font-semibold">Ventas Pagadas</div>
					</CardHeader>
					<CardContent>
						<div className="text-sm text-slate-600">Cargando permisos…</div>
					</CardContent>
				</Card>
			</div>
		)
	}

	if (!canAccessPaidSales) {
		return (
			<div className="p-6">
				<Card>
					<CardHeader>
						<div className="text-sm font-semibold">Acceso restringido</div>
					</CardHeader>
					<CardContent>
						<div className="text-sm text-slate-600">
							Este módulo está disponible para usuarios activos con rol autorizado.
						</div>
					</CardContent>
				</Card>
			</div>
		)
	}

	return (
		<div className="p-6 space-y-6">
			<div className="flex items-start justify-between gap-4 flex-wrap">
				<div>
					<div className="text-2xl font-semibold">Ventas Pagadas</div>
					<div className="text-sm text-slate-600">Contabilidad: listado + exportación PDF (solo ventas con pago efectivo)</div>
				</div>

				<div className="flex items-center gap-2">
					<Button
						variant="secondary"
						disabled={loading || sales.length === 0}
						onClick={async () => {
							await downloadPaidSalesPdf({ sales, logoUrl: mistatasLogo })
						}}
					>
						Exportar PDF
					</Button>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
				<Card>
					<CardHeader>
						<div className="text-xs text-slate-600">Total de ventas visibles</div>
						<div className="text-2xl font-semibold">{loading ? '…' : sales.length}</div>
					</CardHeader>
				</Card>
				<Card>
					<CardHeader>
						<div className="text-xs text-slate-600">Total anual visible</div>
						<div className="text-2xl font-semibold">{loading ? '…' : `${formatClp(totals.annual)} CLP`}</div>
					</CardHeader>
				</Card>
				<Card>
					<CardHeader>
						<div className="text-xs text-slate-600">Total mensual visible</div>
						<div className="text-2xl font-semibold">{loading ? '…' : `${formatClp(totals.monthly)} CLP`}</div>
					</CardHeader>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<div className="text-sm font-semibold">Filtros</div>
				</CardHeader>
				<CardContent>
					<div className="flex flex-wrap items-end gap-3">
						<div>
							<label className="text-xs text-slate-600">Desde</label>
							<input
								type="date"
								className="mt-1 block h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
								value={fromRaw}
								onChange={(e) => setFromRaw(e.target.value)}
							/>
						</div>
						<div>
							<label className="text-xs text-slate-600">Hasta</label>
							<input
								type="date"
								className="mt-1 block h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
								value={toRaw}
								onChange={(e) => setToRaw(e.target.value)}
							/>
						</div>
						<Button
							variant="secondary"
							onClick={() => {
								setFromRaw('')
								setToRaw('')
							}}
						>
							Limpiar
						</Button>
					</div>
				</CardContent>
			</Card>

			{error ? <div className="text-sm text-red-600">Error: {error}</div> : null}

			{loading ? (
				<div className="text-sm text-slate-600">Cargando ventas pagadas…</div>
			) : sales.length === 0 ? (
				<div className="text-sm text-slate-600">No hay ventas pagadas con los filtros actuales.</div>
			) : (
				<div className="space-y-3">
					{sales.map((s) => (
						<Card key={s.sale_id}>
							<CardHeader>
								<div className="flex items-start justify-between gap-3">
									<div className="min-w-0">
										<div className="text-base font-semibold truncate">{s.client.full_name || 'Cliente'}</div>
										<div className="text-xs text-slate-600">Servicio: {s.service.plan_name || '—'}</div>
									</div>
									<span className="shrink-0 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700">
										{paidSaleBadgeLabel(s.billing_model)}
									</span>
								</div>
							</CardHeader>
							<CardContent>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div className="space-y-1">
										<div className="text-sm font-medium text-slate-900">Bloque financiero</div>
										<div className="text-sm text-slate-700">
											{s.amount.period === 'ANNUAL' ? 'Monto anual' : 'Monto mensual'}: <span className="font-semibold">{formatClp(s.amount.value)} CLP</span>
										</div>
										<div className="text-sm text-slate-700">Pagado el: {formatDateDmy(s.paid_at)}</div>
									</div>

									<div className="space-y-1">
										<div className="text-sm font-medium text-slate-900">Datos tributarios del cliente</div>
										<div className="text-sm text-slate-700">RUT: {s.client.rut || '—'}</div>
										<div className="text-sm text-slate-700">Teléfono: {s.client.phone || '—'}</div>
										<div className="text-sm text-slate-700">Correo: {s.client.email || '—'}</div>
										<div className="text-sm text-slate-700">Dirección: {s.client.address || '—'}</div>
									</div>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</div>
	)
}
