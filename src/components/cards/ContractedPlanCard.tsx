import { useEffect, useMemo, useState } from 'react'
import type { SaleView } from '../../services/sales.service'
import { salesService } from '../../services/sales.service'
import { useAlerts } from '../../hooks/useAlerts'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader } from '../ui/card'

type Props = {
  sale: SaleView
  actorUserId: string
}

const PLAN_OPTIONS = ['APP', 'STARTER', 'MAYOR', 'GPS_TRACKER', 'FULL', 'FLEXIBLE'] as const
const MODALITY_OPTIONS = ['CON_TELEASISTENCIA', 'SIN_TELEASISTENCIA'] as const

function storedPlanToUi(plan: SaleView['plan'] | undefined) {
  // Compatibilidad: en el modelo existente el equivalente histórico es MIXTO.
  if (!plan) return ''
  return plan === 'MIXTO' ? 'FLEXIBLE' : String(plan)
}

function uiPlanToStored(planUi: string) {
  if (!planUi) return undefined
  return planUi === 'FLEXIBLE' ? ('MIXTO' as const) : (planUi as any)
}

export function ContractedPlanCard({ sale, actorUserId }: Props) {
  const alerts = useAlerts()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    plan: storedPlanToUi(sale.plan),
    modality: sale.modality ?? '',
  })

  useEffect(() => {
    setForm({
      plan: storedPlanToUi(sale.plan),
      modality: sale.modality ?? '',
    })
  }, [sale.id, sale.plan, sale.modality])

  const changed = useMemo(() => {
    const nextPlanStored = uiPlanToStored(form.plan)
    const nextModality = form.modality || undefined
    return (sale.plan ?? undefined) !== nextPlanStored || (sale.modality ?? undefined) !== nextModality
  }, [form.plan, form.modality, sale.plan, sale.modality])

  async function onSave() {
    try {
      setSaving(true)
      await salesService.updateSalePlanAndModality({
        saleId: sale.id,
        actorUserId,
        plan: uiPlanToStored(form.plan),
        modality: (form.modality || undefined) as any,
      })
      alerts.success('Plan contratado actualizado')
    } catch {
      alerts.error('No se pudo actualizar el plan contratado')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Plan contratado</div>
            <div className="text-xs text-slate-500">Debe estar definido para cerrar la venta</div>
          </div>
          <Button variant="secondary" disabled={!changed || saving} onClick={onSave}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-xs text-slate-500">Plan</div>
            <select
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
              value={form.plan}
              onChange={(e) => setForm((s) => ({ ...s, plan: e.target.value }))}
            >
              <option value="">Selecciona…</option>
              {PLAN_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-slate-500">Modalidad</div>
            <select
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
              value={form.modality}
              onChange={(e) => setForm((s) => ({ ...s, modality: e.target.value }))}
            >
              <option value="">Selecciona…</option>
              {MODALITY_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
