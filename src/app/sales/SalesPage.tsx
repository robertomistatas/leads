import { useEffect, useMemo, useRef, useState } from 'react'
import { AccountingPaymentCard, BeneficiaryCard, ClientInfoCard, CommercialTermsCard, ContractedPlanCard, SaleActionsCard, SaleStepsCard } from '../../components/cards'
import { useAuth } from '../../hooks/useAuth'
import { useBeneficiary, useClient, useClientsByIds, useCommercialTerms, useSaleEvents, useSales, useSaleSteps } from '../../hooks/useSales'
import { SaleChecklist } from '../../components/checklist/SaleChecklist'
import { SaleTimeline } from '../../components/timeline/SaleTimeline'
import { computeSaleRuntimeAlerts } from '../../utils/alertRules'
import { useAlerts } from '../../hooks/useAlerts'
import { computeRequiredStepTypes, salesService } from '../../services/sales.service'
import { makeFolio } from '../../utils/folio'
import { saleStatusLabel } from '../../utils/labels'

export function SalesPage({ initialSaleId }: { initialSaleId?: string }) {
  const alerts = useAlerts()
  const { user } = useAuth()
  const { sales, loading } = useSales('in_progress')
  const [selectedSaleId, setSelectedSaleId] = useState<string | undefined>(undefined)
  const [activeTab, setActiveTab] = useState<'resumen' | 'comercial' | 'operacion' | 'historial'>('resumen')
  const selectedSale = useMemo(() => sales.find((s) => s.id === selectedSaleId), [sales, selectedSaleId])

  const { clientsById } = useClientsByIds(useMemo(() => sales.map((s) => s.clientId), [sales]))
  const { events } = useSaleEvents(selectedSaleId)
  const { steps } = useSaleSteps(selectedSaleId)

  const { client } = useClient(selectedSale?.clientId)
  const { beneficiary } = useBeneficiary(selectedSaleId)
  const { terms } = useCommercialTerms(selectedSaleId)

  const requiredTypes = useMemo(() => {
    const region = beneficiary?.region ?? selectedSale?.serviceRegion
    return computeRequiredStepTypes(region)
  }, [beneficiary?.region, selectedSale?.serviceRegion])

  useEffect(() => {
    if (!selectedSaleId || !user) return
    void salesService.ensureSaleStepsForSale({
      saleId: selectedSaleId,
      actorUserId: user.uid,
      serviceRegion: beneficiary?.region ?? selectedSale?.serviceRegion,
    })
  }, [selectedSaleId, user, beneficiary?.region, selectedSale?.serviceRegion])

  useEffect(() => {
    if (!initialSaleId) return
    setSelectedSaleId(initialSaleId)
  }, [initialSaleId])

  useEffect(() => {
    if (!selectedSaleId) return
    setActiveTab('resumen')
  }, [selectedSaleId])

  const shownAlertRef = useRef<Set<string>>(new Set())
  const runtime = useMemo(() => {
    if (!selectedSale) return null
    const missing: string[] = []

    // Cliente
    if (!client?.fullName) missing.push('CLIENT.fullName')
    const hasPhoneOrEmail = Boolean(client?.phone) || Boolean(client?.email)
    if (!hasPhoneOrEmail) missing.push('CLIENT.phone|email')
    if (!client?.region) missing.push('CLIENT.region')

    // Beneficiario
    if (!beneficiary?.fullName) missing.push('BENEFICIARY.fullName')
    if (!beneficiary?.serviceAddress) missing.push('BENEFICIARY.serviceAddress')
    if (!beneficiary?.region) missing.push('BENEFICIARY.region')

    // Venta
    if (!selectedSale.plan) missing.push('SALE.plan')
    if (!selectedSale.modality) missing.push('SALE.modality')

    return computeSaleRuntimeAlerts({
      sale: selectedSale,
      events,
      steps,
      requiredStepTypes: requiredTypes,
      criticalMissingFields: missing,
    })
  }, [selectedSale, events, steps, client, beneficiary, requiredTypes])

  useEffect(() => {
    if (!runtime || runtime.level === 'ok' || !selectedSaleId) return
    if (shownAlertRef.current.has(selectedSaleId)) return
    shownAlertRef.current.add(selectedSaleId)
    if (runtime.level === 'critical') alerts.error(runtime.reasons.join(' · '))
    else alerts.warning(runtime.reasons.join(' · '))
  }, [runtime, selectedSaleId, alerts])

  const progress = useMemo(() => {
    const total = requiredTypes.length
    if (!total) return { done: 0, total: 0, percent: 0 }
    const done = requiredTypes.filter((type) => {
      const step = steps.find((s) => s.type === type)
      return step?.status === 'DONE' || step?.status === 'SIGNED'
    }).length
    return { done, total, percent: Math.round((done / total) * 100) }
  }, [requiredTypes, steps])

  const blockingReason = useMemo(() => {
    if (!runtime || runtime.level === 'ok') return 'Sin bloqueos activos.'
    return runtime.reasons.join(' · ')
  }, [runtime])

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-semibold">Ventas</div>
        <div className="text-sm text-slate-600">Operación + auditoría por venta</div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,7fr)] h-[calc(100vh-220px)] min-h-[520px]">
        <div className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4">
            <div className="text-sm font-semibold">Ventas en progreso ({loading ? '…' : sales.length})</div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            {loading ? (
              <div className="text-sm text-slate-600">Cargando…</div>
            ) : sales.length === 0 ? (
              <div className="text-sm text-slate-600">No hay ventas en progreso.</div>
            ) : (
              <div className="space-y-2">
                {sales.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSelectedSaleId(s.id)
                      window.location.hash = `sales/${s.id}`
                    }}
                    className={
                      'w-full text-left rounded-xl border px-3 py-2 ' +
                      (s.id === selectedSaleId
                        ? 'border-slate-300 bg-slate-50'
                        : 'border-slate-200 hover:bg-slate-50')
                    }
                  >
                    <div className="text-sm font-medium text-slate-900">
                      {clientsById[s.clientId]?.fullName ?? 'Cliente sin nombre'}
                    </div>
                    <div className="text-xs text-slate-600">
                      {makeFolio('Venta', s.id) ?? 'Venta'} · Plan: {s.plan ?? '—'} · Modalidad: {s.modality ?? '—'}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {!selectedSale ? (
          <div className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4">
              <div className="text-sm font-semibold">Detalle</div>
            </div>
            <div className="p-4">
              <div className="text-sm text-slate-600">Selecciona una venta para continuar.</div>
            </div>
          </div>
        ) : !user ? (
          <div className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4">
              <div className="text-sm font-semibold">Detalle</div>
            </div>
            <div className="p-4">
              <div className="text-sm text-slate-600">Cargando sesión…</div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xl font-semibold text-slate-900">{client?.fullName ?? 'Cliente sin nombre'}</div>
                  <div className="text-xs text-slate-600">
                    {makeFolio('Venta', selectedSale.id) ?? 'Venta'} · Estado: {saleStatusLabel(selectedSale.status)}
                  </div>
                </div>
                <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                  {saleStatusLabel(selectedSale.status)}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Motivo bloqueo</div>
                  <div
                    className={
                      'mt-2 text-sm ' +
                      (runtime?.level === 'critical'
                        ? 'text-rose-700'
                        : runtime?.level === 'warning'
                          ? 'text-amber-700'
                          : 'text-slate-700')
                    }
                  >
                    {blockingReason}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Progreso</div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-2 w-full rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-slate-900"
                        style={{ width: `${progress.percent}%` }}
                      />
                    </div>
                    <div className="text-xs text-slate-600">
                      {progress.done}/{progress.total}
                    </div>
                  </div>
                </div>
              </div>

              <SaleActionsCard sale={selectedSale} steps={steps} beneficiary={beneficiary} actorUserId={user.uid} mode="inline" />

              <div className="flex flex-wrap gap-2">
                {([
                  { key: 'resumen', label: 'Resumen' },
                  { key: 'comercial', label: 'Comercial' },
                  { key: 'operacion', label: 'Operación' },
                  { key: 'historial', label: 'Historial' },
                ] as const).map((tab) => {
                  const isActive = activeTab === tab.key
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={
                        'rounded-full px-4 py-2 text-sm font-medium transition ' +
                        (isActive ? 'bg-slate-900 text-white' : 'border border-slate-200 text-slate-700 hover:bg-slate-50')
                      }
                    >
                      {tab.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              <div className="space-y-6">
                {activeTab === 'resumen' ? (
                  <>
                    {client ? <ClientInfoCard saleId={selectedSale.id} actorUserId={user.uid} client={client} /> : null}
                    <BeneficiaryCard saleId={selectedSale.id} actorUserId={user.uid} beneficiary={beneficiary} />
                    <ContractedPlanCard sale={selectedSale} actorUserId={user.uid} />
                  </>
                ) : null}

                {activeTab === 'comercial' ? (
                  <CommercialTermsCard sale={selectedSale} saleId={selectedSale.id} actorUserId={user.uid} terms={terms} />
                ) : null}

                {activeTab === 'operacion' ? (
                  <>
                    <SaleChecklist steps={steps} requiredTypes={requiredTypes} />
                    <SaleStepsCard
                      sale={selectedSale}
                      saleId={selectedSale.id}
                      actorUserId={user.uid}
                      steps={steps}
                      requiredTypes={requiredTypes}
                    />
                    <AccountingPaymentCard sale={selectedSale} saleId={selectedSale.id} actorUserId={user.uid} />
                  </>
                ) : null}

                {activeTab === 'historial' ? <SaleTimeline events={events} /> : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
