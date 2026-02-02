import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader } from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Button } from '../../components/ui/button'
import { useRecentEvents } from '../../hooks/useEvents'
import { useClientsByIds, useSales } from '../../hooks/useSales'
import type { SaleStatus } from '../../models/Sale'
import type { Sale } from '../../models/Sale'
import { getCloseSaleReadiness } from '../../services/sales.service'
import { buildExecutiveReport } from '../../services/executiveReport.service'
import type { ExecutiveReport, BlockedSaleReason } from '../../models/ExecutiveReport'
import logoUrl from '../../img/logonew.png'
import { downloadExecutiveReportPdf, type ExecutivePdfVariant } from '../../utils/executiveReportPdf'
import { firestoreDb } from '../../services/firebase'
import { collection, getDocs, limit, query, where } from 'firebase/firestore'
import { makeFolio } from '../../utils/folio'
import { saleStatusLabel } from '../../utils/labels'

function endOfLocalDay(d: Date) {
  const out = new Date(d)
  out.setHours(23, 59, 59, 999)
  return out
}

function startOfLocalDay(d: Date) {
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  return out
}

function addDays(d: Date, days: number) {
  const out = new Date(d)
  out.setDate(out.getDate() + days)
  return out
}

function Sparkline({ values }: { values: number[] }) {
  const width = 110
  const height = 34
  const paddingX = 2
  const paddingY = 2

  const safe = values.length > 0 ? values : [0]
  const min = Math.min(...safe)
  const max = Math.max(...safe)
  const span = max - min
  const denom = span === 0 ? 1 : span

  const stepX = safe.length === 1 ? 0 : (width - paddingX * 2) / (safe.length - 1)
  const points = safe.map((v, i) => {
    const x = paddingX + i * stepX
    const t = (v - min) / denom
    const y = paddingY + (1 - t) * (height - paddingY * 2)
    return { x, y }
  })

  const lineD = points
    .map((p, idx) => (idx === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(' ')
  const areaD = `${lineD} L ${paddingX + (safe.length - 1) * stepX} ${height - paddingY} L ${paddingX} ${
    height - paddingY
  } Z`

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-8 w-28" aria-hidden="true">
      <path d={areaD} fill="currentColor" opacity={0.12} />
      <path d={lineD} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function navigateToSaleDetail(saleId: string, status: SaleStatus) {
  // The app uses internal sections; use hash as a lightweight route.
  if (status === 'lead') {
    window.location.hash = `leads/${saleId}`
    return
  }
  window.location.hash = `sales/${saleId}`
}

function isSaleStatus(value: string): value is SaleStatus {
  return value === 'lead' || value === 'in_progress' || value === 'closed' || value === 'archived'
}

function toHumanBlockedReason(reason: BlockedSaleReason) {
  switch (reason) {
    case 'CONTRACT_NOT_SIGNED':
      return 'Contrato pendiente de firma'
    case 'PAYMENT_PENDING':
      return 'Pago pendiente'
    case 'BENEFICIARY_REQUIRED':
      return 'Falta registrar beneficiario'
    case 'INCOMPLETE_DATA':
      return 'Datos incompletos'
    default:
      return reason
  }
}

type ExecutiveTimelineEvent = { type: string; date: Date }
type ExecutiveTimelineEventView = { label: string; date: Date; count: number }

function mapExecutiveEventTypeToNarrative(type: string): { label: string; groupKey: string } | null {
  // IMPORTANT: UI-only mapping. Never show system entity/field names.
  // Filter out purely financial/technical noise.

  if (type.startsWith('COMMERCIAL.')) return null

  if (type.startsWith('CLIENT.')) {
    return { label: 'Datos del cliente registrados/actualizados', groupKey: 'client' }
  }

  if (type.startsWith('BENEFICIARY.')) {
    return { label: 'Beneficiario registrado/actualizado', groupKey: 'beneficiary' }
  }

  if (type === 'SALE.status') {
    return { label: 'Estado de la venta actualizado', groupKey: 'sale_status' }
  }

  if (type === 'SALE.plan' || type === 'SALE.modality' || type === 'SALE.serviceRegion') {
    return { label: 'Configuración del servicio actualizada', groupKey: 'sale_setup' }
  }

  if (type === 'SALE.paymentStatus') {
    return { label: 'Estado de pago actualizado', groupKey: 'payment_status' }
  }

  if (type.startsWith('STEP.')) {
    // The report engine intentionally emits a simplified event type (no step kind).
    // Keep it high-level and business-friendly.
    return { label: 'Avance en pasos operativos', groupKey: 'steps' }
  }

  if (type.startsWith('SALE.')) {
    return { label: 'Información de la venta actualizada', groupKey: 'sale_misc' }
  }

  return null
}

function buildExecutiveTimelineNarrative(events: ExecutiveTimelineEvent[]): ExecutiveTimelineEventView[] {
  const sorted = [...events].sort((a, b) => a.date.getTime() - b.date.getTime())
  const mapped = sorted
    .map((e) => {
      const m = mapExecutiveEventTypeToNarrative(e.type)
      if (!m) return null
      return { ...e, label: m.label, groupKey: m.groupKey }
    })
    .filter((x): x is { type: string; date: Date; label: string; groupKey: string } => Boolean(x))

  // Reduce noise: group consecutive events of same business meaning within a short window.
  const windowMs = 45 * 60 * 1000 // 45 minutes
  const out: ExecutiveTimelineEventView[] = []

  for (const e of mapped) {
    const prev = out[out.length - 1]
    if (!prev) {
      out.push({ label: e.label, date: e.date, count: 1 })
      continue
    }

    // Group if same label and close in time.
    if (prev.label === e.label && Math.abs(e.date.getTime() - prev.date.getTime()) <= windowMs) {
      prev.count += 1
      // Keep the latest timestamp in the group (reads better as a narrative checkpoint).
      prev.date = e.date
      continue
    }

    out.push({ label: e.label, date: e.date, count: 1 })
  }

  return out
}

function formatDateInputValue(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseDateInputValue(value: string): Date | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parts = trimmed.split('-')
  if (parts.length !== 3) return null
  const y = Number(parts[0])
  const m = Number(parts[1])
  const d = Number(parts[2])
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null
  const dt = new Date(y, m - 1, d)
  if (Number.isNaN(dt.getTime())) return null
  return dt
}

function MetricCard({
  title,
  value,
  subtitle,
  tone = 'default',
}: {
  title: string
  value: string
  subtitle?: string
  tone?: 'default' | 'danger' | 'success'
}) {
  const toneClass =
    tone === 'danger'
      ? 'border-rose-200 bg-rose-50'
      : tone === 'success'
        ? 'border-emerald-200 bg-emerald-50'
        : 'border-slate-200 bg-white'

  return (
    <div className={`rounded-2xl border ${toneClass} p-4 shadow-sm`}>
      <div className="text-xs text-slate-500">{title}</div>
      <div className="mt-1 text-3xl font-semibold text-slate-900">{value}</div>
      {subtitle ? <div className="mt-1 text-xs text-slate-600">{subtitle}</div> : null}
    </div>
  )
}

function ExecutiveKpiCard({
  title,
  value,
  loading,
  series,
  accentClassName,
}: {
  title: string
  value: number
  loading: boolean
  series: number[]
  accentClassName: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex items-end justify-between gap-4">
      <div className="min-w-0">
        <div className="text-xs text-slate-500">{title}</div>
        <div className="mt-1 text-3xl font-semibold text-slate-900">{loading ? '…' : value}</div>
      </div>
      <div className={accentClassName}>
        <Sparkline values={series} />
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { sales, loading } = useSales()
  const { events: recentEvents } = useRecentEvents(500)

  const [reportFrom, setReportFrom] = useState(() => formatDateInputValue(addDays(new Date(), -30)))
  const [reportTo, setReportTo] = useState(() => formatDateInputValue(new Date()))
  const [executiveReportLoading, setExecutiveReportLoading] = useState(false)
  const [executiveReportError, setExecutiveReportError] = useState<string | null>(null)
  const [executiveReport, setExecutiveReport] = useState<ExecutiveReport | null>(null)

  const [exportOpen, setExportOpen] = useState(false)
  const [exportVariant, setExportVariant] = useState<ExecutivePdfVariant>('summary')
  const [exportingPdf, setExportingPdf] = useState(false)

  const [readinessLoading, setReadinessLoading] = useState(false)
  const [readinessError, setReadinessError] = useState<string | null>(null)
  const [readinessBySaleId, setReadinessBySaleId] = useState<
    Record<string, ReturnType<typeof getCloseSaleReadiness>>
  >({})
	const [closeFactsBySaleId, setCloseFactsBySaleId] = useState<
		Record<string, { beneficiaryExists: boolean; contractStatus: string | undefined }>
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
			const nextFacts: Record<string, { beneficiaryExists: boolean; contractStatus: string | undefined }> = {}
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
			const contractStatus = contract?.status ? String(contract.status) : undefined

			nextFacts[sale.id] = { beneficiaryExists, contractStatus }

          next[sale.id] = getCloseSaleReadiness({
            sale: sale as unknown as Sale,
            beneficiaryExists,
            contractSigned,
          })
        }

        if (!alive) return
        setReadinessBySaleId(next)
			setCloseFactsBySaleId(nextFacts)
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[DashboardPage] failed to compute close readiness', err)
        if (!alive) return
        setReadinessError('No se pudo calcular el estado de cierre. Intenta recargar.')
        setReadinessBySaleId({})
			setCloseFactsBySaleId({})
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

  const dayEnds = useMemo(() => {
    const days = 7
    const today = new Date()
    const start = addDays(today, -(days - 1))
    const out: Date[] = []
    for (let i = 0; i < days; i += 1) out.push(endOfLocalDay(addDays(start, i)))
    return out
  }, [])

  const eventsBySaleId = useMemo(() => {
    const map = new Map<string, typeof recentEvents>()
    for (const e of recentEvents) {
      if (!e.saleId) continue
      const list = map.get(e.saleId)
      if (list) list.push(e)
      else map.set(e.saleId, [e])
    }
    // Keep each list sorted desc by createdAt (already in recentEvents order, but be safe).
    for (const [k, list] of map.entries()) {
      list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      map.set(k, list)
    }
    return map
  }, [recentEvents])

  const statusEvents = useMemo(
    () => recentEvents.filter((e) => e.entity === 'SALE' && e.field === 'status' && e.newValue),
    [recentEvents],
  )

  const executiveTrends = useMemo(() => {
    const msHour = 1000 * 60 * 60

    const inProgressTrend = dayEnds.map((end) => {
      let count = inProgressSales.length
      for (const e of statusEvents) {
        if (e.createdAt <= end) continue
        if (e.newValue === 'in_progress') count -= 1
        else if (e.previousValue === 'in_progress') count += 1
      }
      return Math.max(0, count)
    })

    function getSaleValueAtDayEnd(input: {
      saleId: string
      currentValue: string | undefined
      entity: 'SALE' | 'STEP'
      field: string
      dayEnd: Date
      commentEquals?: string
    }) {
      const list = eventsBySaleId.get(input.saleId) ?? []
      let value = input.currentValue
      for (const e of list) {
        if (e.createdAt <= input.dayEnd) break
        if (e.entity !== input.entity) continue
        if (e.field !== input.field) continue
        if (input.commentEquals && (e.comment ?? '') !== input.commentEquals) continue
        value = e.previousValue
      }
      const s = (value ?? '').trim()
      return s.length === 0 ? undefined : s
    }

    function beneficiaryExistsAtDayEnd(saleId: string, dayEnd: Date) {
      const facts = closeFactsBySaleId[saleId]
      if (!facts?.beneficiaryExists) return false
      const list = eventsBySaleId.get(saleId) ?? []
      const creation = list.find((e) => e.entity === 'BENEFICIARY' && (e.comment ?? '') === 'Creación de beneficiario')
      if (!creation) return true
      return creation.createdAt <= dayEnd
    }

    function contractSignedAtDayEnd(saleId: string, dayEnd: Date) {
      const facts = closeFactsBySaleId[saleId]
      const currentStatus = facts?.contractStatus
      const statusAt = getSaleValueAtDayEnd({
        saleId,
        currentValue: currentStatus,
        entity: 'STEP',
        field: 'status',
        dayEnd,
        commentEquals: 'Paso CONTRACT',
      })
      return statusAt === 'SIGNED'
    }

    const readyTrend: number[] = []
    const blockedTrend: number[] = []
    const alertsTrend: number[] = []

    for (const end of dayEnds) {
      let ready = 0
      let blocked = 0
      let alerts = 0

      for (const s of inProgressSales) {
        const planAt = getSaleValueAtDayEnd({
          saleId: s.id,
          currentValue: s.plan ? String(s.plan) : undefined,
          entity: 'SALE',
          field: 'plan',
          dayEnd: end,
        })
        const modalityAt = getSaleValueAtDayEnd({
          saleId: s.id,
          currentValue: s.modality ? String(s.modality) : undefined,
          entity: 'SALE',
          field: 'modality',
          dayEnd: end,
        })

        const beneficiaryExists = beneficiaryExistsAtDayEnd(s.id, end)
        const contractSigned = contractSignedAtDayEnd(s.id, end)

        const readiness = getCloseSaleReadiness({
          sale: ({ ...s, plan: planAt as any, modality: modalityAt as any } as unknown as Sale),
          beneficiaryExists,
          contractSigned,
        })

        if (readiness.canClose) ready += 1
        else blocked += 1

        // Active alerts approximation at that day end (>= 24h since last event at/before day end).
        const list = eventsBySaleId.get(s.id) ?? []
        let lastAt: Date | undefined
        for (const e of list) {
          if (e.createdAt <= end) {
            lastAt = e.createdAt
            break
          }
        }
        const fallback = s.createdAt
        const base = lastAt ?? fallback
        if (base) {
          const hours = (end.getTime() - base.getTime()) / msHour
          if (hours >= 24) alerts += 1
        }
      }

      readyTrend.push(ready)
      blockedTrend.push(blocked)
      alertsTrend.push(alerts)
    }

    return {
      inProgressTrend,
      readyTrend,
      blockedTrend,
      alertsTrend,
    }
  }, [dayEnds, inProgressSales, statusEvents, eventsBySaleId, closeFactsBySaleId])

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <ExecutiveKpiCard
              title="Ventas en progreso"
              value={executive.inProgress}
              loading={loading}
              series={executiveTrends.inProgressTrend}
              accentClassName="text-sky-600"
            />
            <ExecutiveKpiCard
              title="Bloqueadas"
              value={executive.blocked}
              loading={loading || readinessLoading}
              series={executiveTrends.blockedTrend}
              accentClassName="text-rose-500"
            />
            <ExecutiveKpiCard
              title="Listas para cerrar"
              value={executive.ready}
              loading={loading || readinessLoading}
              series={executiveTrends.readyTrend}
              accentClassName="text-emerald-600"
            />
            <ExecutiveKpiCard
              title="Alertas activas (aprox.)"
              value={activeAlertsCount}
              loading={loading}
              series={executiveTrends.alertsTrend}
              accentClassName="text-amber-600"
            />
          </div>

          {readinessError ? <div className="mt-3 text-sm text-slate-600">{readinessError}</div> : null}

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-medium text-slate-900">
              Ventas que no pueden cerrarse aún: {loading || readinessLoading ? '…' : executive.blocked}
            </div>
            <div className="mt-1 text-xs text-slate-600">
              Estas ventas no pueden cerrarse todavía porque falta completar pasos administrativos clave.
            </div>

            <div className="mt-3 text-xs font-medium text-slate-700">Principales causas:</div>
            <div className="mt-2 text-xs text-slate-600 space-y-1">
              <div>
                • Contrato pendiente de firma ({loading || readinessLoading ? '…' : executive.byPrimaryBlocker.CONTRACT_NOT_SIGNED ?? 0} ventas)
              </div>
              <div>
                • Beneficiario no registrado ({loading || readinessLoading ? '…' : executive.byPrimaryBlocker.BENEFICIARY_REQUIRED ?? 0} ventas)
              </div>
              <div>
                • Datos obligatorios incompletos ({loading || readinessLoading ? '…' : executive.byPrimaryBlocker.SALE_INCOMPLETE ?? 0} ventas)
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="text-sm font-semibold">Informe Ejecutivo</div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-medium text-slate-900">Rango</div>
              <div className="mt-1 text-xs text-slate-600">Selecciona un rango de fechas y emite el informe.</div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Fecha desde</Label>
                  <Input type="date" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Fecha hasta</Label>
                  <Input type="date" value={reportTo} onChange={(e) => setReportTo(e.target.value)} />
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="text-xs text-slate-600">
                  <span className="font-medium text-slate-900">Rango seleccionado:</span>{' '}
                  {reportFrom || '—'} → {reportTo || '—'}
                </div>
              </div>

              <div className="mt-4">
                <Button
                  className="w-full"
                  disabled={!reportFrom || !reportTo || executiveReportLoading}
                  onClick={async () => {
                    const fromRaw = parseDateInputValue(reportFrom)
                    const toRaw = parseDateInputValue(reportTo)
                    if (!fromRaw || !toRaw) return

                    const from = startOfLocalDay(fromRaw)
                    const to = endOfLocalDay(toRaw)

                    setExecutiveReportError(null)
                    setExecutiveReportLoading(true)
                    try {
                      const report = await buildExecutiveReport({ from, to })
                      setExecutiveReport(report)
                      setExportVariant('summary')
                      setExportOpen(true)
                    } catch (err) {
                      // eslint-disable-next-line no-console
                      console.error('[DashboardPage] buildExecutiveReport failed', err)
                      setExecutiveReport(null)
                      setExecutiveReportError('No se pudo emitir el informe. Intenta nuevamente.')
                    } finally {
                      setExecutiveReportLoading(false)
                    }
                  }}
                >
                  {executiveReportLoading ? 'Emitiendo…' : 'Emitir informe ejecutivo'}
                </Button>
                {executiveReportError ? <div className="mt-2 text-sm text-rose-600">{executiveReportError}</div> : null}
              </div>
            </div>

            <div className="lg:col-span-2 space-y-4">
              {!executiveReport ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                  <div className="text-sm font-medium text-slate-900">Aún no hay informe emitido</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Selecciona un rango y presiona “Emitir informe ejecutivo”.
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <MetricCard
                      title="Leads creados"
                      value={String(executiveReport.summary.leadsCreated)}
                      subtitle="Nuevos leads en el rango"
                    />
                    <MetricCard
                      title="Leads caídos (%)"
                      value={String(executiveReport.summary.leadsDropped)}
                      subtitle={`${Math.round(executiveReport.summary.leadsDropRate * 100)}% del total creado`}
                      tone={executiveReport.summary.leadsDropRate >= 0.2 ? 'danger' : 'default'}
                    />
                    <MetricCard
                      title="Ventas ingresadas"
                      value={String(executiveReport.summary.salesCreated)}
                      subtitle="Conversiones a venta"
                    />
                    <MetricCard
                      title="Ventas cerradas"
                      value={String(executiveReport.summary.salesClosed)}
                      subtitle="Cierres en el rango"
                      tone={executiveReport.summary.salesClosed > 0 ? 'success' : 'default'}
                    />
                    <MetricCard
                      title="Ventas trabadas"
                      value={String(executiveReport.summary.salesBlocked)}
                      subtitle="Bloqueadas al cierre del rango"
                      tone={executiveReport.summary.salesBlocked > 0 ? 'danger' : 'default'}
                    />
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="text-sm font-medium text-slate-900">Funnel</div>
                    <div className="mt-1 text-xs text-slate-600">Leads → Ventas → Cerradas</div>

                    <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="flex-1">
                        <div className="text-xs text-slate-500">Leads</div>
                        <div className="text-2xl font-semibold text-slate-900">{executiveReport.funnel.leads}</div>
                      </div>
                      <div className="text-slate-400 text-xl">→</div>
                      <div className="flex-1">
                        <div className="text-xs text-slate-500">Ventas</div>
                        <div className="text-2xl font-semibold text-slate-900">{executiveReport.funnel.sales}</div>
                      </div>
                      <div className="text-slate-400 text-xl">→</div>
                      <div className="flex-1">
                        <div className="text-xs text-slate-500">Cerradas</div>
                        <div className="text-2xl font-semibold text-slate-900">{executiveReport.funnel.closed}</div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium text-slate-900">Ventas trabadas</div>
                        <div className="mt-1 text-xs text-slate-600">
                          Diagnóstico al cierre del rango seleccionado (sin montos, solo operacional).
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-500">Total</div>
                        <div className="text-2xl font-semibold text-slate-900">{executiveReport.blockedSales.total}</div>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      {executiveReport.blockedSales.reasons
                        .filter((r) => r.count > 0)
                        .sort((a, b) => b.count - a.count)
                        .map((r) => (
                          <div
                            key={r.reason}
                            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between gap-4"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-slate-900">{toHumanBlockedReason(r.reason)}</div>
                              <div className="text-xs text-slate-600">
                                Promedio: {Math.round(r.averageDaysBlocked * 10) / 10} días
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-slate-500">Ventas</div>
                              <div className="text-xl font-semibold text-slate-900">{r.count}</div>
                            </div>
                          </div>
                        ))}

                      {executiveReport.blockedSales.reasons.every((r) => r.count === 0) ? (
                        <div className="text-sm text-slate-600">Sin ventas trabadas en el rango.</div>
                      ) : null}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {executiveReport ? (
            <div className="mt-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Timeline de ventas</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Eventos del rango seleccionado. Click en una venta para abrir el detalle.
                  </div>
                </div>
                <div className="text-xs text-slate-500">{executiveReport.salesTimeline.length} ventas</div>
              </div>

              <div className="mt-4 space-y-3">
                {(() => {
                  const items = [...executiveReport.salesTimeline]
                  items.sort((a, b) => {
                    const aFirst = a.events[0]?.date?.getTime() ?? Number.MAX_SAFE_INTEGER
                    const bFirst = b.events[0]?.date?.getTime() ?? Number.MAX_SAFE_INTEGER
                    return aFirst - bFirst
                  })
                  return items
                })().map((item) => {
                  const status = isSaleStatus(item.currentStatus) ? item.currentStatus : 'in_progress'
                  const narrative = buildExecutiveTimelineNarrative(item.events as ExecutiveTimelineEvent[])
                  const show = narrative.slice(0, 8)
                  const remaining = Math.max(0, narrative.length - show.length)
                  return (
                    <button
                      key={item.saleId}
                      type="button"
                      onClick={() => navigateToSaleDetail(item.saleId, status)}
                      className={
                        'w-full text-left rounded-2xl border bg-white p-4 shadow-sm ' +
                        'border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors'
                      }
                      title="Abrir detalle"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900">
                            {makeFolio('Venta', item.saleId) ?? item.saleId}
                          </div>
                          <div className="mt-1 text-sm text-slate-700 truncate">{item.customerName || 'Cliente'}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-slate-500">Estado actual</div>
                          <div className="text-sm font-medium text-slate-900">{saleStatusLabel(item.currentStatus)}</div>
                          {item.blockedReason ? (
                            <div className="mt-1 text-xs text-rose-600">{toHumanBlockedReason(item.blockedReason)}</div>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="text-xs font-medium text-slate-700">Eventos</div>
                        <div className="mt-2 space-y-1">
                          {show.length === 0 ? (
                            <div className="text-sm text-slate-600">Sin eventos en el rango.</div>
                          ) : (
                            show.map((e, idx) => (
                              <div key={`${item.saleId}_${idx}`} className="flex items-start justify-between gap-4">
                                <div className="text-sm text-slate-800 min-w-0 truncate">
                                  {e.label}
                                  {e.count > 1 ? <span className="text-slate-500"> ({e.count})</span> : null}
                                </div>
                                <div className="text-xs text-slate-500 whitespace-nowrap">{e.date.toLocaleString()}</div>
                              </div>
                            ))
                          )}
                          {remaining > 0 ? (
                            <div className="text-xs text-slate-500">… +{remaining} eventos</div>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          {exportOpen ? (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
              aria-label="Exportar informe a PDF"
            >
              <button
                type="button"
                className="absolute inset-0 bg-slate-900/40"
                onClick={() => {
                  if (exportingPdf) return
                  setExportOpen(false)
                }}
                aria-label="Cerrar"
              />

              <div className="relative w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-xl">
                <div className="p-5">
                  <div className="text-sm font-semibold text-slate-900">Exportación a PDF</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Genera un documento ejecutivo (no es una captura del dashboard). Usa el rango y datos ya calculados.
                  </div>

                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs text-slate-500">Rango del informe</div>
                    <div className="mt-1 text-sm font-medium text-slate-900">
                      {reportFrom || '—'} → {reportTo || '—'}
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="text-xs font-medium text-slate-700">Variante</div>

                    <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 cursor-pointer hover:bg-slate-50">
                      <input
                        type="radio"
                        name="pdf_variant"
                        value="summary"
                        checked={exportVariant === 'summary'}
                        onChange={() => setExportVariant('summary')}
                        className="mt-1"
                      />
                      <div>
                        <div className="text-sm font-medium text-slate-900">Informe resumido</div>
                        <div className="text-sm text-slate-600">
                          Portada, resumen ejecutivo, KPIs, funnel y diagnóstico de bloqueos (2–3 páginas).
                        </div>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 cursor-pointer hover:bg-slate-50">
                      <input
                        type="radio"
                        name="pdf_variant"
                        value="detailed"
                        checked={exportVariant === 'detailed'}
                        onChange={() => setExportVariant('detailed')}
                        className="mt-1"
                      />
                      <div>
                        <div className="text-sm font-medium text-slate-900">Informe detallado</div>
                        <div className="text-sm text-slate-600">
                          Incluye el resumido + detalle por venta con estado, bloqueo y timeline narrativo.
                        </div>
                      </div>
                    </label>
                  </div>

                  <div className="mt-5 flex items-center justify-end gap-2">
                    <Button
                      variant="secondary"
                      disabled={exportingPdf}
                      onClick={() => {
                        if (exportingPdf) return
                        setExportOpen(false)
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      disabled={!executiveReport || exportingPdf}
                      onClick={async () => {
                        if (!executiveReport) return
                        setExportingPdf(true)
                        try {
                          await downloadExecutiveReportPdf({
                            report: executiveReport,
                            variant: exportVariant,
                            logoUrl,
                          })
                          setExportOpen(false)
                        } catch (err) {
                          // eslint-disable-next-line no-console
                          console.error('[DashboardPage] export PDF failed', err)
                          setExecutiveReportError('No se pudo generar el PDF. Intenta nuevamente.')
                        } finally {
                          setExportingPdf(false)
                        }
                      }}
                    >
                      {exportingPdf ? 'Generando…' : 'Descargar PDF'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
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
                  const canNavigate = s.status === 'in_progress' || s.status === 'lead'
                  return (
                    <button
                      key={s.id}
                      type="button"
                      disabled={!canNavigate}
                      onClick={() => navigateToSaleDetail(s.id, s.status)}
                      className={
                        'w-full text-left rounded-xl border bg-white p-3 ' +
                        (canNavigate
                          ? 'cursor-pointer border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors'
                          : 'cursor-default border-slate-200 opacity-80')
                      }
                      title={
                        canNavigate
                          ? 'Abrir detalle de la venta'
                          : 'Detalle disponible solo para Leads o Ventas en progreso'
                      }
                    >
                      <div className="text-sm font-medium text-slate-900">{clientName}</div>
                      <div className="text-xs text-slate-600">
                        {makeFolio('Venta', s.id) ?? 'Venta'} · Estado: {saleStatusLabel(s.status)} · Plan: {s.plan ?? '—'} · Modalidad: {s.modality ?? '—'}
                      </div>
                      <div className="text-xs text-slate-500">Último evento: {last ? last.toLocaleString() : '—'}</div>
                    </button>
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
                  <button
                    key={e.id}
                    type="button"
                    disabled={!e.saleId}
                    onClick={() => (e.saleId ? navigateToSaleDetail(e.saleId, 'in_progress') : undefined)}
                    className={
                      'w-full text-left rounded-xl border bg-white p-3 ' +
                      (e.saleId
                        ? 'cursor-pointer border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors'
                        : 'cursor-default border-slate-200 opacity-80')
                    }
                    title={e.saleId ? 'Abrir detalle de la venta' : 'Venta no disponible'}
                  >
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
                  </button>
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
