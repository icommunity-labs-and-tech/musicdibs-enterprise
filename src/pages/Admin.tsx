import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/store/toastStore'
import { cn, formatNumber, formatCurrency } from '@/lib/utils'
import type { Tenant, TenantPlan, GenerationJob } from '@/lib/supabase'

// ── types ─────────────────────────────────────────────────────────────────────
interface TenantUsage {
  tenant_id: string
  tenant_name: string
  slug: string
  plan: TenantPlan
  stripe_status: string | null
  setup_complete: boolean
  created_at: string
  campaigns_this_month: number
  campaigns_sent: number
  campaigns_ready: number
  campaigns_in_progress: number
  contacts_this_month: number
  emails_sent_this_month: number
  emails_opened_this_month: number
  user_count: number
  failed_jobs_this_month: number
}

interface PlatformSetting {
  key: string
  value: string | null
  description: string | null
  updated_at: string
}

interface AdminJob extends GenerationJob {
  tenant_name?: string
  campaign_name?: string
}

// ── constants ─────────────────────────────────────────────────────────────────
const PLAN_COLORS: Record<TenantPlan, string> = {
  starter:      'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  professional: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  enterprise:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
}
const STRIPE_COLORS: Record<string, string> = {
  active:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  trialing: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  past_due: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  canceled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  inactive: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  unpaid:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}
const JOB_STATUS_STYLES: Record<string, string> = {
  queued:     'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  processing: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  done:       'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  failed:     'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
}
const PLAN_MRR: Record<TenantPlan, number> = {
  starter: 299, professional: 799, enterprise: 1999,
}
const PLAN_OPTIONS: TenantPlan[] = ['starter', 'professional', 'enterprise']
const TABS = ['Tenants', 'Platform Config', 'Jobs Monitor', 'Audit Log'] as const
type Tab = typeof TABS[number]

// ── helpers ───────────────────────────────────────────────────────────────────
const inp = 'w-full px-3 py-2 rounded-lg text-sm bg-[#F5EFE6] dark:bg-[#0C0A08] border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-[#C9973A]/30 font-mono'

// ── main ──────────────────────────────────────────────────────────────────────
export function Admin() {
  const { profile } = useAuth()
  const [tab, setTab] = useState<Tab>('Tenants')

  if (!profile?.is_superadmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 py-24">
        <i className="ti ti-shield-lock text-5xl text-sand-900/20 dark:text-night-50/20" />
        <p className="text-sand-900/50 dark:text-night-50/50 text-sm">Acceso restringido a superadmins.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-semibold">
          <i className="ti ti-shield-lock text-xs" /> SUPERADMIN
        </span>
        <h1 className="font-display text-2xl font-semibold text-sand-900 dark:text-night-50">Admin Panel</h1>
      </div>

      {/* tabs */}
      <div className="flex gap-1 bg-black/4 dark:bg-white/4 rounded-xl p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
              tab === t
                ? 'bg-white dark:bg-night-700 text-sand-900 dark:text-night-50 shadow-sm'
                : 'text-sand-900/50 dark:text-night-50/50 hover:text-sand-900 dark:hover:text-night-50'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Tenants'         && <TenantsTab />}
      {tab === 'Platform Config' && <PlatformConfigTab />}
      {tab === 'Jobs Monitor'    && <JobsMonitorTab />}
      {tab === 'Audit Log'       && <AuditLogTab />}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 1 — Tenants
// ══════════════════════════════════════════════════════════════════════════════
function TenantsTab() {
  const toast = useToast()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  const { data: rows = [], isLoading } = useQuery<TenantUsage[]>({
    queryKey: ['admin', 'tenant_usage'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tenant_monthly_usage' as any).select('*').order('created_at', { ascending: false })
      if (error) throw error
      return data as TenantUsage[]
    },
    staleTime: 30_000,
  })

  const { data: churnSignals = [] } = useQuery<{ tenant_id: string; churn_risk: string; last_campaign_at: string | null; billing_issue: boolean; failed_jobs_7d: number }[]>({
    queryKey: ['admin', 'churn_signals'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tenant_churn_signals' as any).select('tenant_id,churn_risk,last_campaign_at,billing_issue,failed_jobs_7d')
      if (error) throw error
      return data as any[]
    },
    staleTime: 60_000,
  })

  const churnMap = Object.fromEntries(churnSignals.map(s => [s.tenant_id, s]))

  const { data: tenants = [] } = useQuery<Tenant[]>({
    queryKey: ['admin', 'tenants_raw'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tenants').select('*')
      if (error) throw error
      return data
    },
  })

  const activeTenants = rows.filter(r => r.stripe_status === 'active' || r.stripe_status === 'trialing')
  const mrr = activeTenants.reduce((s, r) => s + PLAN_MRR[r.plan], 0)
  const totalEmails = rows.reduce((s, r) => s + Number(r.emails_sent_this_month), 0)
  const failedJobs = rows.reduce((s, r) => s + Number(r.failed_jobs_this_month), 0)
  const atRiskCount = churnSignals.filter(s => s.churn_risk === 'at_risk' || s.churn_risk === 'critical').length

  const filtered = rows.filter(r =>
    !search || r.tenant_name.toLowerCase().includes(search.toLowerCase()) || r.slug.includes(search.toLowerCase())
  )

  const updateTenant = useMutation({
    mutationFn: async (patch: { id: string } & Partial<Tenant>) => {
      const { id, ...rest } = patch
      const { error } = await supabase.from('tenants').update(rest).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] })
      toast.success('Tenant actualizado')
      setEditingId(null)
    },
    onError: (err: any) => toast.error('Error', err.message),
  })

  const editingTenant = tenants.find(t => t.id === editingId) ?? null

  return (
    <div className="space-y-4">
      {/* churn alerts */}
      {churnSignals.filter(s => s.churn_risk === 'critical' || s.churn_risk === 'at_risk').length > 0 && (
        <div className="rounded-2xl border border-orange-200 dark:border-orange-700/40 bg-orange-50 dark:bg-orange-900/10 p-4">
          <div className="flex items-center gap-2 mb-2">
            <i className="ti ti-heart-broken text-orange-500 text-base" />
            <p className="text-sm font-semibold text-orange-700 dark:text-orange-400">
              {churnSignals.filter(s => s.churn_risk === 'critical' || s.churn_risk === 'at_risk').length} tenants requieren atención
            </p>
          </div>
          <div className="space-y-1">
            {churnSignals
              .filter(s => s.churn_risk === 'critical' || s.churn_risk === 'at_risk')
              .map(s => {
                const row = rows.find(r => r.tenant_id === s.tenant_id)
                if (!row) return null
                return (
                  <div key={s.tenant_id} className="flex items-center gap-2 text-xs">
                    <span className={cn('font-medium', s.churn_risk === 'critical' ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400')}>
                      {s.churn_risk === 'critical' ? '⚠ CRÍTICO' : '● riesgo'}
                    </span>
                    <Link to={`/admin/tenants/${s.tenant_id}`} className="font-medium text-sand-900 dark:text-night-50 hover:text-[#C9973A] transition-colors">
                      {row.tenant_name}
                    </Link>
                    <span className="text-sand-900/40 dark:text-night-50/40">
                      {s.churn_risk === 'critical' && s.billing_issue ? '— problema de facturación' : ''}
                      {s.churn_risk === 'at_risk' && !s.last_campaign_at ? '— sin campañas nunca' : ''}
                      {s.churn_risk === 'at_risk' && s.last_campaign_at ? `— última campaña ${formatDistanceToNow(new Date(s.last_campaign_at), { addSuffix: true, locale: es })}` : ''}
                    </span>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: 'ti-building',      label: 'Tenants activos',   value: `${activeTenants.length} / ${rows.length}`,       color: 'text-blue-500' },
          { icon: 'ti-currency-euro', label: 'MRR estimado',      value: `€${formatNumber(mrr)}`,                          color: 'text-emerald-500' },
          { icon: 'ti-heart-broken',  label: 'En riesgo',         value: String(atRiskCount), color: atRiskCount > 0 ? 'text-orange-500' : 'text-gray-400' },
          { icon: 'ti-alert-triangle',label: 'Jobs fallidos',     value: String(failedJobs), color: failedJobs > 0 ? 'text-red-500' : 'text-gray-400' },
        ].map(k => (
          <div key={k.label} className="bg-white dark:bg-night-800 rounded-2xl border border-black/6 dark:border-white/6 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-sand-900/50 dark:text-night-50/50">{k.label}</span>
              <i className={`ti ${k.icon} text-lg ${k.color}`} />
            </div>
            <p className="text-2xl font-semibold font-display text-sand-900 dark:text-night-50">{k.value}</p>
          </div>
        ))}
      </div>

      {/* table */}
      <div className="bg-white dark:bg-night-800 rounded-2xl border border-black/6 dark:border-white/6 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-black/6 dark:border-white/6">
          <div className="relative flex-1 max-w-xs">
            <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-sand-900/30 dark:text-night-50/30 text-sm pointer-events-none" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar tenant…"
              className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg bg-[#F5EFE6] dark:bg-[#0C0A08] border border-black/8 dark:border-white/8 focus:outline-none focus:ring-2 focus:ring-[#C9973A]/30 transition-all" />
          </div>
          <span className="text-xs text-sand-900/40 dark:text-night-50/40 ml-auto">{filtered.length} tenants</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-sand-900/40 dark:text-night-50/40">
            <i className="ti ti-loader-2 animate-spin text-xl" /><span className="text-sm">Cargando…</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/6 dark:border-white/6">
                  {['Organización', 'Plan', 'Stripe', 'Campañas / mes', 'Emails enviados', 'Usuarios', 'Creado', 'Acciones'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-sand-900/40 dark:text-night-50/40 px-4 py-2.5 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/4 dark:divide-white/4">
                {filtered.map(r => (
                  <tr key={r.tenant_id} className="hover:bg-black/2 dark:hover:bg-white/2 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-[#C9973A]/10 flex items-center justify-center shrink-0">
                          <i className="ti ti-building text-[#C9973A] text-sm" />
                        </div>
                        <div>
                          <p className="font-medium text-sand-900 dark:text-night-50 leading-tight">{r.tenant_name}</p>
                          <p className="text-xs text-sand-900/40 dark:text-night-50/40">{r.slug}</p>
                        </div>
                        {!r.setup_complete && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 font-medium">onboarding</span>
                        )}
                        {Number(r.failed_jobs_this_month) > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-medium">
                            {r.failed_jobs_this_month} err
                          </span>
                        )}
                        {(() => {
                          const sig = churnMap[r.tenant_id]
                          if (!sig) return null
                          if (sig.churn_risk === 'critical')
                            return <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-semibold">⚠ billing</span>
                          if (sig.churn_risk === 'at_risk')
                            return <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 font-medium">riesgo</span>
                          if (sig.churn_risk === 'warning')
                            return <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 font-medium">inactivo</span>
                          if (sig.churn_risk === 'churned')
                            return <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 font-medium">churned</span>
                          return null
                        })()}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-md', PLAN_COLORS[r.plan])}>{r.plan}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded-md', STRIPE_COLORS[r.stripe_status ?? 'inactive'] ?? STRIPE_COLORS.inactive)}>
                        {r.stripe_status ?? 'inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-sand-900/70 dark:text-night-50/70">
                      <span className="font-medium">{formatNumber(Number(r.campaigns_this_month))}</span>
                      <span className="text-xs text-sand-900/40 dark:text-night-50/40 ml-1">
                        ({r.campaigns_sent} env · {r.campaigns_in_progress} proc)
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-sand-900/70 dark:text-night-50/70">
                      {formatNumber(Number(r.emails_sent_this_month))}
                      {Number(r.emails_sent_this_month) > 0 && (
                        <span className="text-xs text-sand-900/40 dark:text-night-50/40 ml-1">
                          ({Math.round(Number(r.emails_opened_this_month) / Number(r.emails_sent_this_month) * 100)}% open)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-sand-900/70 dark:text-night-50/70">{r.user_count}</td>
                    <td className="px-4 py-3 text-xs text-sand-900/40 dark:text-night-50/40 whitespace-nowrap">
                      {format(new Date(r.created_at), 'dd MMM yy', { locale: es })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <Link
                          to={`/admin/tenants/${r.tenant_id}`}
                          className="p-1.5 rounded-lg hover:bg-black/6 dark:hover:bg-white/6 text-sand-900/50 dark:text-night-50/50 transition-colors"
                          title="Ver detalle 360"
                        >
                          <i className="ti ti-eye text-sm" />
                        </Link>
                        <button
                          onClick={() => setEditingId(r.tenant_id)}
                          className="p-1.5 rounded-lg hover:bg-black/6 dark:hover:bg-white/6 text-sand-900/50 dark:text-night-50/50 transition-colors"
                          title="Editar"
                        >
                          <i className="ti ti-edit text-sm" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingTenant && (
        <EditTenantModal
          tenant={editingTenant}
          onSave={patch => updateTenant.mutate({ id: editingTenant.id, ...patch })}
          onClose={() => setEditingId(null)}
          saving={updateTenant.isPending}
        />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 2 — Platform Config
// ══════════════════════════════════════════════════════════════════════════════
function PlatformConfigTab() {
  const toast = useToast()
  const qc = useQueryClient()
  const [dirty, setDirty] = useState<Record<string, string>>({})

  const { data: settings = [], isLoading } = useQuery<PlatformSetting[]>({
    queryKey: ['admin', 'platform_settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('platform_settings' as any).select('*').order('key')
      if (error) throw error
      return data as PlatformSetting[]
    },
  })

  const save = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { error } = await (supabase as any)
        .from('platform_settings')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('key', key)
      if (error) throw error
    },
    onSuccess: (_, { key }) => {
      qc.invalidateQueries({ queryKey: ['admin', 'platform_settings'] })
      setDirty(d => { const n = { ...d }; delete n[key]; return n })
      toast.success('Guardado', `${key} actualizado`)
    },
    onError: (err: any) => toast.error('Error', err.message),
  })

  const getValue = (key: string, fallback: string) => dirty[key] ?? fallback ?? ''

  if (isLoading) return <div className="flex justify-center py-16"><i className="ti ti-loader-2 animate-spin text-2xl text-sand-900/30 dark:text-night-50/30" /></div>

  // Group settings
  const kieSettings  = settings.filter(s => s.key.startsWith('kie'))
  const genSettings  = settings.filter(s => s.key.startsWith('generation'))
  const planSettings = settings.filter(s => s.key.startsWith('plan'))

  const SettingRow = ({ s }: { s: PlatformSetting }) => {
    const val = getValue(s.key, s.value ?? '')
    const isDirty = dirty[s.key] !== undefined
    const isJsonKey = s.key === 'plan_limits'

    return (
      <div className="flex items-start gap-4 py-4 border-b border-black/4 dark:border-white/4 last:border-0">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono font-medium text-sand-900 dark:text-night-50">{s.key}</p>
          {s.description && <p className="text-xs text-sand-900/40 dark:text-night-50/40 mt-0.5">{s.description}</p>}
          <p className="text-xs text-sand-900/30 dark:text-night-50/30 mt-0.5">
            Actualizado {formatDistanceToNow(new Date(s.updated_at), { addSuffix: true, locale: es })}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 w-80">
          {isJsonKey ? (
            <textarea
              value={val}
              onChange={e => setDirty(d => ({ ...d, [s.key]: e.target.value }))}
              rows={4}
              className={cn(inp, 'resize-y text-xs')}
            />
          ) : (
            <input
              value={val}
              onChange={e => setDirty(d => ({ ...d, [s.key]: e.target.value }))}
              className={inp}
            />
          )}
          <button
            onClick={() => save.mutate({ key: s.key, value: val })}
            disabled={!isDirty || save.isPending}
            className={cn(
              'px-3 py-2 rounded-lg text-xs font-medium transition-all shrink-0',
              isDirty
                ? 'bg-[#C9973A] text-white hover:bg-[#b8832e]'
                : 'bg-black/6 dark:bg-white/6 text-sand-900/30 dark:text-night-50/30 cursor-default'
            )}
          >
            {save.isPending ? <i className="ti ti-loader-2 animate-spin" /> : 'Guardar'}
          </button>
        </div>
      </div>
    )
  }

  const Section = ({ title, icon, items }: { title: string; icon: string; items: PlatformSetting[] }) => (
    <div className="bg-white dark:bg-night-800 rounded-2xl border border-black/6 dark:border-white/6 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-[#C9973A]/10 flex items-center justify-center">
          <i className={`ti ${icon} text-[#C9973A] text-sm`} />
        </div>
        <p className="font-semibold text-sand-900 dark:text-night-50 text-sm">{title}</p>
      </div>
      {items.map(s => <SettingRow key={s.key} s={s} />)}
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 text-xs text-amber-700 dark:text-amber-400">
        <i className="ti ti-alert-triangle shrink-0" />
        Los cambios aplican en tiempo real — el próximo job de generación usará el modelo actualizado sin redeploy.
      </div>

      <Section title="KIE.ai" icon="ti-music" items={kieSettings} />
      <Section title="Generación" icon="ti-settings" items={genSettings} />
      <Section title="Límites de plan" icon="ti-layers-intersect" items={planSettings} />
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 3 — Jobs Monitor
// ══════════════════════════════════════════════════════════════════════════════
function JobsMonitorTab() {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const toast = useToast()
  const qc = useQueryClient()

  const { data: jobs = [], isLoading, refetch } = useQuery<AdminJob[]>({
    queryKey: ['admin', 'jobs', statusFilter],
    queryFn: async () => {
      let q = supabase
        .from('generation_jobs')
        .select('*, campaigns!inner(name, tenant_id, tenants!inner(name))')
        .order('created_at', { ascending: false })
        .limit(100)
      if (statusFilter !== 'all') q = q.eq('status', statusFilter)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []).map((j: any) => ({
        ...j,
        campaign_name: j.campaigns?.name,
        tenant_name:   j.campaigns?.tenants?.name,
      }))
    },
    refetchInterval: 15_000,
  })

  const retryJob = useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await supabase.from('generation_jobs').update({ status: 'queued', error_message: null }).eq('id', jobId)
      if (error) throw error
      // Re-trigger generation
      const job = jobs.find(j => j.id === jobId)
      if (job) await supabase.functions.invoke('generate-campaign', { body: { job_id: jobId } })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'jobs'] }); toast.success('Job reintentado') },
    onError: (err: any) => toast.error('Error', err.message),
  })

  const counts = {
    all:        jobs.length,
    queued:     jobs.filter(j => j.status === 'queued').length,
    processing: jobs.filter(j => j.status === 'processing').length,
    done:       jobs.filter(j => j.status === 'done').length,
    failed:     jobs.filter(j => j.status === 'failed').length,
  }

  return (
    <div className="space-y-4">
      {/* filter + refresh */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-black/4 dark:bg-white/4 rounded-xl p-1">
          {(['all', 'queued', 'processing', 'done', 'failed'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn('px-3 py-1 rounded-lg text-xs font-medium transition-all',
                statusFilter === s
                  ? 'bg-white dark:bg-night-700 text-sand-900 dark:text-night-50 shadow-sm'
                  : 'text-sand-900/50 dark:text-night-50/50'
              )}>
              {s} <span className="opacity-60">({counts[s]})</span>
            </button>
          ))}
        </div>
        <button onClick={() => refetch()} className="ml-auto p-2 rounded-lg hover:bg-black/6 dark:hover:bg-white/6 text-sand-900/50 dark:text-night-50/50 transition-colors" title="Refrescar">
          <i className="ti ti-refresh text-sm" />
        </button>
      </div>

      <div className="bg-white dark:bg-night-800 rounded-2xl border border-black/6 dark:border-white/6 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16"><i className="ti ti-loader-2 animate-spin text-2xl text-sand-900/30 dark:text-night-50/30" /></div>
        ) : jobs.length === 0 ? (
          <div className="py-16 text-center text-sm text-sand-900/40 dark:text-night-50/40">Sin jobs{statusFilter !== 'all' ? ` con estado "${statusFilter}"` : ''}.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/6 dark:border-white/6">
                  {['Estado', 'Tenant', 'Campaña', 'Proveedor', 'Duración', 'Intentos', 'Creado', 'Completado', ''].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-sand-900/40 dark:text-night-50/40 px-4 py-2.5 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/4 dark:divide-white/4">
                {jobs.map(j => {
                  const duration = j.started_at && j.completed_at
                    ? Math.round((new Date(j.completed_at).getTime() - new Date(j.started_at).getTime()) / 1000)
                    : null
                  return (
                    <tr key={j.id} className="hover:bg-black/2 dark:hover:bg-white/2 transition-colors group">
                      <td className="px-4 py-3">
                        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-md', JOB_STATUS_STYLES[j.status])}>
                          {j.status === 'processing' ? <><i className="ti ti-loader-2 animate-spin mr-1" />{j.status}</> : j.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-sand-900/70 dark:text-night-50/70 whitespace-nowrap">{(j as any).tenant_name ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-sand-900/70 dark:text-night-50/70 max-w-[180px] truncate">{(j as any).campaign_name ?? '—'}</td>
                      <td className="px-4 py-3 text-xs font-mono text-sand-900/50 dark:text-night-50/50">{j.provider}</td>
                      <td className="px-4 py-3 text-xs tabular-nums text-sand-900/50 dark:text-night-50/50">{duration != null ? `${duration}s` : '—'}</td>
                      <td className="px-4 py-3 text-xs tabular-nums text-sand-900/50 dark:text-night-50/50">{j.attempts}</td>
                      <td className="px-4 py-3 text-xs text-sand-900/40 dark:text-night-50/40 whitespace-nowrap">
                        {formatDistanceToNow(new Date(j.created_at), { addSuffix: true, locale: es })}
                      </td>
                      <td className="px-4 py-3 text-xs text-sand-900/40 dark:text-night-50/40 whitespace-nowrap">
                        {j.completed_at ? formatDistanceToNow(new Date(j.completed_at), { addSuffix: true, locale: es }) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {j.status === 'failed' && (
                          <button
                            onClick={() => retryJob.mutate(j.id)}
                            disabled={retryJob.isPending}
                            title="Reintentar"
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-all"
                          >
                            <i className="ti ti-refresh text-sm" />
                          </button>
                        )}
                        {j.output_url && (
                          <a href={j.output_url} target="_blank" rel="noreferrer"
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-black/6 dark:hover:bg-white/6 text-sand-900/50 dark:text-night-50/50 transition-all inline-block"
                            title="Ver audio">
                            <i className="ti ti-music text-sm" />
                          </a>
                        )}
                        {j.error_message && (
                          <span title={j.error_message} className="opacity-0 group-hover:opacity-100 p-1.5 inline-block text-red-400 cursor-help">
                            <i className="ti ti-info-circle text-sm" />
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 4 — Audit Log
// ══════════════════════════════════════════════════════════════════════════════
function AuditLogTab() {
  const [limit, setLimit] = useState(50)

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['admin', 'audit_log', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return data
    },
    staleTime: 10_000,
  })

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-night-800 rounded-2xl border border-black/6 dark:border-white/6 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/6 dark:border-white/6">
          <p className="text-sm font-medium text-sand-900/60 dark:text-night-50/60">Últimas {limit} entradas</p>
          <select value={limit} onChange={e => setLimit(Number(e.target.value))}
            className="text-xs px-2 py-1 rounded-lg bg-[#F5EFE6] dark:bg-[#0C0A08] border border-black/10 dark:border-white/10 focus:outline-none">
            {[25, 50, 100, 250].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-16"><i className="ti ti-loader-2 animate-spin text-2xl text-sand-900/30 dark:text-night-50/30" /></div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-sm text-sand-900/40 dark:text-night-50/40">Sin entradas en el audit log.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-black/6 dark:border-white/6">
                  {['Fecha', 'Actor', 'Acción', 'Recurso', 'ID recurso'].map(h => (
                    <th key={h} className="text-left font-semibold text-sand-900/40 dark:text-night-50/40 px-4 py-2.5 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/4 dark:divide-white/4">
                {logs.map((l: any) => (
                  <tr key={l.id} className="hover:bg-black/2 dark:hover:bg-white/2">
                    <td className="px-4 py-2.5 whitespace-nowrap text-sand-900/40 dark:text-night-50/40">
                      {format(new Date(l.created_at), 'dd MMM HH:mm:ss', { locale: es })}
                    </td>
                    <td className="px-4 py-2.5 text-sand-900/60 dark:text-night-50/60 max-w-[160px] truncate">
                      {l.actor_email ?? l.actor_id ?? '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono px-1.5 py-0.5 rounded bg-black/4 dark:bg-white/4 text-sand-900 dark:text-night-50">{l.action}</span>
                    </td>
                    <td className="px-4 py-2.5 text-sand-900/60 dark:text-night-50/60">
                      {l.resource_type}{l.resource_name ? ` · ${l.resource_name}` : ''}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-sand-900/30 dark:text-night-50/30 truncate max-w-[120px]">
                      {l.resource_id ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// EditTenantModal
// ══════════════════════════════════════════════════════════════════════════════
function EditTenantModal({ tenant, onSave, onClose, saving }: {
  tenant: Tenant
  onSave: (patch: Partial<Tenant>) => void
  onClose: () => void
  saving: boolean
}) {
  const [plan, setPlan] = useState<TenantPlan>(tenant.plan)
  const [stripeStatus, setStripeStatus] = useState(tenant.stripe_status ?? 'inactive')
  const [setupComplete, setSetupComplete] = useState(tenant.setup_complete)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-night-800 rounded-2xl border border-black/8 dark:border-white/8 shadow-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-semibold text-sand-900 dark:text-night-50">{tenant.name}</h3>
            <p className="text-xs text-sand-900/40 dark:text-night-50/40">{tenant.slug}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/6 dark:hover:bg-white/6 text-sand-900/40 dark:text-night-50/40">
            <i className="ti ti-x text-base" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-sand-900/60 dark:text-night-50/60 mb-2">Plan</label>
            <div className="grid grid-cols-3 gap-2">
              {PLAN_OPTIONS.map(p => (
                <button key={p} onClick={() => setPlan(p)}
                  className={cn('py-2 rounded-xl text-sm font-medium border transition-all',
                    plan === p ? 'border-[#C9973A] bg-[#C9973A]/10 text-[#C9973A]'
                               : 'border-black/10 dark:border-white/10 text-sand-900/60 dark:text-night-50/60 hover:bg-black/4 dark:hover:bg-white/4'
                  )}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-sand-900/60 dark:text-night-50/60 mb-2">Stripe status (override)</label>
            <select value={stripeStatus} onChange={e => setStripeStatus(e.target.value as any)}
              className="w-full px-3 py-2 rounded-lg text-sm bg-[#F5EFE6] dark:bg-[#0C0A08] border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-[#C9973A]/30">
              {['inactive', 'trialing', 'active', 'past_due', 'canceled', 'unpaid'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-black/3 dark:bg-white/3">
            <div>
              <p className="text-sm font-medium text-sand-900 dark:text-night-50">Setup completo</p>
              <p className="text-xs text-sand-900/50 dark:text-night-50/50">Desactivado = tenant ve el onboarding wizard</p>
            </div>
            <button onClick={() => setSetupComplete(!setupComplete)}
              className={cn('relative w-10 h-6 rounded-full transition-colors shrink-0', setupComplete ? 'bg-teal-500' : 'bg-black/20 dark:bg-white/20')}>
              <span className={cn('absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform', setupComplete ? 'translate-x-5' : 'translate-x-1')} />
            </button>
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium border border-black/10 dark:border-white/10 hover:bg-black/4 dark:hover:bg-white/4 transition-colors">
            Cancelar
          </button>
          <button onClick={() => onSave({ plan, stripe_status: stripeStatus as any, setup_complete: setupComplete })}
            disabled={saving}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-[#C9973A] hover:bg-[#b8832e] text-white transition-colors disabled:opacity-60 flex items-center gap-2">
            {saving && <i className="ti ti-loader-2 animate-spin text-sm" />}
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  )
}
