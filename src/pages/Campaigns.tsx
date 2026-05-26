import { useCampaignStore } from '@/store/campaignStore'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'

export function Campaigns() {
  const { campaigns } = useCampaignStore()
  const navigate = useNavigate()

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-sand-900 dark:text-night-50 font-semibold">
            Campañas
          </h1>
          <p className="text-sm text-sand-900/50 dark:text-night-50/50 mt-0.5">
            {campaigns.length} campañas en total
          </p>
        </div>
        <button onClick={() => navigate('/campaigns/new')} className="btn-primary">
          <i className="ti ti-plus text-sm" />
          Nueva campaña
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/8 dark:border-white/8">
              {['Nombre', 'Vertical', 'Contactos', 'Progreso', 'Open rate', 'Coste', 'Estado'].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-xs font-sans font-medium text-sand-900/40 dark:text-night-50/40 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 dark:divide-white/5">
            {campaigns.map((c) => (
              <tr
                key={c.id}
                className="hover:bg-black/2 dark:hover:bg-white/2 transition-colors cursor-pointer"
                onClick={() => c.status === 'generating' && navigate(`/campaigns/${c.id}/queue`)}
              >
                <td className="px-5 py-4">
                  <p className="font-sans font-medium text-sand-900 dark:text-night-50">{c.name}</p>
                  <p className="text-xs text-sand-900/40 dark:text-night-50/40 mt-0.5">{c.type}</p>
                </td>
                <td className="px-5 py-4">
                  <span className="badge badge-gold capitalize">{c.vertical}</span>
                </td>
                <td className="px-5 py-4 text-sand-900/70 dark:text-night-50/70">
                  {formatNumber(c.totalContacts)}
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-black/8 dark:bg-white/8 rounded-full overflow-hidden" style={{ width: 80 }}>
                      <div
                        className="h-full bg-[#C9973A] rounded-full transition-all"
                        style={{ width: `${(c.generatedCount / c.totalContacts) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-sand-900/40 dark:text-night-50/40">
                      {Math.round((c.generatedCount / c.totalContacts) * 100)}%
                    </span>
                  </div>
                </td>
                <td className="px-5 py-4 text-sand-900/70 dark:text-night-50/70">
                  {c.openRate ? formatPercent(c.openRate) : '—'}
                </td>
                <td className="px-5 py-4 font-mono text-sm text-sand-900/70 dark:text-night-50/70">
                  {c.cost > 0 ? formatCurrency(c.cost) : '—'}
                </td>
                <td className="px-5 py-4">
                  <StatusBadge status={c.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
