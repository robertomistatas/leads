import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader } from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import { useRecentEvents } from '../../hooks/useEvents'
import { useClientsByIds, useSales } from '../../hooks/useSales'
import type { SaleStatus } from '../../models/Sale'
import type { Sale } from '../../models/Sale'
import { getCloseSaleReadiness } from '../../services/sales.service'
import { firestoreDb } from '../../services/firebase'
import { collection, getDocs, limit, query, where } from 'firebase/firestore'
import { saleErrorMessages } from '@/utils/domainErrorMessages'
import { makeFolio } from '../../utils/folio'
import { saleStatusLabel } from '../../utils/labels'

export function DashboardPage() {
  const { sales, loading } = useSales()
  const { events: recentEvents } = useRecentEvents(500)

  const [readinessLoading, setReadinessLoading] = useState(false)
  const [readinessError, setReadinessError] = useState<string | null>(null)
  const [readinessBySaleId, setReadinessBySaleId] = useState<
    Record<string, ReturnType<typeof getCloseSaleReadiness>>
  >({})

  const saleById = useMemo(() => new Map(sales.map((s) => [s.id, s])), [sales])
  const { clientsById } = useClientsByIds(useMemo(() => sales.map((s) => s.clientId), [sales]))

  const [statusFilter, setStatusFilter] = useState<SaleStatus | 'all'>('all')
  const [planFilter, setPlanFilter] = useState<string>('')

  const latestEventAtBySale = useMemo(() => {
    const map = new Map<string, Date>()
    for (const e of recentEvents) {
      if (!e.saleId) continue
      if (!map.has(e.saleId)) map.set(e.saleId, e.createdAt)
    }
    return map
  }, [recentEvents])

  const filteredSales = useMemo(() => {
    const planQ = planFilter.trim().toLowerCase()
    return sales
      .filter((s) => (statusFilter === 'all' ? true : s.status === statusFilter))
      .filter((s) => (planQ.length === 0 ? true : String(s.plan ?? '').toLowerCase().includes(planQ)))
  }, [sales, statusFilter, planFilter])

  const counts = useMemo(() => {
    const c = { lead: 0, in_progress: 0, closed: 0, archived: 0 }
    for (const s of sales) c[s.status] += 1
    return c
  }, [sales])

  const byPlan = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of sales) {
      if (!s.plan) continue
      const key = String(s.plan)
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [sales])

  const mostSoldPlan = byPlan[0]?.[0] ?? '—'

  const inProgressSales = useMemo(() => sales.filter((s) => s.status === 'in_progress'), [sales])

  useEffect(() => {
    let alive = true

    async function compute() {
      setReadinessError(null)
      if (inProgressSales.length === 0) {
        setReadinessBySaleId({})
        setReadinessLoading(false)
        return
      }

      setReadinessLoading(true)

      try {
        const next: Record<string, ReturnType<typeof getCloseSaleReadiness>> = {}
        const benRef = collection(firestoreDb, 'beneficiaries')
        const stepsRef = collection(firestoreDb, 'sale_steps')

        for (const sale of inProgressSales) {
          if (!alive) return

          // Replicate the same underlying reads used by closeSale (read-only).
          const benQ = query(benRef, where('saleId', '==', sale.id), limit(1))
          const benSnap = await getDocs(benQ)
          const beneficiaryExists = Boolean(benSnap.docs[0])

          const contractQ = query(
            stepsRef,
            where('saleId', '==', sale.id),
            where('type', '==', 'CONTRACT'),
            limit(1),
          )
          const contractSnap = await getDocs(contractQ)
          const contract = contractSnap.docs[0]?.data() as Record<string, unknown> | undefined
          const contractSigned = contract?.status === 'SIGNED'

          next[sale.id] = getCloseSaleReadiness({
            sale: sale as unknown as Sale,
            beneficiaryExists,
            contractSigned,
          })
        }

        if (!alive) return
        setReadinessBySaleId(next)
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[DashboardPage] failed to compute close readiness', err)
        if (!alive) return
        setReadinessError('No se pudo calcular el estado de cierre. Intenta recargar.')
        setReadinessBySaleId({})
      } finally {
        if (!alive) return
        setReadinessLoading(false)
      }
    }

    void compute()
    return () => {
      alive = false
    }
  }, [inProgressSales])

  const executive = useMemo(() => {
    let ready = 0
    let blocked = 0
    const primaryBlockersCount: Record<string, number> = {}

    for (const s of inProgressSales) {
      const readiness = readinessBySaleId[s.id]
      if (!readiness) continue
      if (readiness.canClose) {
        ready += 1
        continue
      }
      blocked += 1
      const primary = readiness.blockers[0] ?? 'SALE_INCOMPLETE'
      primaryBlockersCount[primary] = (primaryBlockersCount[primary] ?? 0) + 1
    }

    return {
      inProgress: inProgressSales.length,
      ready,
      blocked,
      byPrimaryBlocker: primaryBlockersCount as Record<string, number>,
    }
  }, [inProgressSales, readinessBySaleId])

  const activeAlertsCount = useMemo(() => {
    const now = Date.now()
    let count = 0
    for (const s of sales) {
      if (s.status === 'archived' || s.archivedAt) continue
      if (s.status !== 'in_progress') continue
      const last = latestEventAtBySale.get(s.id) ?? s.createdAt
      if (!last) continue
      const hours = (now - last.getTime()) / (1000 * 60 * 60)
      if (hours >= 48) count += 1
      else if (hours >= 24) count += 1
    }
    return count
  }, [sales, latestEventAtBySale])

  const lastConverted = useMemo(() => {
    const list = recentEvents
      .filter((e) => e.entity === 'SALE' && e.field === 'status' && e.newValue === 'in_progress')
      .slice(0, 20)
    return list
  }, [recentEvents])

  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="text-2xl font-semibold">Dashboard</div>
        <div className="text-sm text-slate-600">Métricas runtime (no persistidas)</div>
      </div>

      <Card>
        <CardHeader>
          <div className="text-sm font-semibold">Dashboard Ejecutivo</div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="text-xs text-slate-500">Ventas en progreso</div>
              <div className="text-2xl font-semibold">{loading ? '…' : executive.inProgress}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="text-xs text-slate-500">Listas para cerrar</div>
              <div className="text-2xl font-semibold">{loading || readinessLoading ? '…' : executive.ready}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="text-xs text-slate-500">Bloqueadas</div>
              <div className="text-2xl font-semibold">{loading || readinessLoading ? '…' : executive.blocked}</div>
            </div>
          </div>

          {readinessError ? <div className="mt-3 text-sm text-slate-600">{readinessError}</div> : null}

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-sm font-medium text-slate-900">
              Ventas bloqueadas: {loading || readinessLoading ? '…' : executive.blocked}
            </div>
            <div className="mt-2 text-xs text-slate-600 space-y-1">
              <div>
                • {loading || readinessLoading ? '…' : executive.byPrimaryBlocker.CONTRACT_NOT_SIGNED ?? 0} —{' '}
                {saleErrorMessages.CONTRACT_NOT_SIGNED}
              </div>
              <div>
                • {loading || readinessLoading ? '…' : executive.byPrimaryBlocker.BENEFICIARY_REQUIRED ?? 0} —{' '}
                {saleErrorMessages.BENEFICIARY_REQUIRED}
              </div>
              <div>
                • {loading || readinessLoading ? '…' : executive.byPrimaryBlocker.SALE_INCOMPLETE ?? 0} —{' '}
                {saleErrorMessages.SALE_INCOMPLETE}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-sm font-semibold">Resumen</div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="text-xs text-slate-500">Leads</div>
              <div className="text-2xl font-semibold">{loading ? '…' : counts.lead}</div>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="text-xs text-slate-500">En progreso</div>
              <div className="text-2xl font-semibold">{loading ? '…' : counts.in_progress}</div>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="text-xs text-slate-500">Cerradas</div>
              <div className="text-2xl font-semibold">{loading ? '…' : counts.closed}</div>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="text-xs text-slate-500">Archivadas</div>
              <div className="text-2xl font-semibold">{loading ? '…' : counts.archived}</div>
            </div>
            <div className="rounded-xl border border-slate-200 p-3 md:col-span-2">
              <div className="text-xs text-slate-500">Ventas con alertas activas (aprox.)</div>
              <div className="text-2xl font-semibold">{loading ? '…' : activeAlertsCount}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-sm font-semibold">Filtros</div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <div className="text-xs text-slate-500 mb-1">Estado</div>
              <select
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <option value="all">Todos</option>
                <option value="lead">Lead</option>
                <option value="in_progress">En progreso</option>
                <option value="closed">Cerrada</option>
                <option value="archived">Archivada</option>
              </select>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Plan (contiene)</div>
              <Input value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} placeholder="Ej: FULL" />
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Más vendido</div>
              <div className="h-10 flex items-center rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900">
                {mostSoldPlan}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="text-sm font-semibold">Ventas (filtradas)</div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-slate-600">Cargando…</div>
            ) : filteredSales.length === 0 ? (
              <div className="text-sm text-slate-600">Sin resultados.</div>
            ) : (
              <div className="space-y-2">
                {filteredSales.slice(0, 50).map((s) => {
                  const last = latestEventAtBySale.get(s.id)
                  const clientName = clientsById[s.clientId]?.fullName ?? 'Cliente sin nombre'
                  return (
                    <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="text-sm font-medium text-slate-900">{clientName}</div>
                      <div className="text-xs text-slate-600">
                        {makeFolio('Venta', s.id) ?? 'Venta'} · Estado: {saleStatusLabel(s.status)} · Plan: {s.plan ?? '—'} · Modalidad: {s.modality ?? '—'}
                      </div>
                      <div className="text-xs text-slate-500">Último evento: {last ? last.toLocaleString() : '—'}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="text-sm font-semibold">Últimas 20 conversiones (Lead → En progreso)</div>
          </CardHeader>
          <CardContent>
            {lastConverted.length === 0 ? (
              <div className="text-sm text-slate-600">Sin conversiones recientes (según últimos eventos).</div>
            ) : (
              <div className="space-y-2">
                {lastConverted.map((e) => (
                  <div key={e.id} className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="text-sm font-medium text-slate-900">
                      {(() => {
                        const sale = e.saleId ? saleById.get(e.saleId) : undefined
                        if (!sale) return 'Venta'
                        return clientsById[sale.clientId]?.fullName ?? 'Cliente sin nombre'
                      })()}
                    </div>
                    <div className="text-xs text-slate-600">{e.createdAt.toLocaleString()}</div>
                    {e.saleId ? <div className="text-xs text-slate-600">{makeFolio('Venta', e.saleId) ?? 'Venta'}</div> : null}
                    {e.comment ? <div className="text-xs text-slate-500">{e.comment}</div> : null}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="text-sm font-semibold">Ventas por plan</div>
        </CardHeader>
        <CardContent>
          {byPlan.length === 0 ? (
            <div className="text-sm text-slate-600">Sin datos.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {byPlan.slice(0, 12).map(([plan, count]) => (
                <div key={plan} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-xs text-slate-500">{plan}</div>
                  <div className="text-2xl font-semibold">{count}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
