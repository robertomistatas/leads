import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader } from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Button } from '../../components/ui/button'
import { useClientsByIds, useSales, useSaleEvents, useSaleSteps } from '../../hooks/useSales'
import { useAuth } from '../../hooks/useAuth'
import { useAlerts } from '../../hooks/useAlerts'
import { salesService } from '../../services/sales.service'
import { computeSaleRuntimeAlerts } from '../../utils/alertRules'
import { SaleChecklist } from '../../components/checklist/SaleChecklist'
import { SaleTimeline } from '../../components/timeline/SaleTimeline'
import { makeFolio } from '../../utils/folio'
import { saleStatusLabel } from '../../utils/labels'

export function LeadsPage({ initialSaleId }: { initialSaleId?: string }) {
  const alerts = useAlerts()
  const { user } = useAuth()
  const { sales: leads, loading } = useSales('lead')

  const [fullName, setFullName] = useState('')
  const [rut, setRut] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  const [selectedSaleId, setSelectedSaleId] = useState<string | undefined>(undefined)
  const selectedLead = useMemo(() => leads.find((l) => l.id === selectedSaleId), [leads, selectedSaleId])

  useEffect(() => {
    if (!initialSaleId) return
    setSelectedSaleId(initialSaleId)
  }, [initialSaleId])

  const { clientsById } = useClientsByIds(useMemo(() => leads.map((l) => l.clientId), [leads]))
  const selectedClient = selectedLead ? clientsById[selectedLead.clientId] : undefined

  const { events } = useSaleEvents(selectedSaleId)
  const { steps } = useSaleSteps(selectedSaleId)

  const shownAlertRef = useRef<Set<string>>(new Set())
  const runtime = useMemo(() => {
    if (!selectedLead) return null
    return computeSaleRuntimeAlerts({ sale: selectedLead, events, steps })
  }, [selectedLead, events, steps])

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
        <div className="text-2xl font-semibold">Leads</div>
        <div className="text-sm text-slate-600">Crear lead y convertir a venta</div>
      </div>

      <Card>
        <CardHeader>
          <div className="text-sm font-semibold">Crear Lead</div>
        </CardHeader>
        <CardContent>
          <form
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
            onSubmit={async (e) => {
              e.preventDefault()
              if (!user) {
                alerts.error('Debes iniciar sesión')
                return
              }
              if (!fullName.trim()) {
                alerts.error('Nombre es obligatorio')
                return
              }

              if (!phone.trim() && !email.trim()) {
                alerts.error('Teléfono o email es obligatorio')
                return
              }

              try {
                const { saleId } = await salesService.createLead(
                  {
                    fullName: fullName.trim(),
                    rut: rut.trim() || undefined,
                    phone: phone.trim() || undefined,
                    email: email.trim() || undefined,
                  },
                  user.uid,
                )
                alerts.success('Lead creado')
                setSelectedSaleId(saleId)
				window.location.hash = `leads/${saleId}`
                setFullName('')
                setRut('')
                setPhone('')
                setEmail('')
              } catch (err) {
                // eslint-disable-next-line no-console
                console.error('[ui] createLead failed', err)
                alerts.error('No se pudo crear el lead')
              }
            }}
          >
            <div className="space-y-2">
              <Label>Nombre completo</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nombre" />
            </div>
            <div className="space-y-2">
              <Label>RUT (opcional)</Label>
              <Input value={rut} onChange={(e) => setRut(e.target.value)} placeholder="12.345.678-9" />
            </div>
            <div className="space-y-2">
              <Label>Teléfono (opcional)</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+56…" />
            </div>
            <div className="space-y-2">
              <Label>Email (opcional)</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@…" />
            </div>

            <div className="md:col-span-2 flex justify-end">
              <Button type="submit">Crear Lead</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="text-sm font-semibold">Leads ({loading ? '…' : leads.length})</div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-slate-600">Cargando…</div>
            ) : leads.length === 0 ? (
              <div className="text-sm text-slate-600">No hay leads.</div>
            ) : (
              <div className="space-y-2">
                {leads.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => {
                      setSelectedSaleId(l.id)
                      window.location.hash = `leads/${l.id}`
                    }}
                    className={
                      'w-full text-left rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400/40 ' +
                      (l.id === selectedSaleId
                        ? 'border-slate-300 bg-slate-50 text-slate-900'
                        : 'border-slate-200 text-slate-900 hover:bg-slate-50')
                    }
                  >
                    <div className="text-sm font-medium">{clientsById[l.clientId]?.fullName ?? 'Cliente sin nombre'}</div>
                    <div className="text-xs text-slate-600">{makeFolio('Lead', l.id) ?? 'Lead'}</div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="text-sm font-semibold">Detalle</div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedLead ? (
              <div className="text-sm text-slate-600">Selecciona un lead para ver lista de verificación e historial.</div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-semibold text-slate-900">{selectedClient?.fullName ?? 'Cliente sin nombre'}</div>
                    <div className="text-xs text-slate-600">
                      {makeFolio('Lead', selectedLead.id) ?? 'Lead'} · Estado: {saleStatusLabel(selectedLead.status)}
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      if (!user) {
                        alerts.error('Debes iniciar sesión')
                        return
                      }
                      try {
                        await salesService.convertLeadToInProgress(selectedLead.id, user.uid)
                        alerts.success('Lead convertido a venta (En progreso)')
                      } catch (err) {
                        // eslint-disable-next-line no-console
                        console.error('[ui] convertLeadToInProgress failed', err)
                        alerts.error('No se pudo convertir el lead')
                      }
                    }}
                  >
                    Convertir a Venta
                  </Button>
                </div>

                <SaleChecklist steps={steps} />
                <SaleTimeline events={events} />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
