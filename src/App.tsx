import { Toaster } from 'sonner'
import { useAuth } from './hooks/useAuth'
import { LoginPage } from './app/login/LoginPage'
import { AppShell } from './components/layout/AppShell'

export default function App() {
  const { user, initializing } = useAuth()

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
      {user ? <AppShell /> : <LoginPage />}
    </>
  )
}
