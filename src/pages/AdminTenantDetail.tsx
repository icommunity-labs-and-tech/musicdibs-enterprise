import { useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/store/toastStore'
import { cn, formatNumber } from '@/lib/utils'
import type { Tenant, TenantPlan, Campaign, GenerationJob, ContactList } from '@/lib/supabase'

// ── types ─────────────────────────────────────────────────────────────────────
interface TenantSettings {
  api_keys?: {
    mailerlite?: string
    brevo?: string
    mailing_provider?: string
  }
}

interface TenantNote {
  id: string
  tenant_id: string
  author_id: string | null
  author_email: string | null
  body: string
  pinned: boolean
  created_at: string
}

interface TenantDetail {
  tenant: Tenant
  campaigns: Campaign[]
  jobs: (GenerationJob & { campaign_name?: string })[]
  contactLists: ContactList[]
  settings: TenantSettings
  profiles: { id: string; full_name: string | null; role: string; created_at: string }[]
  auditLog: { id: string; action: string; resource_type: string; resource_name: string | null; created_at: string; actor_email: string | null }[]
}

// ── constants ─────────────────────────────────────────────────────────────────
const PLAN_COLORS: Record<TenantPlan, string> = {
  starter:      'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  professional: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  enterprise:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
}
const STRIPE_COLORS: Record<string, string> = {
  active:   'text-emerald-600 dark:text-emerald-400',
  trialing: 'text-teal-600 dark:text-teal-400',
  past_due: 'text-orange-600 dark:text-orange-400',
  canceled: 'text-red-600 dark:text-red-400',
  inactive: 'text-gray-500 dark:text-gray-400',
  unpaid:   'text-red-600 dark:text-red-400',
}
const STATUS_COLORS: Record<string, string> = {
  draft:      'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  queued:     'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  generating: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
  ready:      'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400',
  sent:       'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  archived:   'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500',
  done:       'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  failed:     'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  processing: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
}
const PLAN_MRR: Record<TenantPlan, number> = {
  starter: 299, professional: 799, enterprise: 1999,
}

// ── health score ──────────────────────────────────────────────────────────────
interface CheckItem {
  key: string
  label: string
  description: string
  done: boolean
  critical: boolean
}

function buildHealthChecks(data: TenantDetail): CheckItem[] {
  const { tenant, campaigns, jobs, contactLists, settings, profiles } = data
  const hasMailingKey = !!(settings.api_keys?.mailerlite || settings.api_keys?.brevo)
  const sentCampaigns = campaigns.filter(c => c.status === 'sent').length
  const hasContacts   = contactLists.some(l => l.contact_count > 0)
  const hasLinkedList = contactLists.some(l => l.mailerlite_group_id)
  const failedJobs    = jobs.filter(j => j.status === 'failed').length
  const hasMultiUser  = profiles.length > 1

  return [
    {
      key: 'setup',
      label: 'Setup completado',
      description: 'El tenant ha completado el onboarding wizard',
      done: tenant.setup_complete,
      critical: true,
    },
    {
      key: 'mailing',
      label: 'Proveedor de mailing configurado',
      description: 'Tiene API key de MailerLite o Brevo',
      done: hasMailingKey,
      critical: true,
    },
    {
      key: 'contacts',
      label: 'Contactos importados',
      description: 'Al menos una lista con contactos',
      done: hasContacts,
      critical: true,
    },
    {
      key: 'linked_list',
      label: 'Lista enlazada al proveedor',
      description: 'Al menos una lista con Group ID del proveedor de mailing',
      done: hasLinkedList,
      critical: false,
    },
    {
      key: 'stripe',
      label: 'Suscripción activa',
      description: 'Stripe status active o trialing',
      done: tenant.stripe_status === 'active' || tenant.stripe_status === 'trialing',
      critical: true,
    },
    {
      key: 'first_campaign',
      label: 'Primera campaña creada',
      description: 'Ha lanzado al menos una campaña',
      done: campaigns.length > 0,
      critical: false,
    },
    {
      key: 'first_sent',
      label: 'Primera campaña enviada',
      description: 'Ha enviado al menos una campaña completa',
      done: sentCampaigns > 0,
      critical: false,
    },
    {
      key: 'no_failed_jobs',
      label: 'Sin jobs fallidos',
      description: 'No hay generaciones de audio con errores',
      done: failedJobs === 0,
      critical: false,
    },
    {
      key: 'team',
      label: 'Equipo configurado',
      description: 'Más de un usuario en la cuenta',
      done: hasMultiUser,
      critical: false,
    },
  ]
}

function calcScore(checks: CheckItem[]): number {
  const criticals = checks.filter(c => c.critical)
  const criticalDone = criticals.filter(c => c.done).length
  const optionals = checks.filter(c => !c.critical)
  const optionalDone = optionals.filter(c => c.done).length
  // Criticals = 70% of score, optionals = 30%
  const criticalScore = criticals.length > 0 ? (criticalDone / criticals.length) * 70 : 70
  const optionalScore = optionals.length  > 0 ? (optionalDone  / optionals.length)  * 30 : 30
  return Math.round(criticalScore + optionalScore)
}

function scoreColor(score: number) {
  if (score >= 80) return { ring: '#10b981', text: 'text-emerald-600 dark:text-emerald-400', label: 'Saludable' }
  if (score >= 50) return { ring: '#f59e0b', text: 'text-amber-600 dark:text-amber-400',   label: 'En progreso' }
  return              { ring: '#ef4444', text: 'text-red-600 dark:text-red-400',             label: 'Riesgo' }
}

// ── small components ──────────────────────────────────────────────────────────
function Section({ title, icon, children, action }: { title: string; icon: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-night-800 rounded-2xl border border-black/6 dark:border-white/6 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#C9973A]/10 flex items-center justify-center">
            <i className={`ti ${icon} text-[#C9973A] text-xs`} />
          </div>
          <p className="text-sm font-semibold text-sand-900 dark:text-night-50">{title}</p>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function Pill({ label, className }: { label: string; className: string }) {
  return <span className={cn('text-xs font-medium px-2 py-0.5 rounded-md', className)}>{label}</span>
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-black/4 dark:border-white/4 last:border-0">
      <span className="text-xs text-sand-900/50 dark:text-night-50/50">{label}</span>
      <span className={cn('text-xs font-medium text-sand-900 dark:text-night-50 text-right max-w-[60%] truncate', mono && 'font-mono')}>{value ?? '—'}</span>
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────
export function AdminTenantDetail() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const [activeSection, setActiveSection] = useState<'campaigns' | 'jobs' | 'lists' | 'team' | 'audit'>('campaigns')

  if (!profile?.is_superadmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 py-24">
        <i className="ti ti-shield-lock text-5xl text-sand-900/20 dark:text-night-50/20" />
        <p className="text-sand-900/50 dark:text-night-50/50 text-sm">Acceso restringido.</p>
      </div>
    )
  }

  const { data, isLoading } = useQuery<TenantDetail>({
    queryKey: ['admin', 'tenant_detail', id],
    enabled: !!id,
    queryFn: async () => {
      const [
        { data: tenant, error: tErr },
        { data: campaigns },
        { data: jobsRaw },
        { data: contactLists },
        { data: settingsRaw },
        { data: profiles },
        { data: auditLog },
      ] = await Promise.all([
        supabase.from('tenants').select('*').eq('id', id!).single(),
        supabase.from('campaigns').select('*').eq('tenant_id', id!).order('created_at', { ascending: false }).limit(50),
        supabase.from('generation_jobs').select('*, campaigns!inner(name)').eq('tenant_id', id!).order('created_at', { ascending: false }).limit(30),
        supabase.from('contact_lists').select('*').eq('tenant_id', id!).order('created_at', { ascending: false }),
        supabase.from('tenant_settings').select('key,value').eq('tenant_id', id!),
        supabase.from('profiles').select('id,full_name,role,created_at').eq('tenant_id', id!),
        supabase.from('audit_log').select('id,action,resource_type,resource_name,created_at,actor_email').eq('tenant_id', id!).order('created_at', { ascending: false }).limit(30),
      ])

      if (tErr || !tenant) throw new Error('Tenant no encontrado')

      // Parse settings from tenant_settings rows
      const apiKeyRow = (settingsRaw ?? []).find(r => r.key === 'api_keys')
      const settings: TenantSettings = apiKeyRow?.value ? JSON.parse(apiKeyRow.value) : {}

      const jobs = (jobsRaw ?? []).map((j: any) => ({
        ...j,
        campaign_name: j.campaigns?.name,
      }))

      return {
        tenant,
        campaigns: campaigns ?? [],
        jobs,
        contactLists: contactLists ?? [],
        settings,
        profiles: profiles ?? [],
        auditLog: auditLog ?? [],
      }
    },
    staleTime: 20_000,
  })

  const [impersonating, setImpersonating] = useState(false)

  const updateTenant = useMutation({
    mutationFn: async (patch: Partial<Tenant>) => {
      const { error } = await supabase.from('tenants').update(patch).eq('id', id!)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'tenant_detail', id] })
      toast.success('Actualizado')
    },
    onError: (err: any) => toast.error('Error', err.message),
  })

  async function handleImpersonate() {
    setImpersonating(true)
    try {
      const { data, error } = await supabase.functions.invoke('impersonate-tenant', {
        body: { tenant_id: id },
      })
      if (error || !data?.magic_link) throw new Error(error?.message ?? 'No se generó el link')
      // Open in new tab so superadmin session is preserved
      window.open(data.magic_link, '_blank', 'noopener,noreferrer')
      toast.success('Sesión abierta', `Impersonando ${data.impersonated_email} en nueva pestaña`)
    } catch (err: any) {
      toast.error('Error impersonación', err.message)
    } finally {
      setImpersonating(false)
    }
  }

  const retryJob = useMutation({
    mutationFn: async (jobId: string) => {
      await supabase.from('generation_jobs').update({ status: 'queued', error_message: null }).eq('id', jobId)
      await supabase.functions.invoke('generate-campaign', { body: { job_id: jobId } })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'tenant_detail', id] }); toast.success('Job reintentado') },
    onError: (err: any) => toast.error('Error', err.message),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 gap-3 text-sand-900/40 dark:text-night-50/40">
        <i className="ti ti-loader-2 animate-spin text-2xl" />
        <span>Cargando tenant…</span>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center gap-3 py-24">
        <i className="ti ti-building-off text-5xl text-sand-900/20 dark:text-night-50/20" />
        <p className="text-sand-900/50 dark:text-night-50/50">Tenant no encontrado.</p>
        <Link to="/admin" className="text-sm text-[#C9973A] hover:underline">← Volver al admin</Link>
      </div>
    )
  }

  const { tenant, campaigns, jobs, contactLists, settings, profiles, auditLog } = data
  const checks = buildHealthChecks(data)
  const score  = calcScore(checks)
  const col    = scoreColor(score)
  const mrr    = (tenant.stripe_status === 'active' || tenant.stripe_status === 'trialing') ? PLAN_MRR[tenant.plan] : 0
  const sentCampaigns  = campaigns.filter(c => c.status === 'sent').length
  const totalContacts  = contactLists.reduce((s, l) => s + (l.contact_count ?? 0), 0)
  const failedJobs     = jobs.filter(j => j.status === 'failed').length
  const mailingProvider = settings.api_keys?.mailing_provider
  const hasMailingKey   = !!(settings.api_keys?.mailerlite || settings.api_keys?.brevo)

  const SECTIONS = [
    { key: 'campaigns', label: 'Campañas', count: campaigns.length },
    { key: 'jobs',      label: 'Jobs',      count: jobs.length,    alert: failedJobs > 0 },
    { key: 'lists',     label: 'Listas',    count: contactLists.length },
    { key: 'team',      label: 'Equipo',    count: profiles.length },
    { key: 'notes',     label: 'Notas',     count: null },
    { key: 'audit',     label: 'Actividad', count: auditLog.length },
  ] as const

  return (
    <div className="space-y-5 pb-10">
      {/* ── breadcrumb ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-sand-900/40 dark:text-night-50/40">
          <Link to="/admin" className="hover:text-[#C9973A] transition-colors">Admin</Link>
          <i className="ti ti-chevron-right text-[10px]" />
          <span className="text-sand-900/70 dark:text-night-50/70">{tenant.name}</span>
        </div>
        <button
          onClick={handleImpersonate}
          disabled={impersonating}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors disabled:opacity-60"
          title="Abrir sesión como admin del tenant (nueva pestaña)"
        >
          {impersonating
            ? <><i className="ti ti-loader-2 animate-spin" /> Generando link…</>
            : <><i className="ti ti-user-bolt" /> Impersonar</>
          }
        </button>
      </div>

      {/* ── header ────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-night-800 rounded-2xl border border-black/6 dark:border-white/6 p-6">
        <div className="flex items-start gap-5">
          {/* avatar */}
          <div className="w-14 h-14 rounded-2xl bg-[#C9973A]/10 flex items-center justify-center shrink-0">
            {tenant.logo_url
              ? <img src={tenant.logo_url} alt={tenant.name} className="w-14 h-14 rounded-2xl object-cover" />
              : <i className="ti ti-building text-2xl text-[#C9973A]" />
            }
          </div>

          {/* info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="font-display text-xl font-semibold text-sand-900 dark:text-night-50">{tenant.name}</h1>
              <Pill label={tenant.plan} className={PLAN_COLORS[tenant.plan]} />
              <span className={cn('text-xs font-medium', STRIPE_COLORS[tenant.stripe_status ?? 'inactive'])}>
                <i className="ti ti-circle-filled text-[8px] mr-1" />{tenant.stripe_status ?? 'inactive'}
              </span>
              {!tenant.setup_complete && (
                <span className="text-xs px-2 py-0.5 rounded-md bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 font-medium">onboarding pendiente</span>
              )}
            </div>
            <p className="text-sm text-sand-900/40 dark:text-night-50/40 font-mono">{tenant.slug}</p>
            <p className="text-xs text-sand-900/30 dark:text-night-50/30 mt-1">
              Creado {format(new Date(tenant.created_at), "d 'de' MMMM 'de' yyyy", { locale: es })}
              {' · '}
              {formatDistanceToNow(new Date(tenant.created_at), { addSuffix: true, locale: es })}
            </p>
          </div>

          {/* health score donut */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="relative w-16 h-16">
              <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="3" className="text-black/6 dark:text-white/6" />
                <circle
                  cx="18" cy="18" r="15.9" fill="none"
                  stroke={col.ring} strokeWidth="3" strokeLinecap="round"
                  strokeDasharray={`${score} ${100 - score}`}
                  strokeDashoffset="0"
                  style={{ transition: 'stroke-dasharray 0.6s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-sand-900 dark:text-night-50">{score}</span>
              </div>
            </div>
            <span className={cn('text-xs font-medium', col.text)}>{col.label}</span>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5 pt-5 border-t border-black/4 dark:border-white/4">
          {[
            { icon: 'ti-currency-euro', label: 'MRR',           value: mrr > 0 ? `€${mrr}` : '—' },
            { icon: 'ti-speakerphone',  label: 'Campañas',      value: campaigns.length },
            { icon: 'ti-send',          label: 'Enviadas',       value: sentCampaigns },
            { icon: 'ti-users',         label: 'Contactos',      value: formatNumber(totalContacts) },
            { icon: 'ti-alert-triangle',label: 'Jobs fallidos',  value: failedJobs, alert: failedJobs > 0 },
          ].map(k => (
            <div key={k.label} className="text-center">
              <i className={cn(`ti ${k.icon} text-lg mb-1 block`, (k as any).alert ? 'text-red-500' : 'text-sand-900/30 dark:text-night-50/30')} />
              <p className={cn('text-xl font-semibold font-display', (k as any).alert ? 'text-red-600 dark:text-red-400' : 'text-sand-900 dark:text-night-50')}>{k.value}</p>
              <p className="text-xs text-sand-900/40 dark:text-night-50/40">{k.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── two-column layout ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* left: health checklist + config */}
        <div className="space-y-4">
          {/* health checklist */}
          <Section title="Health Score" icon="ti-heart-rate-monitor">
            <div className="space-y-1">
              {checks.map(c => (
                <div key={c.key} className={cn(
                  'flex items-start gap-2.5 px-3 py-2.5 rounded-xl transition-colors',
                  c.done ? 'bg-emerald-50 dark:bg-emerald-900/10' : c.critical ? 'bg-red-50 dark:bg-red-900/10' : 'bg-black/2 dark:bg-white/2'
                )}>
                  <i className={cn(
                    'text-base mt-0.5 shrink-0',
                    c.done ? 'ti ti-circle-check text-emerald-500' : c.critical ? 'ti ti-circle-x text-red-500' : 'ti ti-circle-dashed text-sand-900/30 dark:text-night-50/30'
                  )} />
                  <div className="min-w-0">
                    <p className={cn('text-xs font-medium leading-tight', c.done ? 'text-emerald-700 dark:text-emerald-300' : c.critical ? 'text-red-700 dark:text-red-300' : 'text-sand-900/60 dark:text-night-50/60')}>
                      {c.label}
                      {c.critical && !c.done && <span className="ml-1 text-[10px] font-semibold opacity-70">CRÍTICO</span>}
                    </p>
                    <p className="text-[11px] text-sand-900/40 dark:text-night-50/40 mt-0.5">{c.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* account config */}
          <Section title="Configuración" icon="ti-settings">
            <Row label="Plan" value={<Pill label={tenant.plan} className={PLAN_COLORS[tenant.plan]} />} />
            <Row label="Stripe status" value={<span className={STRIPE_COLORS[tenant.stripe_status ?? 'inactive']}>{tenant.stripe_status ?? 'inactive'}</span>} />
            <Row label="Stripe Customer ID" value={tenant.stripe_customer_id} mono />
            <Row label="Vertical" value={tenant.vertical} />
            <Row label="Setup completo" value={tenant.setup_complete ? '✓ Sí' : '✗ No'} />
            <Row label="Proveedor mailing" value={mailingProvider ?? (hasMailingKey ? 'configurado' : 'no configurado')} />
            <Row label="MailerLite key" value={settings.api_keys?.mailerlite ? '••••••••' : '—'} />
            <Row label="Brevo key" value={settings.api_keys?.brevo ? '••••••••' : '—'} />
            <Row label="Actualizado" value={format(new Date(tenant.updated_at), 'dd/MM/yyyy HH:mm')} />
          </Section>

          {/* quick actions */}
          <Section title="Acciones rápidas" icon="ti-bolt">
            <div className="space-y-2">
              <button
                onClick={() => updateTenant.mutate({ setup_complete: !tenant.setup_complete })}
                disabled={updateTenant.isPending}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-black/8 dark:border-white/8 hover:bg-black/3 dark:hover:bg-white/3 text-sm text-sand-900/70 dark:text-night-50/70 transition-colors text-left"
              >
                <i className={cn('text-base', tenant.setup_complete ? 'ti ti-circle-dashed' : 'ti ti-circle-check text-emerald-500')} />
                {tenant.setup_complete ? 'Marcar onboarding pendiente' : 'Marcar setup completo'}
              </button>
              {(['starter', 'professional', 'enterprise'] as TenantPlan[]).filter(p => p !== tenant.plan).map(p => (
                <button
                  key={p}
                  onClick={() => updateTenant.mutate({ plan: p })}
                  disabled={updateTenant.isPending}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-black/8 dark:border-white/8 hover:bg-black/3 dark:hover:bg-white/3 text-sm text-sand-900/70 dark:text-night-50/70 transition-colors text-left"
                >
                  <i className="ti ti-arrow-up-right text-base text-[#C9973A]" />
                  Cambiar a plan {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </Section>
        </div>

        {/* right: tabbed detail */}
        <div className="lg:col-span-2 space-y-4">

          {/* section tabs */}
          <div className="flex gap-1 bg-black/4 dark:bg-white/4 rounded-xl p-1 w-fit overflow-x-auto">
            {SECTIONS.map(s => (
              <button
                key={s.key}
                onClick={() => setActiveSection(s.key as any)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1.5',
                  activeSection === s.key
                    ? 'bg-white dark:bg-night-700 text-sand-900 dark:text-night-50 shadow-sm'
                    : 'text-sand-900/50 dark:text-night-50/50 hover:text-sand-900 dark:hover:text-night-50'
                )}
              >
                {s.label}
                <span className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-md font-semibold',
                  (s as any).alert ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-black/8 dark:bg-white/8 text-sand-900/50 dark:text-night-50/50'
                )}>
                  {s.count}
                </span>
              </button>
            ))}
          </div>

          {/* campaigns */}
          {activeSection === 'campaigns' && (
            <div className="bg-white dark:bg-night-800 rounded-2xl border border-black/6 dark:border-white/6 overflow-hidden">
              {campaigns.length === 0 ? (
                <div className="py-16 text-center text-sm text-sand-900/40 dark:text-night-50/40">Sin campañas todavía.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-black/6 dark:border-white/6">
                      {['Campaña', 'Estado', 'Canal', 'Contactos', 'Creada'].map(h => (
                        <th key={h} className="text-left text-xs font-semibold text-sand-900/40 dark:text-night-50/40 px-4 py-2.5 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/4 dark:divide-white/4">
                    {campaigns.map(c => (
                      <tr key={c.id} className="hover:bg-black/2 dark:hover:bg-white/2 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-sand-900 dark:text-night-50 text-xs leading-tight">{c.name}</p>
                          <p className="text-[11px] text-sand-900/40 dark:text-night-50/40">{c.type} · {c.vertical}</p>
                        </td>
                        <td className="px-4 py-3">
                          <Pill label={c.status} className={STATUS_COLORS[c.status] ?? STATUS_COLORS.draft} />
                        </td>
                        <td className="px-4 py-3 text-xs text-sand-900/60 dark:text-night-50/60 capitalize">{c.delivery_channel}</td>
                        <td className="px-4 py-3 text-xs tabular-nums text-sand-900/60 dark:text-night-50/60">{formatNumber(c.total_contacts)}</td>
                        <td className="px-4 py-3 text-xs text-sand-900/40 dark:text-night-50/40 whitespace-nowrap">
                          {format(new Date(c.created_at), 'dd MMM yy', { locale: es })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* jobs */}
          {activeSection === 'jobs' && (
            <div className="bg-white dark:bg-night-800 rounded-2xl border border-black/6 dark:border-white/6 overflow-hidden">
              {jobs.length === 0 ? (
                <div className="py-16 text-center text-sm text-sand-900/40 dark:text-night-50/40">Sin jobs de generación.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-black/6 dark:border-white/6">
                      {['Estado', 'Campaña', 'Proveedor', 'Duración', 'Intentos', 'Fecha', ''].map(h => (
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
                            <Pill label={j.status} className={STATUS_COLORS[j.status] ?? STATUS_COLORS.draft} />
                          </td>
                          <td className="px-4 py-3 text-xs text-sand-900/70 dark:text-night-50/70 max-w-[140px] truncate">{(j as any).campaign_name ?? '—'}</td>
                          <td className="px-4 py-3 text-xs font-mono text-sand-900/50 dark:text-night-50/50">{j.provider}</td>
                          <td className="px-4 py-3 text-xs tabular-nums">{duration != null ? `${duration}s` : '—'}</td>
                          <td className="px-4 py-3 text-xs tabular-nums">{j.attempts}</td>
                          <td className="px-4 py-3 text-xs text-sand-900/40 dark:text-night-50/40 whitespace-nowrap">
                            {formatDistanceToNow(new Date(j.created_at), { addSuffix: true, locale: es })}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {j.status === 'failed' && (
                                <button onClick={() => retryJob.mutate(j.id)} title="Reintentar"
                                  className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors">
                                  <i className="ti ti-refresh text-sm" />
                                </button>
                              )}
                              {j.output_url && (
                                <a href={j.output_url} target="_blank" rel="noreferrer" title="Ver audio"
                                  className="p-1.5 rounded-lg hover:bg-black/6 dark:hover:bg-white/6 text-sand-900/50 dark:text-night-50/50 transition-colors">
                                  <i className="ti ti-music text-sm" />
                                </a>
                              )}
                              {j.error_message && (
                                <span title={j.error_message} className="p-1.5 text-amber-500 cursor-help">
                                  <i className="ti ti-info-circle text-sm" />
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* lists */}
          {activeSection === 'lists' && (
            <div className="space-y-2">
              {contactLists.length === 0 ? (
                <div className="bg-white dark:bg-night-800 rounded-2xl border border-black/6 dark:border-white/6 py-16 text-center text-sm text-sand-900/40 dark:text-night-50/40">
                  Sin listas de contactos.
                </div>
              ) : contactLists.map(l => (
                <div key={l.id} className="bg-white dark:bg-night-800 rounded-xl border border-black/6 dark:border-white/6 p-4 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: l.color ? `${l.color}22` : '#C9973A22', color: l.color ?? '#C9973A' }}>
                    <i className="ti ti-users text-sm" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-sand-900 dark:text-night-50 leading-tight">{l.name}</p>
                    {l.description && <p className="text-xs text-sand-900/40 dark:text-night-50/40">{l.description}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-semibold font-display text-sand-900 dark:text-night-50">{formatNumber(l.contact_count)}</p>
                    <p className="text-xs text-sand-900/40 dark:text-night-50/40">contactos</p>
                  </div>
                  <div className="shrink-0">
                    {l.mailerlite_group_id ? (
                      <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-mono">
                        {l.mailerlite_group_id}
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-md bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                        sin ID proveedor
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* team */}
          {activeSection === 'team' && (
            <div className="bg-white dark:bg-night-800 rounded-2xl border border-black/6 dark:border-white/6 overflow-hidden">
              {profiles.length === 0 ? (
                <div className="py-16 text-center text-sm text-sand-900/40 dark:text-night-50/40">Sin usuarios.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-black/6 dark:border-white/6">
                      {['Usuario', 'Rol', 'Desde'].map(h => (
                        <th key={h} className="text-left text-xs font-semibold text-sand-900/40 dark:text-night-50/40 px-4 py-2.5">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/4 dark:divide-white/4">
                    {profiles.map(p => (
                      <tr key={p.id} className="hover:bg-black/2 dark:hover:bg-white/2">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-[#C9973A]/15 flex items-center justify-center text-[#C9973A] text-xs font-bold shrink-0">
                              {(p.full_name ?? '?')[0].toUpperCase()}
                            </div>
                            <p className="text-sm text-sand-900 dark:text-night-50">{p.full_name ?? 'Sin nombre'}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-black/6 dark:bg-white/6 text-sand-900/70 dark:text-night-50/70 capitalize">{p.role}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-sand-900/40 dark:text-night-50/40">
                          {format(new Date(p.created_at), 'dd MMM yyyy', { locale: es })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* notes */}
          {activeSection === 'notes' && (
            <NotesPanel tenantId={id!} currentUserEmail={profile?.id ?? ''} />
          )}

          {/* audit */}
          {activeSection === 'audit' && (
            <div className="bg-white dark:bg-night-800 rounded-2xl border border-black/6 dark:border-white/6 overflow-hidden">
              {auditLog.length === 0 ? (
                <div className="py-16 text-center text-sm text-sand-900/40 dark:text-night-50/40">Sin actividad registrada.</div>
              ) : (
                <div className="divide-y divide-black/4 dark:divide-white/4">
                  {auditLog.map(e => (
                    <div key={e.id} className="flex items-start gap-3 px-4 py-3 hover:bg-black/2 dark:hover:bg-white/2">
                      <div className="w-6 h-6 rounded-lg bg-black/4 dark:bg-white/4 flex items-center justify-center shrink-0 mt-0.5">
                        <i className="ti ti-activity text-[10px] text-sand-900/40 dark:text-night-50/40" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-sand-900 dark:text-night-50">
                          <span className="font-mono font-medium">{e.action}</span>
                          {e.resource_name && <span className="text-sand-900/50 dark:text-night-50/50"> · {e.resource_name}</span>}
                        </p>
                        <p className="text-[11px] text-sand-900/40 dark:text-night-50/40 mt-0.5">
                          {e.actor_email ?? 'Sistema'} · {formatDistanceToNow(new Date(e.created_at), { addSuffix: true, locale: es })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ── NotesPanel ────────────────────────────────────────────────────────────────
function NotesPanel({ tenantId, currentUserEmail }: { tenantId: string; currentUserEmail: string }) {
  const toast = useToast()
  const qc = useQueryClient()
  const { profile } = useAuth()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [body, setBody] = useState('')

  const { data: notes = [], isLoading } = useQuery<TenantNote[]>({
    queryKey: ['admin', 'notes', tenantId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('tenant_notes')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as TenantNote[]
    },
    staleTime: 15_000,
  })

  const addNote = useMutation({
    mutationFn: async (text: string) => {
      const { error } = await (supabase as any).from('tenant_notes').insert({
        tenant_id: tenantId,
        author_id: profile?.id ?? null,
        author_email: profile?.id ?? null,
        body: text.trim(),
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'notes', tenantId] })
      setBody('')
      textareaRef.current?.focus()
    },
    onError: (err: any) => toast.error('Error', err.message),
  })

  const togglePin = useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      const { error } = await (supabase as any).from('tenant_notes').update({ pinned }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'notes', tenantId] }),
    onError: (err: any) => toast.error('Error', err.message),
  })

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('tenant_notes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'notes', tenantId] }),
    onError: (err: any) => toast.error('Error', err.message),
  })

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && body.trim()) {
      addNote.mutate(body)
    }
  }

  return (
    <div className="space-y-3">
      {/* composer */}
      <div className="bg-white dark:bg-night-800 rounded-2xl border border-black/6 dark:border-white/6 p-4">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={e => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Añade una nota interna… (Cmd+Enter para guardar)"
          rows={3}
          className="w-full text-sm bg-transparent resize-none outline-none text-sand-900 dark:text-night-50 placeholder-sand-900/30 dark:placeholder-night-50/30"
        />
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-black/4 dark:border-white/4">
          <span className="text-xs text-sand-900/30 dark:text-night-50/30">
            {body.length > 0 ? `${body.length} chars` : 'Cmd+Enter para guardar'}
          </span>
          <button
            onClick={() => body.trim() && addNote.mutate(body)}
            disabled={!body.trim() || addNote.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#C9973A] hover:bg-[#b8832e] text-white transition-colors disabled:opacity-50"
          >
            {addNote.isPending ? <i className="ti ti-loader-2 animate-spin" /> : <i className="ti ti-send" />}
            Guardar nota
          </button>
        </div>
      </div>

      {/* notes list */}
      {isLoading ? (
        <div className="flex justify-center py-8"><i className="ti ti-loader-2 animate-spin text-xl text-sand-900/30 dark:text-night-50/30" /></div>
      ) : notes.length === 0 ? (
        <div className="bg-white dark:bg-night-800 rounded-2xl border border-black/6 dark:border-white/6 py-12 text-center text-sm text-sand-900/40 dark:text-night-50/40">
          <i className="ti ti-notes text-3xl block mb-2 text-sand-900/15 dark:text-night-50/15" />
          Sin notas todavía. Añade contexto sobre este cliente.
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map(note => (
            <div
              key={note.id}
              className={cn(
                'bg-white dark:bg-night-800 rounded-xl border p-4 group',
                note.pinned
                  ? 'border-[#C9973A]/40 dark:border-[#C9973A]/30 bg-[#C9973A]/3'
                  : 'border-black/6 dark:border-white/6'
              )}
            >
              <div className="flex items-start gap-3">
                {/* pin indicator */}
                {note.pinned && (
                  <i className="ti ti-pin text-[#C9973A] text-sm shrink-0 mt-0.5" />
                )}
                <p className="flex-1 text-sm text-sand-900 dark:text-night-50 leading-relaxed whitespace-pre-wrap">
                  {note.body}
                </p>
                {/* actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => togglePin.mutate({ id: note.id, pinned: !note.pinned })}
                    className={cn(
                      'p-1.5 rounded-lg transition-colors',
                      note.pinned
                        ? 'text-[#C9973A] hover:bg-[#C9973A]/10'
                        : 'text-sand-900/30 dark:text-night-50/30 hover:bg-black/6 dark:hover:bg-white/6'
                    )}
                    title={note.pinned ? 'Desfijar' : 'Fijar nota'}
                  >
                    <i className="ti ti-pin text-sm" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('¿Eliminar esta nota?')) deleteNote.mutate(note.id)
                    }}
                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="Eliminar nota"
                  >
                    <i className="ti ti-trash text-sm" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-sand-900/30 dark:text-night-50/30">
                  {note.author_email ?? 'Superadmin'} · {formatDistanceToNow(new Date(note.created_at), { addSuffix: true, locale: es })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
