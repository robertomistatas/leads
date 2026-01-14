import { useState } from 'react'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader } from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { authService } from '../../services/auth.service'
import { useAlerts } from '../../hooks/useAlerts'

export function LoginPage() {
  const alerts = useAlerts()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  return (
    <div className="h-full grid place-items-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="text-xl font-semibold">Ingreso</div>
          <div className="text-sm text-slate-500">Acceso interno MisTatas / AMAIA</div>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault()
              setLoading(true)
              try {
                await authService.signInWithEmailAndPassword(email, password)
                alerts.success('Sesión iniciada')
              } catch {
                alerts.error('No se pudo iniciar sesión')
              } finally {
                setLoading(false)
              }
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@empresa.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Ingresando…' : 'Ingresar'}
            </Button>

            <div className="text-xs text-slate-400">
              Configura Firebase con variables VITE_FIREBASE_* para habilitar Auth/Firestore.
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
