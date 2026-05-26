import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { format, parseISO, startOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { formatPercent, formatCurrency, formatNumber } from '@/lib/utils'
import type { Campaign, CampaignStats } from '@/lib/supabase'

// ── types ────────────────────────────────────────────────────────────────────
interface CampaignWithStats extends Campaign {
  stats: CampaignStats | null
}

interface MonthlyPoint {
  month: string
  coste: number
  enviados: number
  abiertos: number
}

// ── data hook ────────────────────────────────────────────────────────────────
function useAnalyticsData() {
  const { tenant } = useAuth()

  return useQuery({
    queryKey: ['analytics', tenant?.id],
    enabled: !!tenant?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const [{ data: campaigns, error: ce }, { data: stats, error: se }] = await Promise.all([
        supabase
          .from('campaigns')
          .select('*')
          .eq('tenant_id', tenant!.id)
          .order('created_at', { ascending: true }),
        supabase
          .from('campaign_stats')
          .select('*')
          .eq('tenant_id', tenant!.id),
      ])
      if (ce) throw ce
      if (se) throw se

      const statsMap = new Map((stats ?? []).map(s => [s.campaign_id, s]))
      const enriched: CampaignWithStats[] = (campaigns ?? []).map(c => ({
        ...c,
        stats: statsMap.get(c.id) ?? null,
      }))

      // ── KPIs ──
      const sent = enriched.reduce((acc, c) => acc + (c.stats?.emails_sent ?? 0), 0)
      const opened = enriched.reduce((acc, c) => acc + (c.stats?.emails_opened ?? 0), 0)
      const clicked = enriched.reduce((acc, c) => acc + (c.stats?.emails_clicked ?? 0), 0)
      const totalCost = enriched.reduce((acc, c) => acc + (c.stats?.cost_actual ?? c.cost_estimate ?? 0), 0)

      const avgOpenRate = sent > 0 ? (opened / sent) * 100 : 0
      const avgClickRate = sent > 0 ? (clicked / sent) * 100 : 0
      const avgCTOR = opened > 0 ? (clicked / opened) * 100 : 0
      const costPerOpen = opened > 0 ? totalCost / opened : 0

      // ── per-campaign bar chart data (last 8 with stats) ──
      const campaignBars = enriched
        .filter(c => c.stats && (c.stats.emails_sent ?? 0) > 0)
        .slice(-8)
        .map(c => ({
          name: c.name.length > 20 ? c.name.slice(0, 18) + '…' : c.name,
          'Open rate': c.stats!.emails_sent > 0
            ? Math.round((c.stats!.emails_opened / c.stats!.emails_sent) * 1000) / 10
            : 0,
          'Click rate': c.stats!.emails_sent > 0
            ? Math.round((c.stats!.emails_clicked / c.stats!.emails_sent) * 1000) / 10
            : 0,
        }))

      // ── monthly area chart ──
      const monthlyMap = new Map<string, MonthlyPoint>()
      enriched.forEach(c => {
        const key = format(startOfMonth(parseISO(c.created_at)), 'yyyy-MM')
        const existing = monthlyMap.get(key) ?? {
          month: format(parseISO(c.created_at), 'MMM yy', { locale: es }),
          coste: 0, enviados: 0, abiertos: 0,
        }
        existing.coste += c.stats?.cost_actual ?? c.cost_estimate ?? 0
        existing.enviados += c.stats?.emails_sent ?? 0
        existing.abiertos += c.stats?.emails_opened ?? 0
        monthlyMap.set(key, existing)
      })
      const monthly = Array.from(monthlyMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, v]) => v)

      // ── vertical breakdown ──
      const verticalMap = new Map<string, { cost: number; count: number }>()
      enriched.forEach(c => {
        const v = c.vertical ?? 'other'
        const ex = verticalMap.get(v) ?? { cost: 0, count: 0 }
        ex.cost += c.stats?.cost_actual ?? c.cost_estimate ?? 0
        ex.count += 1
        verticalMap.set(v, ex)
      })
      const verticals = Array.from(verticalMap.entries())
        .sort(([, a], [, b]) => b.cost - a.cost)
        .map(([label, data]) => ({ label: VERTICAL_LABELS[label] ?? label, ...data }))

      return {
        kpis: { sent, opened, clicked, totalCost, avgOpenRate, avgClickRate, avgCTOR, costPerOpen },
        campaignBars,
        monthly,
        verticals,
        totalCampaigns: enriched.length,
      }
    },
  })
}

// ── labels ───────────────────────────────────────────────────────────────────
const VERTICAL_LABELS: Record<string, string> = {
  insurance: 'Seguros',
  banking: 'Banca',
  music: 'Música',
  retail: 'Retail',
  telecom: 'Teleco',
  real_estate: 'Inmobiliaria',
  other: 'Otro',
}

// ── custom tooltip ────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-night-800 border border-sand-200 dark:border-night-600 rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="font-medium text-sand-900 dark:text-night-50 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }} className="flex gap-2 justify-between">
          <span>{p.name}</span>
          <span className="font-semibold tabular-nums">{
            p.name.toLowerCase().includes('coste')
              ? formatCurrency(p.value)
              : p.name.toLowerCase().includes('rate')
              ? formatPercent(p.value)
              : formatNumber(p.value)
          }</span>
        </p>
      ))}
    </div>
  )
}

// ── empty state ───────────────────────────────────────────────────────────────
function EmptyAnalytics() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-sand-100 dark:bg-night-700 flex items-center justify-center">
        <i className="ti ti-chart-bar text-2xl text-sand-400 dark:text-night-400" />
      </div>
      <div>
        <p className="font-medium text-sand-900 dark:text-night-50">Sin datos aún</p>
        <p className="text-sm text-sand-900/50 dark:text-night-50/50 mt-1">
          Los analytics aparecerán en cuanto lances y completes tu primera campaña.
        </p>
      </div>
    </div>
  )
}

// ── KPI card ─────────────────────────────────────────────────────────────────
interface KpiCardProps {
  icon: string
  label: string
  value: string
  sub?: string
  accent?: 'gold' | 'teal' | 'neutral'
}
function KpiCard({ icon, label, value, sub, accent = 'neutral' }: KpiCardProps) {
  const accentCls = {
    gold: 'bg-gold-50 dark:bg-gold-900/20 text-gold-600 dark:text-gold-400',
    teal: 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400',
    neutral: 'bg-sand-100 dark:bg-night-700 text-sand-500 dark:text-night-400',
  }[accent]

  return (
    <div className="bg-white dark:bg-night-800 border border-sand-200 dark:border-night-700 rounded-2xl p-5 flex flex-col gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accentCls}`}>
        <i className={`ti ${icon} text-lg`} />
      </div>
      <div>
        <p className="text-xs text-sand-900/50 dark:text-night-50/50 font-medium uppercase tracking-wide">{label}</p>
        <p className="font-display text-2xl font-semibold text-sand-900 dark:text-night-50 mt-0.5 tabular-nums">{value}</p>
        {sub && <p className="text-xs text-sand-900/40 dark:text-night-50/40 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── main component ───────────────────────────────────────────────────────────
export function Analytics() {
  const { data, isLoading, error } = useAnalyticsData()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="rounded-2xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 p-6 text-sm text-red-700 dark:text-red-400">
          Error cargando analytics: {(error as Error).message}
        </div>
      </div>
    )
  }

  const hasData = (data?.kpis.sent ?? 0) > 0 || (data?.totalCampaigns ?? 0) > 0

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">

      {/* header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl text-sand-900 dark:text-night-50 font-semibold">
            Analytics
          </h1>
          <p className="text-sm text-sand-900/50 dark:text-night-50/50 mt-0.5">
            {data?.totalCampaigns
              ? `${data.totalCampaigns} campaña${data.totalCampaigns !== 1 ? 's' : ''} · datos en tiempo real`
              : 'Rendimiento de campañas'}
          </p>
        </div>
      </div>

      {!hasData ? <EmptyAnalytics /> : (
        <>
          {/* KPI grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              icon="ti-send"
              label="Emails enviados"
              value={formatNumber(data!.kpis.sent)}
              sub={`${data!.totalCampaigns} campañas`}
              accent="neutral"
            />
            <KpiCard
              icon="ti-mail-opened"
              label="Open rate"
              value={formatPercent(data!.kpis.avgOpenRate)}
              sub="promedio"
              accent="gold"
            />
            <KpiCard
              icon="ti-cursor-text"
              label="Click rate"
              value={formatPercent(data!.kpis.avgClickRate)}
              sub={`CTOR: ${formatPercent(data!.kpis.avgCTOR)}`}
              accent="teal"
            />
            <KpiCard
              icon="ti-coin-euro"
              label="Coste total"
              value={formatCurrency(data!.kpis.totalCost)}
              sub={data!.kpis.costPerOpen > 0 ? `${formatCurrency(data!.kpis.costPerOpen)} / apertura` : undefined}
              accent="neutral"
            />
          </div>

          {/* charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* open + click rate per campaign */}
            <div className="bg-white dark:bg-night-800 border border-sand-200 dark:border-night-700 rounded-2xl p-5">
              <p className="text-sm font-semibold text-sand-900 dark:text-night-50 mb-4">
                Open & Click rate por campaña
              </p>
              {data!.campaignBars.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-sm text-sand-900/40 dark:text-night-50/40">
                  Sin campañas completadas aún
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data!.campaignBars} barCategoryGap="30%" barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5 }}
                      axisLine={false} tickLine={false}
                    />
                    <YAxis
                      tickFormatter={v => `${v}%`}
                      tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5 }}
                      axisLine={false} tickLine={false}
                      domain={[0, 100]}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'currentColor', opacity: 0.04 }} />
                    <Legend
                      wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
                      formatter={(v) => <span style={{ color: 'currentcolor', opacity: 0.6 }}>{v}</span>}
                    />
                    <Bar dataKey="Open rate" fill="#C9A84C" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Click rate" fill="#2DD4BF" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* monthly cost + emails sent */}
            <div className="bg-white dark:bg-night-800 border border-sand-200 dark:border-night-700 rounded-2xl p-5">
              <p className="text-sm font-semibold text-sand-900 dark:text-night-50 mb-4">
                Actividad mensual
              </p>
              {data!.monthly.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-sm text-sand-900/40 dark:text-night-50/40">
                  Sin datos mensuales
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={data!.monthly}>
                    <defs>
                      <linearGradient id="colorCoste" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#C9A84C" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#C9A84C" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorEnviados" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2DD4BF" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#2DD4BF" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5 }}
                      axisLine={false} tickLine={false}
                    />
                    <YAxis
                      yAxisId="coste"
                      orientation="left"
                      tickFormatter={v => `${v}€`}
                      tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5 }}
                      axisLine={false} tickLine={false}
                    />
                    <YAxis
                      yAxisId="enviados"
                      orientation="right"
                      tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5 }}
                      axisLine={false} tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
                      formatter={(v) => <span style={{ color: 'currentcolor', opacity: 0.6 }}>{v}</span>}
                    />
                    <Area
                      yAxisId="coste"
                      type="monotone"
                      dataKey="coste"
                      name="Coste (€)"
                      stroke="#C9A84C"
                      strokeWidth={2}
                      fill="url(#colorCoste)"
                      dot={false}
                    />
                    <Area
                      yAxisId="enviados"
                      type="monotone"
                      dataKey="enviados"
                      name="Enviados"
                      stroke="#2DD4BF"
                      strokeWidth={2}
                      fill="url(#colorEnviados)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* bottom row: vertical breakdown + secondary KPIs */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* vertical breakdown */}
            <div className="lg:col-span-2 bg-white dark:bg-night-800 border border-sand-200 dark:border-night-700 rounded-2xl p-5">
              <p className="text-sm font-semibold text-sand-900 dark:text-night-50 mb-4">
                Coste por vertical
              </p>
              {data!.verticals.length === 0 ? (
                <div className="h-24 flex items-center justify-center text-sm text-sand-900/40 dark:text-night-50/40">
                  Sin datos
                </div>
              ) : (
                <div className="space-y-3">
                  {data!.verticals.map(v => {
                    const maxCost = data!.verticals[0].cost || 1
                    const pct = (v.cost / maxCost) * 100
                    return (
                      <div key={v.label} className="flex items-center gap-3">
                        <span className="w-24 text-xs text-sand-900/60 dark:text-night-50/60 shrink-0">{v.label}</span>
                        <div className="flex-1 h-2 bg-sand-100 dark:bg-night-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gold-400 transition-all duration-700"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-20 text-right text-xs font-medium tabular-nums text-sand-900/70 dark:text-night-50/70">
                          {formatCurrency(v.cost)}
                        </span>
                        <span className="w-14 text-right text-xs text-sand-900/40 dark:text-night-50/40 tabular-nums">
                          {v.count} camp.
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* secondary KPIs */}
            <div className="flex flex-col gap-3">
              <div className="flex-1 bg-white dark:bg-night-800 border border-sand-200 dark:border-night-700 rounded-2xl p-5 flex flex-col justify-between">
                <p className="text-xs text-sand-900/50 dark:text-night-50/50 font-medium uppercase tracking-wide">
                  Emails abiertos
                </p>
                <p className="font-display text-3xl font-semibold text-sand-900 dark:text-night-50 tabular-nums">
                  {formatNumber(data!.kpis.opened)}
                </p>
                <p className="text-xs text-sand-900/40 dark:text-night-50/40">
                  de {formatNumber(data!.kpis.sent)} enviados
                </p>
              </div>
              <div className="flex-1 bg-white dark:bg-night-800 border border-sand-200 dark:border-night-700 rounded-2xl p-5 flex flex-col justify-between">
                <p className="text-xs text-sand-900/50 dark:text-night-50/50 font-medium uppercase tracking-wide">
                  Clicks totales
                </p>
                <p className="font-display text-3xl font-semibold text-sand-900 dark:text-night-50 tabular-nums">
                  {formatNumber(data!.kpis.clicked)}
                </p>
                <p className="text-xs text-sand-900/40 dark:text-night-50/40">
                  CTOR {formatPercent(data!.kpis.avgCTOR)}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
