import { useCampaignStore } from '@/store/campaignStore'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'

const kpis = [
  { label: 'Campañas activas', value: '2', icon: 'ti-speakerphone', color: 'gold' },
  { label: 'Assets generados', value: '1,478', icon: 'ti-wave-sine', color: 'teal' },
  { label: 'Open rate promedio', value: '68.4%', icon: 'ti-mail-opened', color: 'gold' },
  { label: 'Play rate promedio', value: '41.2%', icon: 'ti-player-play', color: 'teal' },
]

export function Dashboard() {
  const { campaigns } = useCampaignStore()
  const navigate = useNavigate()

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl text-sand-900 dark:text-night-50 font-semibold">
          Panel de control
        </h1>
        <p className="text-sm text-sand-900/50 dark:text-night-50/50 mt-0.5">
          Mayo 2026 · Seguros Demo SA
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon, color }) => (
          <div key={label} className="bg-white dark:bg-[#1A1510] rounded-xl border border-black/8 dark:border-white/8 shadow-sm p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-sans text-sand-900/50 dark:text-night-50/50 uppercase tracking-wide">
                  {label}
                </p>
                <p className="font-display text-2xl font-semibold mt-1 text-sand-900 dark:text-night-50">
                  {value}
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
          <button
            onClick={() => navigate('/campaigns')}
            className="text-xs font-sans text-[#C9973A] hover:underline"
          >
            Ver todas →
          </button>
        </div>
        <div className="divide-y divide-black/5 dark:divide-white/5">
          {campaigns.map((c) => (
            <div key={c.id} className="px-5 py-4 flex items-center gap-4">
              <div className="w-9 h-9 rounded-lg bg-[#C9973A]/10 flex items-center justify-center flex-shrink-0">
                <i className="ti ti-speakerphone text-[#C9973A]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-sans font-medium text-sand-900 dark:text-night-50 truncate">
                  {c.name}
                </p>
                <p className="text-xs text-sand-900/40 dark:text-night-50/40 mt-0.5">
                  {formatNumber(c.totalContacts)} contactos · {formatCurrency(c.cost)}
                </p>
              </div>
              <StatusBadge status={c.status} />
              {c.openRate && (
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-sand-900/40 dark:text-night-50/40">open</p>
                  <p className="text-sm font-sans font-semibold text-sand-900 dark:text-night-50">
                    {formatPercent(c.openRate)}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: 'Activa', cls: 'badge-teal' },
    generating: { label: 'Generando', cls: 'badge-gold' },
    draft: { label: 'Borrador', cls: 'badge bg-black/5 dark:bg-white/8 text-sand-900/50 dark:text-night-50/50' },
    paused: { label: 'Pausada', cls: 'badge-red' },
    completed: { label: 'Completada', cls: 'badge bg-black/5 dark:bg-white/8 text-sand-900/50 dark:text-night-50/50' },
  }
  const { label, cls } = map[status] ?? { label: status, cls: 'badge' }
  return <span className={cls}>{label}</span>
}
