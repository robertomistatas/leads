import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader } from '../../components/ui/card'
import { BeneficiaryCard, ClientInfoCard, CommercialTermsCard, ContractedPlanCard, SaleActionsCard, SaleStepsCard } from '../../components/cards'
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

  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="text-2xl font-semibold">Ventas</div>
        <div className="text-sm text-slate-600">Operación + auditoría por venta</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="text-sm font-semibold">Ventas en progreso ({loading ? '…' : sales.length})</div>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        <div className="space-y-4">
          {!selectedSale ? (
            <Card>
              <CardHeader>
                <div className="text-sm font-semibold">Detalle</div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-slate-600">Selecciona una venta para continuar.</div>
              </CardContent>
            </Card>
          ) : !user ? (
            <Card>
              <CardHeader>
                <div className="text-sm font-semibold">Detalle</div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-slate-600">Cargando sesión…</div>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <div className="text-sm font-semibold">Identificación</div>
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-semibold text-slate-900">{client?.fullName ?? 'Cliente sin nombre'}</div>
                  <div className="text-xs text-slate-600">
                    {makeFolio('Venta', selectedSale.id) ?? 'Venta'} · Estado: {saleStatusLabel(selectedSale.status)}
                  </div>
                </CardContent>
              </Card>
              <SaleActionsCard sale={selectedSale} steps={steps} beneficiary={beneficiary} actorUserId={user.uid} />
              <ContractedPlanCard sale={selectedSale} actorUserId={user.uid} />
              {client ? <ClientInfoCard saleId={selectedSale.id} actorUserId={user.uid} client={client} /> : null}
              <BeneficiaryCard saleId={selectedSale.id} actorUserId={user.uid} beneficiary={beneficiary} />
              <CommercialTermsCard sale={selectedSale} saleId={selectedSale.id} actorUserId={user.uid} terms={terms} />
              <SaleStepsCard sale={selectedSale} saleId={selectedSale.id} actorUserId={user.uid} steps={steps} requiredTypes={requiredTypes} />
              <SaleChecklist steps={steps} requiredTypes={requiredTypes} />
              <SaleTimeline events={events} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
