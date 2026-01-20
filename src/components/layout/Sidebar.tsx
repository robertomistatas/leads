import { LayoutDashboard, Megaphone, BadgeDollarSign, LogOut } from 'lucide-react'
import type { AppSection } from './AppShell'
import { Button } from '../ui/button'
import { authService } from '../../services/auth.service'
import { useAlerts } from '../../hooks/useAlerts'
import mistatasLogo from '../../img/mistatas2026.png'

type Props = {
  section: AppSection
  onChangeSection: (section: AppSection) => void
}

export function Sidebar({ section, onChangeSection }: Props) {
  const alerts = useAlerts()

  return (
    <aside className="w-72 shrink-0 border-r border-slate-200 bg-white">
      <div className="p-6">
        <img src={mistatasLogo} alt="Mistatas" className="h-11 w-auto object-contain" />
        <div className="text-lg font-semibold text-slate-900">Gestión Interna</div>
      </div>

      <nav className="px-2 space-y-1">
        <SidebarItem
          active={section === 'dashboard'}
          icon={<LayoutDashboard className="h-4 w-4" />}
          label="Dashboard"
          onClick={() => onChangeSection('dashboard')}
        />
        <SidebarItem
          active={section === 'leads'}
          icon={<Megaphone className="h-4 w-4" />}
          label="Leads"
          onClick={() => onChangeSection('leads')}
        />
        <SidebarItem
          active={section === 'sales'}
          icon={<BadgeDollarSign className="h-4 w-4" />}
          label="Ventas"
          onClick={() => onChangeSection('sales')}
        />
      </nav>

      <div className="p-4 mt-6">
        <Button
          variant="secondary"
          className="w-full justify-start"
          onClick={async () => {
            await authService.signOut()
            alerts.success('Sesión cerrada')
          }}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Salir
        </Button>
      </div>
    </aside>
  )
}

function SidebarItem({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'w-full flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ' +
        (active
          ? 'bg-slate-100 text-slate-900'
          : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900')
      }
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}
