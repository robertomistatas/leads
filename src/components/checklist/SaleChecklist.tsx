import type { SaleStepType } from '../../models/SaleStep'
import type { SaleStepView } from '../../services/sales.service'
import { Card, CardContent, CardHeader } from '../ui/card'
import { saleStepStatusLabel, saleStepTypeLabel } from '../../utils/labels'

const ORDER: SaleStepType[] = [
  'CONTRACT',
  'PAYMENT',
  'DEVICE_CONFIG',
  'CREDENTIALS',
  'SHIPPING',
  'INSTALLATION',
  'REMOTE_SUPPORT',
]

function statusLabel(status: string) {
  switch (status) {
    case 'DONE':
    case 'SIGNED':
      return { text: saleStepStatusLabel(status), cls: 'text-emerald-600' }
    case 'IN_PROGRESS':
    case 'SENT':
      return { text: saleStepStatusLabel(status), cls: 'text-amber-600' }
    default:
      return { text: saleStepStatusLabel(status), cls: 'text-slate-500' }
  }
}

export function SaleChecklist({
  steps,
  requiredTypes,
}: {
  steps: SaleStepView[]
  requiredTypes?: SaleStepType[]
}) {
  const byType = new Map<SaleStepType, SaleStepView>()
  for (const s of steps) byType.set(s.type, s)

  const requiredSet = requiredTypes ? new Set(requiredTypes) : null
  const ordered = requiredSet ? ORDER.filter((t) => requiredSet.has(t)) : ORDER

  return (
    <Card>
			<CardHeader className="p-4">
        <div className="text-sm font-semibold">Lista de verificación</div>
      </CardHeader>
			<CardContent className="p-4">
        <div className="space-y-2">
          {ordered.map((type) => {
            const s = byType.get(type)
            const st = s?.status ?? 'PENDING'
            const label = statusLabel(st)
            return (
              <div key={type} className="flex items-center justify-between text-sm">
                <div className="text-slate-700">{saleStepTypeLabel(type)}</div>
                <div className={label.cls}>{label.text}</div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
