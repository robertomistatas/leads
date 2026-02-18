import { Toaster } from 'sonner'
import { useAuth } from './hooks/useAuth'
import { LoginPage } from './app/login/LoginPage'
import { AppShell } from './components/layout/AppShell'
import { Card, CardContent, CardHeader } from './components/ui/card'
import { Button } from './components/ui/button'
import { authService } from './services/auth.service'
import { useAlerts } from './hooks/useAlerts'

export default function App() {
  const { user, initializing, accessState } = useAuth()
  const alerts = useAlerts()

  if (initializing) {
    return (
      <div className="h-full grid place-items-center">
        <div className="text-sm text-slate-300">Cargando…</div>
      </div>
    )
  }

  return (
    <>
      <Toaster richColors position="top-right" />
      {!user ? <LoginPage /> : null}
      {user && accessState === 'AUTHORIZED' ? <AppShell /> : null}
      {user && accessState === 'UNAUTHORIZED' ? (
        <AccessStateScreen
          title="Acceso no autorizado"
          message="Tu cuenta no está registrada en el sistema. Solicita acceso a un super administrador."
          onSignOut={async () => {
            await authService.signOut()
            alerts.success('Sesión cerrada')
          }}
        />
      ) : null}
      {user && accessState === 'PENDING_ACTIVATION' ? (
        <AccessStateScreen
          title="Acceso pendiente de activación"
          message="Tu cuenta existe pero está inactiva. Solicita activación a un super administrador."
          onSignOut={async () => {
            await authService.signOut()
            alerts.success('Sesión cerrada')
          }}
        />
      ) : null}
    </>
  )
}

function AccessStateScreen({ title, message, onSignOut }: { title: string; message: string; onSignOut: () => Promise<void> }) {
  return (
    <div className="h-full grid place-items-center p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="text-xl font-semibold text-slate-900">{title}</div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-slate-600">{message}</div>
          <Button onClick={() => void onSignOut()}>Cerrar sesión</Button>
        </CardContent>
      </Card>
    </div>
  )
}
