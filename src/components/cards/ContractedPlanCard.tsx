import { useEffect, useMemo, useState } from 'react'
import type { SaleView } from '../../services/sales.service'
import { salesService } from '../../services/sales.service'
import { useAlerts } from '../../hooks/useAlerts'
import { usePlans } from '../../hooks/usePlans'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader } from '../ui/card'

type Props = {
  sale: SaleView
  actorUserId: string
}

const MODALITY_OPTIONS = ['CON_TELEASISTENCIA', 'SIN_TELEASISTENCIA'] as const

function modalityLabel(modality: (typeof MODALITY_OPTIONS)[number]) {
  return modality === 'CON_TELEASISTENCIA' ? 'Con teleasistencia' : 'Sin teleasistencia'
}

function storedPlanToUi(plan: SaleView['plan'] | undefined) {
  // Compatibilidad: en el modelo existente el equivalente histórico es MIXTO.
  if (!plan) return ''
  return plan === 'MIXTO' ? 'FLEXIBLE' : String(plan)
}

function planCodeToStoredSalePlan(code: string | undefined) {
	if (!code) return undefined
	// Compatibilidad: el equivalente histórico es MIXTO.
	if (code === 'FLEXIBLE') return 'MIXTO' as const
	return code as any
}

export function ContractedPlanCard({ sale, actorUserId }: Props) {
  const alerts = useAlerts()
  const { plans, loading } = usePlans()
  const [saving, setSaving] = useState(false)

  const inferredPlanId = useMemo(() => {
		if (sale.planId) return sale.planId
		const code = storedPlanToUi(sale.plan)
		if (!code) return ''
		return plans.find((p) => p.code === code)?.id ?? ''
  }, [sale.planId, sale.plan, plans])

  const [form, setForm] = useState({
    planId: sale.planId ?? '',
    modality: sale.modality ?? '',
  })

  useEffect(() => {
    setForm({
			planId: sale.planId ?? inferredPlanId,
      modality: sale.modality ?? '',
    })
  }, [sale.id, sale.planId, sale.plan, sale.modality, inferredPlanId])

  const changed = useMemo(() => {
		const selectedPlan = plans.find((p) => p.id === form.planId)
    const nextPlanStored = planCodeToStoredSalePlan(selectedPlan?.code)
    const nextModality = form.modality || undefined
		return (
			(sale.planId ?? '') !== (form.planId ?? '') ||
			(sale.plan ?? undefined) !== nextPlanStored ||
			(sale.modality ?? undefined) !== nextModality
		)
  }, [form.planId, form.modality, sale.planId, sale.plan, sale.modality, plans])

  async function onSave() {
    try {
      setSaving(true)
      const selectedPlan = plans.find((p) => p.id === form.planId)
      if (!selectedPlan) {
        alerts.error('Selecciona un plan válido para guardar')
        return
      }
      await salesService.updateSalePlanAndModality({
        saleId: sale.id,
        actorUserId,
        plan: planCodeToStoredSalePlan(selectedPlan.code),
        modality: (form.modality || undefined) as any,
      })
      await salesService.updateSalePlanReferences({
        saleId: sale.id,
        planId: selectedPlan.id,
        planSnapshot: {
          id: selectedPlan.id,
          code: selectedPlan.code,
          name: selectedPlan.name,
          pricing: selectedPlan.pricing,
          teleassistance: selectedPlan.teleassistance,
          annualCreditCard: selectedPlan.annualCreditCard,
          active: selectedPlan.active,
          updatedAt: selectedPlan.updatedAt,
        },
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
					value={form.planId}
					onChange={(e) => setForm((s) => ({ ...s, planId: e.target.value }))}
            >
					<option value="">{loading ? 'Cargando…' : 'Selecciona…'}</option>
					{plans
						.slice()
						.sort((a, b) => a.code.localeCompare(b.code, 'es'))
						.map((p) => (
							<option key={p.id} value={p.id}>
								{p.code} — {p.name}{p.active ? '' : ' (inactivo)'}
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
							{modalityLabel(m)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
