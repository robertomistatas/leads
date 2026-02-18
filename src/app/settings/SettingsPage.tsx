import { useEffect, useMemo, useState } from 'react'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader } from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { useAlerts } from '../../hooks/useAlerts'
import { useAuth } from '../../hooks/useAuth'
import { auditLogsService } from '../../services/auditLogs.service'
import { usersService, type UserProfileView, type UserRole } from '../../services/users.service'
import type { AuditLog } from '../../models/AuditLog'

type TabKey = 'users' | 'logs'

type UserDraft = {
  email: string
  password: string
  role: UserRole
  isActive: boolean
}

const DEFAULT_DRAFT: UserDraft = {
  email: '',
  password: '',
  role: 'COMERCIAL',
  isActive: true,
}

function formatDate(value: Date | undefined): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(value)
}

export function SettingsPage() {
  const alerts = useAlerts()
  const { user, role, isSuperAdmin, isComercial } = useAuth()

  const [tab, setTab] = useState<TabKey>('users')
  const [users, setUsers] = useState<UserProfileView[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [draft, setDraft] = useState<UserDraft>(DEFAULT_DRAFT)
  const [savingUser, setSavingUser] = useState(false)

  const canShowAllLogs = isSuperAdmin

  const loadUsers = async () => {
    if (!isSuperAdmin) return
    try {
      setUsersLoading(true)
      const result = await usersService.listUsers()
      setUsers(result)
    } catch {
      alerts.error('No se pudo cargar usuarios')
    } finally {
      setUsersLoading(false)
    }
  }

  const loadLogs = async () => {
    if (!user) return
    try {
      setLogsLoading(true)
      const result = canShowAllLogs
        ? await auditLogsService.listRecent()
        : await auditLogsService.listRecent({ actorUid: user.uid })
      setLogs(result)
    } catch {
      alerts.error('No se pudieron cargar los registros')
    } finally {
      setLogsLoading(false)
    }
  }

  useEffect(() => {
    void loadUsers()
  }, [isSuperAdmin])

  useEffect(() => {
    if (tab !== 'logs') return
    void loadLogs()
  }, [tab, canShowAllLogs, user?.uid])

  const tabClass = useMemo(
    () =>
      (key: TabKey) =>
        [
          'px-4 py-2 rounded-full text-sm border transition',
          tab === key
            ? 'bg-slate-900 text-white border-slate-900'
            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50',
        ].join(' '),
    [tab],
  )

  if (!isSuperAdmin) {
    return (
      <Card>
        <CardHeader>
          <div className="font-semibold text-slate-900">Configuración</div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-slate-600">No tienes permisos para acceder a este módulo.</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-slate-900">Configuración</div>
            <div className="text-sm text-slate-600">Gestión de usuarios y registros de auditoría</div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className={tabClass('users')} onClick={() => setTab('users')}>
              Usuarios
            </button>
            <button type="button" className={tabClass('logs')} onClick={() => setTab('logs')}>
              Registros Log
            </button>
          </div>
        </CardHeader>

        <CardContent>
          {tab === 'users' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-end">
                <Button
                  onClick={() => {
                    setDraft(DEFAULT_DRAFT)
                    setModalOpen(true)
                  }}
                >
                  Crear usuario
                </Button>
              </div>

              {usersLoading ? (
                <div className="text-sm text-slate-600">Cargando usuarios…</div>
              ) : users.length === 0 ? (
                <div className="text-sm text-slate-600">No hay usuarios registrados.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500 border-b">
                        <th className="py-2 pr-4">Email</th>
                        <th className="py-2 pr-4">Rol</th>
                        <th className="py-2 pr-4">Activo</th>
                        <th className="py-2 pr-4">Creado por</th>
                        <th className="py-2 pr-4">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((item) => (
                        <tr key={item.uid} className="border-b last:border-b-0">
                          <td className="py-3 pr-4 text-slate-900">{item.email || '—'}</td>
                          <td className="py-3 pr-4 text-slate-800">{item.role ?? '—'}</td>
                          <td className="py-3 pr-4 text-slate-800">{item.isActive ? 'Sí' : 'No'}</td>
                          <td className="py-3 pr-4 text-slate-800">{item.createdBy || '—'}</td>
                          <td className="py-3 pr-4 text-slate-800">—</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-600">
                  {isComercial ? 'Mostrando solo tus registros.' : 'Mostrando todos los registros.'}
                </div>
                <Button variant="secondary" onClick={() => void loadLogs()} disabled={logsLoading}>
                  Actualizar
                </Button>
              </div>

              {logsLoading ? (
                <div className="text-sm text-slate-600">Cargando registros…</div>
              ) : logs.length === 0 ? (
                <div className="text-sm text-slate-600">No hay registros.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500 border-b">
                        <th className="py-2 pr-4">Fecha</th>
                        <th className="py-2 pr-4">Acción</th>
                        <th className="py-2 pr-4">Entidad</th>
                        <th className="py-2 pr-4">Resumen</th>
                        <th className="py-2 pr-4">Actor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id} className="border-b last:border-b-0">
                          <td className="py-3 pr-4 text-slate-800">{formatDate(log.createdAt)}</td>
                          <td className="py-3 pr-4 text-slate-800">{log.action}</td>
                          <td className="py-3 pr-4 text-slate-800">{log.entityType}</td>
                          <td className="py-3 pr-4 text-slate-800">{log.summary}</td>
                          <td className="py-3 pr-4 text-slate-800">{log.actor?.email || log.actor?.uid || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4"
          onMouseDown={() => {
            if (savingUser) return
            setModalOpen(false)
          }}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-slate-900">Crear usuario</div>
                <div className="text-sm text-slate-600">Crear cuenta en Auth y perfil en Firestore</div>
              </div>
              <Button
                variant="secondary"
                onClick={() => {
                  if (savingUser) return
                  setModalOpen(false)
                }}
                disabled={savingUser}
              >
                Cerrar
              </Button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-user-email">Email</Label>
                <Input
                  id="new-user-email"
                  type="email"
                  value={draft.email}
                  onChange={(e) => setDraft((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="usuario@empresa.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-user-password">Contraseña</Label>
                <Input
                  id="new-user-password"
                  type="password"
                  value={draft.password}
                  onChange={(e) => setDraft((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-user-role">Rol</Label>
                <select
                  id="new-user-role"
                  className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  value={draft.role}
                  onChange={(e) => setDraft((prev) => ({ ...prev, role: e.target.value as UserRole }))}
                >
                  <option value="COMERCIAL">COMERCIAL</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                </select>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={draft.isActive}
                  onChange={(e) => setDraft((prev) => ({ ...prev, isActive: e.target.checked }))}
                />
                Activo
              </label>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <Button
                disabled={savingUser}
                onClick={async () => {
                  if (!user) return
                  if (!draft.email.trim() || !draft.password.trim()) {
                    alerts.error('Email y contraseña son obligatorios')
                    return
                  }
                  if (draft.password.trim().length < 6) {
                    alerts.error('La contraseña debe tener al menos 6 caracteres')
                    return
                  }

                  try {
                    setSavingUser(true)
                    const created = await usersService.createUserWithProfile({
                      email: draft.email,
                      password: draft.password,
                      role: draft.role,
                      isActive: draft.isActive,
                      createdBy: user.uid,
                    })

                    await auditLogsService.write({
                      action: 'CREATE',
                      entityType: 'USER',
                      entityId: created.uid,
                      summary: `Usuario creado: ${created.email}`,
                      changes: [
                        { field: 'email', from: null, to: created.email },
                        { field: 'role', from: null, to: created.role },
                        { field: 'isActive', from: null, to: created.isActive },
                      ],
                      actor: {
                        uid: user.uid,
                        userId: user.uid,
                        email: user.email ?? undefined,
                        role: role ?? undefined,
                      },
                    })

                    alerts.success('Usuario creado')
                    setModalOpen(false)
                    setDraft(DEFAULT_DRAFT)
                    await loadUsers()
                  } catch (error) {
                    const message = error instanceof Error ? error.message : 'No se pudo crear el usuario'
                    alerts.error(message)
                  } finally {
                    setSavingUser(false)
                  }
                }}
              >
                {savingUser ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
