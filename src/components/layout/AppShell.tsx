import { useMemo, useState } from 'react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { DashboardPage } from '../../app/dashboard/DashboardPage'
import { LeadsPage } from '../../app/leads/LeadsPage'
import { SalesPage } from '../../app/sales/SalesPage'
import { ClientsPage } from '../../app/clients/ClientsPage'

export type AppSection = 'dashboard' | 'leads' | 'sales' | 'clients'

export function AppShell() {
  const [section, setSection] = useState<AppSection>('dashboard')

  const { title, content } = useMemo(() => {
    switch (section) {
      case 'dashboard':
        return { title: 'Dashboard', content: <DashboardPage /> }
      case 'leads':
        return { title: 'Leads', content: <LeadsPage /> }
      case 'sales':
        return { title: 'Ventas', content: <SalesPage /> }
      case 'clients':
        return { title: 'Clientes', content: <ClientsPage /> }
      default:
        return { title: '', content: null }
    }
  }, [section])

  return (
    <div className="h-full flex bg-slate-50">
      <Sidebar section={section} onChangeSection={setSection} />
      <div className="flex-1 min-w-0">
        <Topbar title={title} />
        <main className="max-w-6xl mx-auto px-6 py-6">{content}</main>
      </div>
    </div>
  )
}
