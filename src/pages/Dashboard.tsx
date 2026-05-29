import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase, type Campaign, type CampaignStats } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { formatNumber, formatPercent } from '@/lib/utils'

interface CampaignWithStats extends Campaign {
  stats?: CampaignStats
}

interface AuditEntry {
  id: string
  actor_email: string | null
  action: string
  resource_type: string
  resource_name: string | null
  created_at: string
}

function useDashboardData() {
  const { tenant } = useAuth()

  const { data: campaigns = [], isLoading: loadingCampaigns } = useQuery<CampaignWithStats[]>({
    queryKey: ['dashboard-campaigns', tenant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('campaigns')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .order('created_at', { ascending: false })
        .limit(8)
      return data ?? []
    },
    enabled: !!tenant,
  })

  const { data: stats = [] } = useQuery<CampaignStats[]>({
    queryKey: ['campaign-stats', tenant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('campaign_stats')
        .select('*')
        .eq('tenant_id', tenant!.id)
      return data ?? []
    },
    enabled: !!tenant,
  })

  const { data: contactCount = 0 } = useQuery<number>({
    queryKey: ['contacts-count', tenant?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant!.id)
        .eq('status', 'active')
      return count ?? 0
    },
    enabled: !!tenant,
  })

  const { data: teamCount = 0 } = useQuery<number>({
    queryKey: ['team-count', tenant?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant!.id)
      return count ?? 0
    },
    enabled: !!tenant,
  })

  const { data: recentActivity = [] } = useQuery<AuditEntry[]>({
    queryKey: ['recent-activity', tenant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('audit_log')
        .select('id, actor_email, action, resource_type, resource_name, created_at')
        .eq('tenant_id', tenant!.id)
        .order('created_at', { ascending: false })
        .limit(10)
      return data ?? []
    },
    enabled: !!tenant,
  })

  // Merge stats into campaigns
  const campaignsWithStats: CampaignWithStats[] = campaigns.map((c) => ({
    ...c,
    stats: stats.find((s) => s.campaign_id === c.id),
  }))

  // Aggregate KPIs
  const totalSent    = stats.reduce((sum, s) => sum + s.emails_sent, 0)
  const totalOpened  = stats.reduce((sum, s) => sum + s.emails_opened, 0)
  const openRate     = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0
  const activeCampaigns = campaigns.filter((c) =>
    ['queued', 'generating', 'ready'].includes(c.status)
  ).length

  return {
    campaigns: campaignsWithStats,
    isLoading: loadingCampaigns,
    kpis: { activeCampaigns, totalSent, openRate, contactCount, teamCount },
    recentActivity,
  }
}

// ── Action config for activity feed ──────────────────────────────────────────

const ACTION_ICON: Record<string, { icon: string; color: string }> = {
  create:  { icon: 'ti-plus',        color: 'text-teal-500  bg-teal-50   dark:bg-teal-900/20' },
  update:  { icon: 'ti-pencil',      color: 'text-blue-500  bg-blue-50   dark:bg-blue-900/20' },
  delete:  { icon: 'ti-trash',       color: 'text-red-500   bg-red-50    dark:bg-red-900/20'  },
  send:    { icon: 'ti-send',        color: 'text-[#C9973A] bg-[#C9973A]/10' },
  invite:  { icon: 'ti-user-plus',   color: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20' },
  accept:  { icon: 'ti-user-check',  color: 'text-teal-500  bg-teal-50   dark:bg-teal-900/20' },
  login:   { icon: 'ti-login',       color: 'text-sand-500  bg-sand-100  dark:bg-night-700' },
}

const RESOURCE_LABEL: Record<string, string> = {
  campaign:     'campaña',
  contact:      'contacto',
  contact_list: 'lista',
  team_member:  'miembro',
  invitation:   'invitación',
  api_key:      'API key',
  webhook:      'webhook',
  settings:     'configuración',
  tenant:       'organización',
}

const ACTION_LABEL: Record<string, string> = {
  create: 'creó',
  update: 'editó',
  delete: 'eliminó',
  send:   'envió',
  invite: 'invitó',
  accept: 'aceptó',
  login:  'inició sesión',
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Dashboard() {
  const navigate = useNavigate()
  const { tenant } = useAuth()
  const { campaigns, isLoading, kpis, recentActivity } = useDashboardData()

  const kpiCards = [
    {
      label: 'Campañas activas',
      value: String(kpis.activeCampaigns),
      icon: 'ti-speakerphone',
      color: 'gold',
      href: '/campaigns',
    },
    {
      label: 'Emails enviados',
      value: formatNumber(kpis.totalSent),
      icon: 'ti-mail',
      color: 'teal',
      href: '/analytics',
    },
    {
      label: 'Contactos activos',
      value: formatNumber(kpis.contactCount),
      icon: 'ti-users',
      color: 'gold',
      href: '/contacts',
    },
    {
      label: 'Open rate promedio',
      value: formatPercent(kpis.openRate),
      icon: 'ti-mail-opened',
      color: 'teal',
      href: '/analytics',
    },
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl text-sand-900 dark:text-night-50 font-semibold">
          Panel de control
        </h1>
        <p className="text-sm text-sand-900/50 dark:text-night-50/50 mt-0.5">
          {new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric', day: 'numeric' })}
          {tenant ? ` · ${tenant.name}` : ''}
          {kpis.teamCount > 0 && ` · ${kpis.teamCount} miembro${kpis.teamCount !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-4 gap-4">
        {kpiCards.map(({ label, value, icon, color, href }) => (
          <button
            key={label}
            onClick={() => navigate(href)}
            className="bg-white dark:bg-[#1A1510] rounded-xl border border-black/8 dark:border-white/8 shadow-sm p-5 text-left hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-sans text-sand-900/50 dark:text-night-50/50 uppercase tracking-wide">
                  {label}
                </p>
                <p className={`font-display text-2xl font-semibold mt-1 ${isLoading ? 'opacity-30' : ''} text-sand-900 dark:text-night-50`}>
                  {isLoading ? '–' : value}
                </p>
              </div>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                color === 'gold'
                  ? 'bg-[#C9973A]/15 text-[#8C5E0A] dark:text-[#C9973A]'
                  : 'bg-[#2BB5A0]/15 text-[#0D7A64] dark:text-[#2BB5A0]'
              }`}>
                <i className={`ti ${icon} text-lg`} />
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Two-column: campaigns + activity */}
      <div className="grid grid-cols-5 gap-4">

        {/* Campaigns list — 3 cols */}
        <div className="col-span-3 bg-white dark:bg-[#1A1510] rounded-xl border border-black/8 dark:border-white/8 shadow-sm">
          <div className="px-5 py-4 border-b border-black/8 dark:border-white/8 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-sand-900 dark:text-night-50">
              Campañas recientes
            </h2>
            <button
              onClick={() => navigate('/campaigns')}
              className="text-xs font-sans text-[#C9973A] hover:underline"
            >
              Ver todas →
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <i className="ti ti-loader-2 animate-spin text-sand-900/20 dark:text-night-50/20 text-xl" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-sand-900/30 dark:text-night-50/30">
              <i className="ti ti-speakerphone text-3xl" />
              <p className="text-sm">Sin campañas todavía</p>
              <button
                onClick={() => navigate('/campaigns/new')}
                className="text-xs text-[#C9973A] hover:underline"
              >
                Crear primera campaña →
              </button>
            </div>
          ) : (
            <div className="divide-y divide-black/5 dark:divide-white/5">
              {campaigns.map((c) => {
                const openRate =
                  c.stats && c.stats.emails_sent > 0
                    ? (c.stats.emails_opened / c.stats.emails_sent) * 100
                    : null

                return (
                  <div
                    key={c.id}
                    onClick={() => navigate(`/campaigns/${c.id}`)}
                    className="px-5 py-3.5 flex items-center gap-3 cursor-pointer hover:bg-black/2 dark:hover:bg-white/2 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#C9973A]/10 flex items-center justify-center flex-shrink-0">
                      <i className="ti ti-speakerphone text-[#C9973A] text-sm" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-sans font-medium text-sand-900 dark:text-night-50 truncate">
                        {c.name}
                      </p>
                      <p className="text-xs text-sand-900/40 dark:text-night-50/40 mt-0.5">
                        {formatNumber(c.total_contacts)} contactos
                        {c.stats?.emails_sent
                          ? ` · ${formatNumber(c.stats.emails_sent)} enviados`
                          : ''}
                      </p>
                    </div>
                    <StatusBadge status={c.status} />
                    {openRate !== null && (
                      <div className="text-right hidden sm:block w-14">
                        <p className="text-[10px] text-sand-900/40 dark:text-night-50/40 uppercase tracking-wide">open</p>
                        <p className="text-sm font-sans font-semibold text-sand-900 dark:text-night-50">
                          {formatPercent(openRate)}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Activity feed — 2 cols */}
        <div className="col-span-2 bg-white dark:bg-[#1A1510] rounded-xl border border-black/8 dark:border-white/8 shadow-sm">
          <div className="px-5 py-4 border-b border-black/8 dark:border-white/8 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-sand-900 dark:text-night-50">
              Actividad reciente
            </h2>
            <button
              onClick={() => navigate('/audit')}
              className="text-xs font-sans text-[#C9973A] hover:underline"
            >
              Ver todo →
            </button>
          </div>

          {recentActivity.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-sand-900/30 dark:text-night-50/30">
              <i className="ti ti-activity text-3xl" />
              <p className="text-sm">Sin actividad aún</p>
            </div>
          ) : (
            <div className="divide-y divide-black/5 dark:divide-white/5">
              {recentActivity.map((entry) => {
                const cfg = ACTION_ICON[entry.action] ?? {
                  icon: 'ti-circle-dot',
                  color: 'text-sand-400 bg-sand-100 dark:bg-night-700',
                }
                const actor = entry.actor_email?.split('@')[0] ?? 'Sistema'
                const resource = RESOURCE_LABEL[entry.resource_type] ?? entry.resource_type
                const verb = ACTION_LABEL[entry.action] ?? entry.action

                return (
                  <div key={entry.id} className="px-4 py-3 flex items-start gap-3">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.color}`}>
                      <i className={`ti ${cfg.icon} text-xs`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-sans text-sand-900 dark:text-night-50 leading-snug">
                        <span className="font-medium">{actor}</span>
                        {' '}{verb}{' '}
                        {entry.resource_name
                          ? <span className="text-sand-900/70 dark:text-night-50/70">"{entry.resource_name}"</span>
                          : <span className="text-sand-900/50 dark:text-night-50/50">{resource}</span>
                        }
                      </p>
                      <p className="text-[10px] text-sand-900/35 dark:text-night-50/35 mt-0.5">
                        {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: es })}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    sent:       { label: 'Enviada',    cls: 'px-2 py-0.5 rounded-full text-xs font-medium bg-[#2BB5A0]/15 text-[#0D7A64] dark:text-[#2BB5A0]' },
    generating: { label: 'Generando', cls: 'px-2 py-0.5 rounded-full text-xs font-medium bg-[#C9973A]/15 text-[#8C5E0A] dark:text-[#C9973A]' },
    queued:     { label: 'En cola',   cls: 'px-2 py-0.5 rounded-full text-xs font-medium bg-[#C9973A]/10 text-[#8C5E0A] dark:text-[#C9973A]' },
    ready:      { label: 'Lista',     cls: 'px-2 py-0.5 rounded-full text-xs font-medium bg-[#2BB5A0]/15 text-[#0D7A64] dark:text-[#2BB5A0]' },
    draft:      { label: 'Borrador',  cls: 'px-2 py-0.5 rounded-full text-xs font-medium bg-black/5 dark:bg-white/8 text-sand-900/50 dark:text-night-50/50' },
    archived:   { label: 'Archivada', cls: 'px-2 py-0.5 rounded-full text-xs font-medium bg-black/5 dark:bg-white/8 text-sand-900/40 dark:text-night-50/40' },
  }
  const { label, cls } = map[status] ?? { label: status, cls: 'px-2 py-0.5 rounded-full text-xs' }
  return <span className={cls}>{label}</span>
}
