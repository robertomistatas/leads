import { Card, CardContent, CardHeader } from '../../components/ui/card'

export function ClientsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="text-2xl font-semibold">Clientes</div>
        <div className="text-sm text-slate-300">Módulo pendiente (Fase 2)</div>
      </div>

      <Card>
        <CardHeader>
          <div className="text-sm font-semibold">Pendiente</div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-slate-300">
            Este módulo se implementa después de completar la Fase 1.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
