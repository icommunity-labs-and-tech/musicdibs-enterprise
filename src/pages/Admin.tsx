import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/store/toastStore'
import { cn, formatNumber, formatCurrency } from '@/lib/utils'
import type { Tenant, TenantPlan } from '@/lib/supabase'

// ── types ─────────────────────────────────────────────────────────────────────
interface AdminTenant extends Tenant {
  campaign_count: number
  user_count: number
  total_contacts: number
}

// ── helpers ───────────────────────────────────────────────────────────────────
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

const PLAN_MRR: Record<TenantPlan, number> = {
  starter: 299, professional: 799, enterprise: 1999,
}

const PLAN_OPTIONS: TenantPlan[] = ['starter', 'professional', 'enterprise']

// ── main component ────────────────────────────────────────────────────────────
export function Admin() {
  const { profile } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [editingTenant, setEditingTenant] = useState<AdminTenant | null>(null)

  // Guard: only superadmin
  if (!profile?.is_superadmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 py-24">
        <i className="ti ti-lock text-5xl text-sand-900/20 dark:text-night-50/20" />
        <p className="text-sand-900/50 dark:text-night-50/50 text-sm">Acceso restringido a superadmins.</p>
      </div>
    )
  }

  // ── data ──────────────────────────────────────────────────────────────────
  const { data: tenants = [], isLoading } = useQuery<AdminTenant[]>({
    queryKey: ['admin', 'tenants'],
    queryFn: async () => {
      // Load tenants
      const { data: tens, error } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error

      // Load campaign counts per tenant
      const { data: campCounts } = await supabase
        .from('campaigns')
        .select('tenant_id, total_contacts')

      // Load profile counts per tenant
      const { data: profCounts } = await supabase
        .from('profiles')
        .select('tenant_id')

      return (tens ?? []).map((t) => {
        const camps = (campCounts ?? []).filter((c) => c.tenant_id === t.id)
        return {
          ...t,
          campaign_count: camps.length,
          user_count: (profCounts ?? []).filter((p) => p.tenant_id === t.id).length,
          total_contacts: camps.reduce((s, c) => s + (c.total_contacts ?? 0), 0),
        }
      })
    },
    staleTime: 30_000,
  })

  // ── derived KPIs ──────────────────────────────────────────────────────────
  const activeTenants = tenants.filter((t) => t.stripe_status === 'active' || t.stripe_status === 'trialing')
  const mrr = activeTenants.reduce((s, t) => s + PLAN_MRR[t.plan], 0)
  const totalCampaigns = tenants.reduce((s, t) => s + t.campaign_count, 0)
  const totalContacts = tenants.reduce((s, t) => s + t.total_contacts, 0)

  const filtered = tenants.filter((t) =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.slug.includes(search.toLowerCase())
  )

  // ── mutations ─────────────────────────────────────────────────────────────
  const updateTenant = useMutation({
    mutationFn: async (patch: { id: string } & Partial<Tenant>) => {
      const { id, ...rest } = patch
      const { error } = await supabase.from('tenants').update(rest).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'tenants'] })
      toast.success('Tenant actualizado')
      setEditingTenant(null)
    },
    onError: (err: any) => toast.error('Error', err.message),
  })

  return (
    <div className="space-y-6">
      {/* ── header ───────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-semibold">
              <i className="ti ti-shield-lock text-xs" /> SUPERADMIN
            </span>
          </div>
          <h1 className="font-display text-2xl font-semibold text-sand-900 dark:text-night-50">
            Admin Panel
          </h1>
          <p className="text-sm text-sand-900/50 dark:text-night-50/50 mt-0.5">
            Gestión global de tenants y suscripciones
          </p>
        </div>
      </div>

      {/* ── KPI cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: 'ti-building', label: 'Tenants totales', value: formatNumber(tenants.length), sub: `${activeTenants.length} activos`, color: 'text-blue-500' },
          { icon: 'ti-currency-euro', label: 'MRR estimado', value: `€${formatNumber(mrr)}`, sub: 'suscripciones activas', color: 'text-emerald-500' },
          { icon: 'ti-speakerphone', label: 'Campañas totales', value: formatNumber(totalCampaigns), sub: 'en todos los tenants', color: 'text-violet-500' },
          { icon: 'ti-users', label: 'Contactos totales', value: formatNumber(totalContacts), sub: 'acumulados', color: 'text-amber-500' },
        ].map((k) => (
          <div key={k.label} className="bg-white dark:bg-[#1A1510] rounded-2xl border border-black/6 dark:border-white/6 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-sand-900/50 dark:text-night-50/50">{k.label}</span>
              <i className={`${k.icon} text-lg ${k.color}`} />
            </div>
            <p className="text-2xl font-semibold font-display text-sand-900 dark:text-night-50">{k.value}</p>
            <p className="text-xs text-sand-900/40 dark:text-night-50/40 mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* ── tenants table ────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#1A1510] rounded-2xl border border-black/6 dark:border-white/6 overflow-hidden">
        {/* toolbar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-black/6 dark:border-white/6">
          <div className="relative flex-1 max-w-xs">
            <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-sand-900/30 dark:text-night-50/30 text-sm pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar tenant…"
              className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg bg-[#F5EFE6] dark:bg-[#0C0A08] border border-black/8 dark:border-white/8 focus:outline-none focus:ring-2 focus:ring-[#C9973A]/30 transition-all"
            />
          </div>
          <span className="text-xs text-sand-900/40 dark:text-night-50/40 ml-auto">
            {filtered.length} tenants
          </span>
        </div>

        {/* table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-sand-900/40 dark:text-night-50/40">
            <i className="ti ti-loader-2 animate-spin text-xl" />
            <span className="text-sm">Cargando tenants…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-sand-900/40 dark:text-night-50/40">
            No se encontraron tenants.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/6 dark:border-white/6">
                  {['Organización', 'Plan', 'Stripe', 'Campañas', 'Contactos', 'Creado', 'Acciones'].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-sand-900/40 dark:text-night-50/40 px-4 py-2.5 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/4 dark:divide-white/4">
                {filtered.map((t) => (
                  <TenantRow
                    key={t.id}
                    tenant={t}
                    onEdit={() => setEditingTenant(t)}
                    onToggleSetup={() => updateTenant.mutate({ id: t.id, setup_complete: !t.setup_complete })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── edit modal ───────────────────────────────────────────────────── */}
      {editingTenant && (
        <EditTenantModal
          tenant={editingTenant}
          onSave={(patch) => updateTenant.mutate({ id: editingTenant.id, ...patch })}
          onClose={() => setEditingTenant(null)}
          saving={updateTenant.isPending}
        />
      )}
    </div>
  )
}

// ── TenantRow ─────────────────────────────────────────────────────────────────
function TenantRow({
  tenant: t,
  onEdit,
  onToggleSetup,
}: {
  tenant: AdminTenant
  onEdit: () => void
  onToggleSetup: () => void
}) {
  const stripeStatus = t.stripe_status ?? 'inactive'

  return (
    <tr className="hover:bg-black/2 dark:hover:bg-white/2 transition-colors group">
      {/* org */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#C9973A]/10 flex items-center justify-center flex-shrink-0">
            <i className="ti ti-building text-[#C9973A] text-sm" />
          </div>
          <div>
            <p className="font-medium text-sand-900 dark:text-night-50 leading-tight">{t.name}</p>
            <p className="text-xs text-sand-900/40 dark:text-night-50/40">{t.slug}</p>
          </div>
          {!t.setup_complete && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 font-medium">
              onboarding
            </span>
          )}
        </div>
      </td>

      {/* plan */}
      <td className="px-4 py-3">
        <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-md', PLAN_COLORS[t.plan])}>
          {t.plan}
        </span>
      </td>

      {/* stripe */}
      <td className="px-4 py-3">
        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-md', STRIPE_COLORS[stripeStatus] ?? STRIPE_COLORS.inactive)}>
          {stripeStatus}
        </span>
      </td>

      {/* campaigns */}
      <td className="px-4 py-3 text-sand-900/70 dark:text-night-50/70 tabular-nums">
        {formatNumber(t.campaign_count)}
      </td>

      {/* contacts */}
      <td className="px-4 py-3 text-sand-900/70 dark:text-night-50/70 tabular-nums">
        {formatNumber(t.total_contacts)}
      </td>

      {/* created */}
      <td className="px-4 py-3 text-sand-900/40 dark:text-night-50/40 text-xs whitespace-nowrap">
        {format(new Date(t.created_at), 'dd MMM yy', { locale: es })}
      </td>

      {/* actions */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            title="Editar plan / estado"
            className="p-1.5 rounded-lg hover:bg-black/6 dark:hover:bg-white/6 text-sand-900/50 dark:text-night-50/50 hover:text-sand-900 dark:hover:text-night-50 transition-colors"
          >
            <i className="ti ti-edit text-sm" />
          </button>
          <button
            onClick={onToggleSetup}
            title={t.setup_complete ? 'Marcar onboarding pendiente' : 'Marcar setup completo'}
            className="p-1.5 rounded-lg hover:bg-black/6 dark:hover:bg-white/6 text-sand-900/50 dark:text-night-50/50 hover:text-sand-900 dark:hover:text-night-50 transition-colors"
          >
            <i className={cn('text-sm', t.setup_complete ? 'ti ti-circle-check text-emerald-500' : 'ti ti-circle-dashed')} />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── EditTenantModal ───────────────────────────────────────────────────────────
function EditTenantModal({
  tenant,
  onSave,
  onClose,
  saving,
}: {
  tenant: AdminTenant
  onSave: (patch: Partial<Tenant>) => void
  onClose: () => void
  saving: boolean
}) {
  const [plan, setPlan] = useState<TenantPlan>(tenant.plan)
  const [stripeStatus, setStripeStatus] = useState(tenant.stripe_status ?? 'inactive')
  const [setupComplete, setSetupComplete] = useState(tenant.setup_complete)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1A1510] rounded-2xl border border-black/8 dark:border-white/8 shadow-xl p-6 w-full max-w-md">
        {/* header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-semibold text-sand-900 dark:text-night-50">{tenant.name}</h3>
            <p className="text-xs text-sand-900/40 dark:text-night-50/40">{tenant.slug}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/6 dark:hover:bg-white/6 text-sand-900/40 dark:text-night-50/40 transition-colors">
            <i className="ti ti-x text-base" />
          </button>
        </div>

        <div className="space-y-4">
          {/* plan */}
          <div>
            <label className="block text-xs font-medium text-sand-900/60 dark:text-night-50/60 mb-2">Plan</label>
            <div className="grid grid-cols-3 gap-2">
              {PLAN_OPTIONS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPlan(p)}
                  className={cn(
                    'py-2 rounded-xl text-sm font-medium border transition-all',
                    plan === p
                      ? 'border-[#C9973A] bg-[#C9973A]/10 text-[#C9973A]'
                      : 'border-black/10 dark:border-white/10 text-sand-900/60 dark:text-night-50/60 hover:bg-black/4 dark:hover:bg-white/4'
                  )}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* stripe status override */}
          <div>
            <label className="block text-xs font-medium text-sand-900/60 dark:text-night-50/60 mb-2">
              Stripe status (override)
            </label>
            <select
              value={stripeStatus}
              onChange={(e) => setStripeStatus(e.target.value as any)}
              className="w-full px-3 py-2 rounded-lg text-sm bg-[#F5EFE6] dark:bg-[#0C0A08] border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-[#C9973A]/30"
            >
              {['inactive', 'trialing', 'active', 'past_due', 'canceled', 'unpaid'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* setup complete toggle */}
          <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-black/3 dark:bg-white/3">
            <div>
              <p className="text-sm font-medium text-sand-900 dark:text-night-50">Setup completo</p>
              <p className="text-xs text-sand-900/50 dark:text-night-50/50">Si está desactivado, el tenant verá el onboarding wizard</p>
            </div>
            <button
              onClick={() => setSetupComplete(!setupComplete)}
              className={cn(
                'relative w-10 h-6 rounded-full transition-colors flex-shrink-0',
                setupComplete ? 'bg-teal-500' : 'bg-black/20 dark:bg-white/20'
              )}
            >
              <span className={cn(
                'absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform',
                setupComplete ? 'translate-x-5' : 'translate-x-1'
              )} />
            </button>
          </div>
        </div>

        {/* actions */}
        <div className="flex gap-2 mt-5 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium border border-black/10 dark:border-white/10 hover:bg-black/4 dark:hover:bg-white/4 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSave({ plan, stripe_status: stripeStatus as any, setup_complete: setupComplete })}
            disabled={saving}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-[#C9973A] hover:bg-[#b8832e] text-white transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            {saving && <i className="ti ti-loader-2 animate-spin text-sm" />}
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  )
}
