import { useEffect, useMemo, useState } from 'react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { DashboardPage } from '../../app/dashboard/DashboardPage'
import { LeadsPage } from '../../app/leads/LeadsPage'
import { SalesPage } from '../../app/sales/SalesPage'
import { ClientsPage } from '../../app/clients/ClientsPage'
import { ValuesPage } from '../../app/values/ValuesPage'

export type AppSection = 'dashboard' | 'leads' | 'sales' | 'values' | 'clients'

function parseHashRoute(): { section: AppSection; saleId?: string } {
  const raw = window.location.hash.replace(/^#/, '').trim()
  if (!raw) return { section: 'dashboard' }
  const parts = raw.split('/').filter(Boolean)
  const section = parts[0] as AppSection
  const saleId = parts[1]
  if (section === 'dashboard' || section === 'leads' || section === 'sales' || section === 'values' || section === 'clients') {
    return { section, saleId }
  }
  return { section: 'dashboard' }
}

export function AppShell() {
  const [route, setRoute] = useState(() => parseHashRoute())

  useEffect(() => {
    const onHashChange = () => setRoute(parseHashRoute())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const { title, content } = useMemo(() => {
    switch (route.section) {
      case 'dashboard':
        return { title: 'Dashboard', content: <DashboardPage /> }
      case 'leads':
        return { title: 'Leads', content: <LeadsPage initialSaleId={route.saleId} /> }
      case 'sales':
        return { title: 'Ventas', content: <SalesPage initialSaleId={route.saleId} /> }
      case 'clients':
        return { title: 'Clientes', content: <ClientsPage /> }
      case 'values':
        return { title: 'Valores', content: <ValuesPage /> }
      default:
        return { title: '', content: null }
    }
  }, [route.section, route.saleId])

  return (
    <div className="h-full flex bg-slate-50">
      <Sidebar
        section={route.section}
        onChangeSection={(next) => {
          window.location.hash = next
          setRoute({ section: next })
        }}
      />
      <div className="flex-1 min-w-0">
        <Topbar title={title} />
        <main className="max-w-6xl mx-auto px-6 py-6">{content}</main>
      </div>
    </div>
  )
}
