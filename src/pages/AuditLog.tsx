import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

interface AuditLogEntry {
  id: string
  tenant_id: string
  user_id: string | null
  actor_email: string | null
  action: string
  resource_type: string
  resource_id: string | null
  resource_name: string | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  created_at: string
}

// ── Config maps ───────────────────────────────────────────────────────────────

const ACTION_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  create:  { label: 'Crear',    icon: 'ti-plus',       color: 'text-teal-500 bg-teal-50 dark:bg-teal-900/20' },
  update:  { label: 'Editar',   icon: 'ti-pencil',     color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' },
  delete:  { label: 'Eliminar', icon: 'ti-trash',      color: 'text-red-500 bg-red-50 dark:bg-red-900/20' },
  send:    { label: 'Enviar',   icon: 'ti-send',       color: 'text-gold-600 bg-gold-50 dark:bg-gold-900/20' },
  invite:  { label: 'Invitar',  icon: 'ti-user-plus',  color: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20' },
  accept:  { label: 'Aceptar',  icon: 'ti-user-check', color: 'text-teal-500 bg-teal-50 dark:bg-teal-900/20' },
  revoke:  { label: 'Revocar',  icon: 'ti-ban',        color: 'text-orange-500 bg-orange-50 dark:bg-orange-900/20' },
  login:   { label: 'Login',    icon: 'ti-login',      color: 'text-sand-600 bg-sand-100 dark:bg-night-700' },
}

const RESOURCE_CONFIG: Record<string, { label: string; icon: string }> = {
  campaign:     { label: 'Campaña',       icon: 'ti-speakerphone' },
  contact:      { label: 'Contacto',      icon: 'ti-user' },
  contact_list: { label: 'Lista',         icon: 'ti-users' },
  team_member:  { label: 'Miembro',       icon: 'ti-users-group' },
  invitation:   { label: 'Invitación',    icon: 'ti-mail-forward' },
  api_key:      { label: 'API Key',       icon: 'ti-key' },
  webhook:      { label: 'Webhook',       icon: 'ti-webhook' },
  settings:     { label: 'Configuración', icon: 'ti-settings' },
  tenant:       { label: 'Organización',  icon: 'ti-building' },
}

const ALL_ACTIONS   = Object.keys(ACTION_CONFIG)
const ALL_RESOURCES = Object.keys(RESOURCE_CONFIG)
const PAGE_SIZE     = 50

// ── Component ─────────────────────────────────────────────────────────────────

export function AuditLog() {
  const { tenant } = useAuth()

  const [search,         setSearch]         = useState('')
  const [filterAction,   setFilterAction]   = useState<string>('all')
  const [filterResource, setFilterResource] = useState<string>('all')
  const [expandedId,     setExpandedId]     = useState<string | null>(null)
  const [page,           setPage]           = useState(0)

  const { data: logs = [], isLoading } = useQuery<AuditLogEntry[]>({
    queryKey: ['audit_logs', tenant?.id, filterAction, filterResource, page],
    queryFn: async () => {
      if (!tenant?.id) return []
      let q = supabase
        .from('audit_logs')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (filterAction   !== 'all') q = q.eq('action', filterAction)
      if (filterResource !== 'all') q = q.eq('resource_type', filterResource)

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as AuditLogEntry[]
    },
    enabled: !!tenant?.id,
    staleTime: 30_000,
  })

  const filtered = logs.filter(l => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      (l.resource_name ?? '').toLowerCase().includes(s) ||
      (l.actor_email   ?? '').toLowerCase().includes(s) ||
      l.action.toLowerCase().includes(s) ||
      l.resource_type.toLowerCase().includes(s)
    )
  })

  const stats = ALL_ACTIONS.reduce<Record<string, number>>((acc, a) => {
    acc[a] = logs.filter(l => l.action === a).length
    return acc
  }, {})

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-12">

      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-sand-900 dark:text-night-50">
          Registro de actividad
        </h1>
        <p className="text-sm text-sand-900/50 dark:text-night-50/50 mt-1">
          Historial completo de acciones en tu organización
        </p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(['create', 'update', 'delete', 'send'] as const).map(action => {
          const cfg = ACTION_CONFIG[action]
          return (
            <button
              key={action}
              onClick={() => setFilterAction(filterAction === action ? 'all' : action)}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition-all',
                filterAction === action
                  ? 'border-gold-400/60 bg-gold-50 dark:bg-gold-900/10'
                  : 'border-sand-200 dark:border-night-700 bg-white dark:bg-night-800 hover:border-sand-300 dark:hover:border-night-600'
              )}
            >
              <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center text-sm shrink-0', cfg.color)}>
                <i className={`ti ${cfg.icon}`} />
              </div>
              <div>
                <p className="text-xs text-sand-900/40 dark:text-night-50/40">{cfg.label}</p>
                <p className="text-lg font-bold tabular-nums text-sand-900 dark:text-night-50 leading-none">
                  {stats[action] ?? 0}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-sand-900/30 dark:text-night-50/30 text-sm" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            placeholder="Buscar por recurso, usuario o acción…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-sand-200 dark:border-night-700 bg-white dark:bg-night-800 text-sand-900 dark:text-night-50 placeholder:text-sand-900/25 dark:placeholder:text-night-50/25 focus:outline-none focus:ring-2 focus:ring-gold-400/40 text-sm"
          />
        </div>
        <select
          value={filterAction}
          onChange={e => { setFilterAction(e.target.value); setPage(0) }}
          className="px-3 py-2.5 rounded-xl border border-sand-200 dark:border-night-700 bg-white dark:bg-night-800 text-sand-900 dark:text-night-50 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
        >
          <option value="all">Todas las acciones</option>
          {ALL_ACTIONS.map(a => (
            <option key={a} value={a}>{ACTION_CONFIG[a]?.label ?? a}</option>
          ))}
        </select>
        <select
          value={filterResource}
          onChange={e => { setFilterResource(e.target.value); setPage(0) }}
          className="px-3 py-2.5 rounded-xl border border-sand-200 dark:border-night-700 bg-white dark:bg-night-800 text-sand-900 dark:text-night-50 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/40"
        >
          <option value="all">Todos los recursos</option>
          {ALL_RESOURCES.map(r => (
            <option key={r} value={r}>{RESOURCE_CONFIG[r]?.label ?? r}</option>
          ))}
        </select>
      </div>

      {/* Log table */}
      <div className="bg-white dark:bg-night-800 rounded-2xl border border-sand-200 dark:border-night-700 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-gold-400/30 border-t-gold-400 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-sand-100 dark:bg-night-700 flex items-center justify-center">
              <i className="ti ti-history text-2xl text-sand-900/20 dark:text-night-50/20" />
            </div>
            <p className="text-sm text-sand-900/40 dark:text-night-50/40">
              {search || filterAction !== 'all' || filterResource !== 'all'
                ? 'No hay eventos que coincidan con los filtros'
                : 'Aún no hay actividad registrada'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-sand-100 dark:divide-night-700">
            {filtered.map(log => {
              const actionCfg   = ACTION_CONFIG[log.action]           ?? { label: log.action,        icon: 'ti-activity',  color: 'text-sand-600 bg-sand-100' }
              const resourceCfg = RESOURCE_CONFIG[log.resource_type]  ?? { label: log.resource_type, icon: 'ti-file' }
              const isExpanded  = expandedId === log.id
              const hasDetail   = !!(log.old_data || log.new_data || log.metadata)

              return (
                <div key={log.id}>
                  <button
                    onClick={() => hasDetail && setExpandedId(isExpanded ? null : log.id)}
                    className={cn(
                      'w-full flex items-center gap-4 px-5 py-3.5 text-left transition-colors',
                      hasDetail ? 'hover:bg-sand-50 dark:hover:bg-night-750 cursor-pointer' : 'cursor-default',
                      isExpanded && 'bg-sand-50 dark:bg-night-750'
                    )}
                  >
                    {/* Action badge */}
                    <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center text-sm shrink-0', actionCfg.color)}>
                      <i className={`ti ${actionCfg.icon}`} />
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-sand-900 dark:text-night-50">
                          {actionCfg.label}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-sand-900/50 dark:text-night-50/50">
                          <i className={`ti ${resourceCfg.icon} text-[11px]`} />
                          {resourceCfg.label}
                        </span>
                        {log.resource_name && (
                          <span className="text-xs font-medium text-sand-900/70 dark:text-night-50/70 truncate max-w-[200px]">
                            "{log.resource_name}"
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-sand-900/40 dark:text-night-50/40 mt-0.5">
                        {log.actor_email
                          ? <><i className="ti ti-user text-[10px] mr-1" />{log.actor_email} · </>
                          : <><i className="ti ti-robot text-[10px] mr-1" />Sistema · </>
                        }
                        {formatDistanceToNow(new Date(log.created_at), { locale: es, addSuffix: true })}
                      </p>
                    </div>

                    {/* Timestamp */}
                    <span className="text-xs text-sand-900/30 dark:text-night-50/30 shrink-0 tabular-nums hidden sm:block">
                      {format(new Date(log.created_at), 'dd/MM HH:mm')}
                    </span>

                    {/* Chevron */}
                    {hasDetail && (
                      <i className={cn(
                        'ti ti-chevron-down text-sm text-sand-900/20 dark:text-night-50/20 transition-transform shrink-0',
                        isExpanded && 'rotate-180'
                      )} />
                    )}
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && hasDetail && (
                    <div className="px-5 pb-4 bg-sand-50 dark:bg-night-750">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {log.old_data && (
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-sand-900/30 dark:text-night-50/30 mb-1.5">Antes</p>
                            <pre className="text-[11px] text-sand-900/60 dark:text-night-50/60 bg-white dark:bg-night-800 rounded-xl p-3 overflow-auto max-h-32 border border-sand-200 dark:border-night-700">
                              {JSON.stringify(log.old_data, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.new_data && (
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-sand-900/30 dark:text-night-50/30 mb-1.5">Después</p>
                            <pre className="text-[11px] text-sand-900/60 dark:text-night-50/60 bg-white dark:bg-night-800 rounded-xl p-3 overflow-auto max-h-32 border border-sand-200 dark:border-night-700">
                              {JSON.stringify(log.new_data, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.metadata && (
                          <div className="sm:col-span-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-sand-900/30 dark:text-night-50/30 mb-1.5">Metadatos</p>
                            <pre className="text-[11px] text-sand-900/60 dark:text-night-50/60 bg-white dark:bg-night-800 rounded-xl p-3 overflow-auto max-h-24 border border-sand-200 dark:border-night-700">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {(filtered.length === PAGE_SIZE || page > 0) && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-sand-200 dark:border-night-700 text-sm text-sand-900/60 dark:text-night-50/60 disabled:opacity-30 hover:bg-sand-50 dark:hover:bg-night-750 transition-colors"
          >
            <i className="ti ti-chevron-left text-sm" /> Anterior
          </button>
          <span className="text-sm text-sand-900/40 dark:text-night-50/40">Página {page + 1}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={filtered.length < PAGE_SIZE}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-sand-200 dark:border-night-700 text-sm text-sand-900/60 dark:text-night-50/60 disabled:opacity-30 hover:bg-sand-50 dark:hover:bg-night-750 transition-colors"
          >
            Siguiente <i className="ti ti-chevron-right text-sm" />
          </button>
        </div>
      )}
    </div>
  )
}
