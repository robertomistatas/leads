import { Card, CardContent, CardHeader } from '../ui/card'
import type { EventView } from '../../services/events.service'

function entityLabel(entity: string) {
  switch (entity) {
    case 'CLIENT':
      return 'Cliente'
    case 'SALE':
      return 'Venta'
    case 'BENEFICIARY':
      return 'Beneficiario'
    case 'COMMERCIAL_TERMS':
      return 'Condiciones comerciales'
    case 'STEP':
      return 'Paso'
    default:
      return entity
  }
}

function fieldLabel(field: string) {
  switch (field) {
    case 'status':
      return 'Estado'
    case 'fullName':
      return 'Nombre completo'
    case 'phone':
      return 'Teléfono'
    case 'email':
      return 'Email'
    case 'plan':
      return 'Plan'
    case 'modality':
      return 'Modalidad'
    case 'region':
      return 'Región'
    default:
      return field
  }
}

export function SaleTimeline({ events }: { events: EventView[] }) {
  return (
    <Card>
			<CardHeader className="p-4">
        <div className="text-sm font-semibold">Historial</div>
      </CardHeader>
			<CardContent className="p-4">
        {events.length === 0 ? (
          <div className="text-sm text-slate-600">Sin historial aún.</div>
        ) : (
          <div className="space-y-3">
            {events.map((e) => (
              <div key={e.id} className="border-l border-slate-200 pl-3">
                <div className="text-xs text-slate-500">{e.createdAt.toLocaleString('es-CL')} · {entityLabel(e.entity)}</div>
                <div className="text-sm">
                  <span className="text-slate-900">{fieldLabel(e.field)}</span>
                  {e.previousValue || e.newValue ? (
                    <span className="text-slate-600">
                      {' '}
                      {e.previousValue ? `(${e.previousValue} → ` : '('}
                      {e.newValue ?? ''})
                    </span>
                  ) : null}
                </div>
                {e.comment ? <div className="text-xs text-slate-500">{e.comment}</div> : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
