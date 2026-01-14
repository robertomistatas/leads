import { Bell, Search } from 'lucide-react'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { useAuth } from '../../hooks/useAuth'

export function Topbar({ title }: { title: string }) {
  const { user } = useAuth()

  return (
    <header className="sticky top-0 z-10 bg-slate-50/80 backdrop-blur border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-2xl font-semibold truncate">{title}</div>
        </div>

        <div className="hidden md:flex items-center gap-2 w-[360px]">
          <div className="relative w-full">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input className="pl-9 rounded-full" placeholder="Buscar…" />
          </div>
        </div>

        <Button variant="secondary" className="h-10 w-10 p-0 rounded-full" aria-label="Notificaciones">
          <Bell className="h-4 w-4" />
        </Button>

        <div className="hidden sm:block text-right">
          <div className="text-sm font-medium leading-4">{user?.displayName ?? 'Usuario'}</div>
          <div className="text-xs text-slate-500 truncate max-w-[220px]">{user?.email ?? ''}</div>
        </div>
      </div>
    </header>
  )
}
