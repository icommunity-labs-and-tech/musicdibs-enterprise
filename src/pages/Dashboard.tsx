import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase, type Campaign, type CampaignStats } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils'

interface CampaignWithStats extends Campaign {
  stats?: CampaignStats
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
        .limit(10)
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

  // Merge stats into campaigns
  const campaignsWithStats: CampaignWithStats[] = campaigns.map((c) => ({
    ...c,
    stats: stats.find((s) => s.campaign_id === c.id),
  }))

  // Aggregate KPIs
  const totalSent = stats.reduce((sum, s) => sum + s.emails_sent, 0)
  const totalOpened = stats.reduce((sum, s) => sum + s.emails_opened, 0)
  const totalClicked = stats.reduce((sum, s) => sum + s.emails_clicked, 0)
  const openRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0
  const clickRate = totalSent > 0 ? (totalClicked / totalSent) * 100 : 0
  const activeCampaigns = campaigns.filter((c) => ['queued', 'generating', 'ready'].includes(c.status)).length

  return {
    campaigns: campaignsWithStats,
    isLoading: loadingCampaigns,
    kpis: { activeCampaigns, totalSent, openRate, clickRate },
  }
}

export function Dashboard() {
  const navigate = useNavigate()
  const { tenant } = useAuth()
  const { campaigns, isLoading, kpis } = useDashboardData()

  const kpiCards = [
    { label: 'Campañas activas',    value: String(kpis.activeCampaigns),             icon: 'ti-speakerphone',  color: 'gold' },
    { label: 'Emails enviados',     value: formatNumber(kpis.totalSent),              icon: 'ti-mail',          color: 'teal' },
    { label: 'Open rate promedio',  value: formatPercent(kpis.openRate),              icon: 'ti-mail-opened',   color: 'gold' },
    { label: 'Click rate promedio', value: formatPercent(kpis.clickRate),             icon: 'ti-cursor-text',   color: 'teal' },
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl text-sand-900 dark:text-night-50 font-semibold">
          Panel de control
        </h1>
        <p className="text-sm text-sand-900/50 dark:text-night-50/50 mt-0.5">
          {new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric', day: 'numeric' })}
          {tenant ? ` · ${tenant.name}` : ''}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {kpiCards.map(({ label, value, icon, color }) => (
          <div key={label} className="bg-white dark:bg-[#1A1510] rounded-xl border border-black/8 dark:border-white/8 shadow-sm p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-sans text-sand-900/50 dark:text-night-50/50 uppercase tracking-wide">
                  {label}
                </p>
                <p className={`font-display text-2xl font-semibold mt-1 ${isLoading ? 'opacity-30' : ''} text-sand-900 dark:text-night-50`}>
                  {isLoading ? '–' : value}
                </p>
              </div>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                color === 'gold'
                  ? 'bg-[#C9973A]/15 text-[#8C5E0A] dark:text-[#C9973A]'
                  : 'bg-[#2BB5A0]/15 text-[#0D7A64] dark:text-[#2BB5A0]'
              }`}>
                <i className={`ti ${icon} text-lg`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Campaigns list */}
      <div className="bg-white dark:bg-[#1A1510] rounded-xl border border-black/8 dark:border-white/8 shadow-sm">
        <div className="px-5 py-4 border-b border-black/8 dark:border-white/8 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-sand-900 dark:text-night-50">
            Campañas recientes
          </h2>
          <button onClick={() => navigate('/campaigns')} className="text-xs font-sans text-[#C9973A] hover:underline">
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
            <button onClick={() => navigate('/campaigns/new')}
              className="text-xs text-[#C9973A] hover:underline">
              Crear primera campaña →
            </button>
          </div>
        ) : (
          <div className="divide-y divide-black/5 dark:divide-white/5">
            {campaigns.map((c) => {
              const openRate = c.stats && c.stats.emails_sent > 0
                ? (c.stats.emails_opened / c.stats.emails_sent) * 100
                : null

              return (
                <div key={c.id} className="px-5 py-4 flex items-center gap-4">
                  <div className="w-9 h-9 rounded-lg bg-[#C9973A]/10 flex items-center justify-center flex-shrink-0">
                    <i className="ti ti-speakerphone text-[#C9973A]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-sans font-medium text-sand-900 dark:text-night-50 truncate">
                      {c.name}
                    </p>
                    <p className="text-xs text-sand-900/40 dark:text-night-50/40 mt-0.5">
                      {formatNumber(c.total_contacts)} contactos
                      {c.cost_estimate ? ` · ${formatCurrency(c.cost_estimate)}` : ''}
                    </p>
                  </div>
                  <StatusBadge status={c.status} />
                  {openRate !== null && (
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-sand-900/40 dark:text-night-50/40">open</p>
                      <p className="text-sm font-sans font-semibold text-sand-900 dark:text-night-50">
                        {formatPercent(openRate)}
                      </p>
                    </div>
                  )}
                  {c.status === 'generating' && (
                    <button
                      onClick={() => navigate(`/campaigns/${c.id}/queue`)}
                      className="text-xs text-[#C9973A] hover:underline flex-shrink-0"
                    >
                      Ver cola →
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

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
