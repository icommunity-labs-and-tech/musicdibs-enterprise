import { formatPercent } from '@/lib/utils'

const metrics = [
  { label: 'Open rate', value: 68.4, benchmark: 22, icon: 'ti-mail-opened', color: 'gold' },
  { label: 'Play rate', value: 41.2, benchmark: 0, icon: 'ti-player-play', color: 'teal' },
  { label: 'Completion rate', value: 73.8, benchmark: 0, icon: 'ti-check', color: 'teal' },
  { label: 'Click rate', value: 18.6, benchmark: 3.1, icon: 'ti-cursor-text', color: 'gold' },
]

const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun']
const openRates = [0, 0, 0, 54.2, 61.8, 68.4]
const playRates = [0, 0, 0, 28.3, 35.7, 41.2]

export function Analytics() {
  const maxRate = 80

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl text-sand-900 dark:text-night-50 font-semibold">
          Analytics
        </h1>
        <p className="text-sm text-sand-900/50 dark:text-night-50/50 mt-0.5">
          Rendimiento de campañas · Mayo 2026
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {metrics.map(({ label, value, benchmark, icon, color }) => (
          <div key={label} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-sans text-sand-900/50 dark:text-night-50/50 uppercase tracking-wide">{label}</p>
              <i className={`ti ${icon} text-base ${color === 'gold' ? 'text-[#C9973A]' : 'text-[#2BB5A0]'}`} />
            </div>
            <p className="font-display text-3xl font-semibold text-sand-900 dark:text-night-50">
              {formatPercent(value)}
            </p>
            {benchmark > 0 && (
              <p className="text-xs text-[#0D7A64] dark:text-[#2BB5A0] mt-1 flex items-center gap-1">
                <i className="ti ti-trending-up text-xs" />
                +{formatPercent(value - benchmark)} vs. industria ({formatPercent(benchmark)})
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="card p-5">
        <h2 className="font-display text-base font-semibold text-sand-900 dark:text-night-50 mb-5">
          Evolución mensual
        </h2>
        <div className="flex items-end gap-4 h-40">
          {months.map((m, i) => (
            <div key={m} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex gap-1 items-end" style={{ height: 120 }}>
                <div
                  className="flex-1 rounded-t-md bg-[#C9973A]/70 transition-all duration-500"
                  style={{ height: `${(openRates[i] / maxRate) * 120}px` }}
                />
                <div
                  className="flex-1 rounded-t-md bg-[#2BB5A0]/70 transition-all duration-500"
                  style={{ height: `${(playRates[i] / maxRate) * 120}px` }}
                />
              </div>
              <p className="text-xs text-sand-900/40 dark:text-night-50/40">{m}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#C9973A]/70" />
            <span className="text-xs text-sand-900/60 dark:text-night-50/60">Open rate</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#2BB5A0]/70" />
            <span className="text-xs text-sand-900/60 dark:text-night-50/60">Play rate</span>
          </div>
        </div>
      </div>

      {/* ROI */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Ingresos atribuidos', value: '€12,840', icon: 'ti-coin-euro', desc: '+34% vs. control group' },
          { label: 'ROI de campaña', value: '5,424%', icon: 'ti-trending-up', desc: '€236.93 invertidos' },
          { label: 'Coste por conversión', value: '€4.21', icon: 'ti-target', desc: 'vs. €18.40 canal tradicional' },
        ].map(({ label, value, icon, desc }) => (
          <div key={label} className="card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-[#2BB5A0]/12 flex items-center justify-center">
                <i className={`ti ${icon} text-[#0D7A64] dark:text-[#2BB5A0] text-base`} />
              </div>
              <p className="text-xs font-sans text-sand-900/50 dark:text-night-50/50 uppercase tracking-wide">{label}</p>
            </div>
            <p className="font-display text-2xl font-semibold text-sand-900 dark:text-night-50">{value}</p>
            <p className="text-xs text-[#0D7A64] dark:text-[#2BB5A0] mt-1">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
