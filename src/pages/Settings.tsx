import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { startOfMonth } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { cn, formatNumber } from '@/lib/utils'
import { useToast } from '@/store/toastStore'

// ── types ────────────────────────────────────────────────────────────────────
interface TenantSettings {
  id: string
  tenant_id: string
  api_keys: {
    kie_ai?: string
    suno?: string
    mailerlite?: string
  }
  integrations: {
    salesforce?: { connected: boolean; instance_url?: string }
    hubspot?: { connected: boolean }
    whatsapp?: { connected: boolean; phone_number_id?: string }
  }
  website: string | null
  support_email: string | null
  timezone: string
}

// ── helpers ──────────────────────────────────────────────────────────────────
const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
}
const PLAN_COLORS: Record<string, string> = {
  starter: 'bg-sand-100 text-sand-600 dark:bg-night-700 dark:text-night-300',
  professional: 'bg-gold-50 text-gold-700 dark:bg-gold-900/20 dark:text-gold-400',
  enterprise: 'bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400',
}

const VERTICAL_OPTIONS = [
  { value: 'insurance', label: 'Seguros' },
  { value: 'banking', label: 'Banca' },
  { value: 'music', label: 'Música' },
  { value: 'retail', label: 'Retail' },
  { value: 'telecom', label: 'Telecomunicaciones' },
  { value: 'real_estate', label: 'Inmobiliaria' },
  { value: 'other', label: 'Otro' },
]

// ── sub-components ───────────────────────────────────────────────────────────
function SectionCard({ title, description, children }: {
  title: string; description?: string; children: React.ReactNode
}) {
  return (
    <div className="bg-white dark:bg-night-800 border border-sand-200 dark:border-night-700 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-sand-100 dark:border-night-700">
        <h2 className="font-display text-base font-semibold text-sand-900 dark:text-night-50">{title}</h2>
        {description && (
          <p className="text-xs text-sand-900/50 dark:text-night-50/50 mt-0.5">{description}</p>
        )}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[200px_1fr] gap-4 items-start py-3 border-b border-sand-50 dark:border-night-700/50 last:border-0">
      <div className="pt-2">
        <p className="text-sm font-medium text-sand-900 dark:text-night-50">{label}</p>
        {hint && <p className="text-xs text-sand-900/40 dark:text-night-50/40 mt-0.5">{hint}</p>}
      </div>
      <div>{children}</div>
    </div>
  )
}

function Input({ value, onChange, placeholder, disabled, className }: {
  value: string; onChange?: (v: string) => void
  placeholder?: string; disabled?: boolean; className?: string
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={cn(
        'w-full px-3 py-2 text-sm rounded-xl border border-sand-200 dark:border-night-600',
        'bg-white dark:bg-night-700 text-sand-900 dark:text-night-50',
        'placeholder:text-sand-900/30 dark:placeholder:text-night-50/30',
        'focus:outline-none focus:ring-2 focus:ring-gold-400/50 focus:border-gold-400',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'transition-colors',
        className
      )}
    />
  )
}

function Select({ value, onChange, options, disabled }: {
  value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]; disabled?: boolean
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className={cn(
        'w-full px-3 py-2 text-sm rounded-xl border border-sand-200 dark:border-night-600',
        'bg-white dark:bg-night-700 text-sand-900 dark:text-night-50',
        'focus:outline-none focus:ring-2 focus:ring-gold-400/50 focus:border-gold-400',
        'disabled:opacity-50',
        'transition-colors'
      )}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

// masked API key field with show/hide
function ApiKeyField({ label, hint, icon, value, placeholder, onChange }: {
  label: string; hint?: string; icon: string
  value: string; placeholder?: string; onChange: (v: string) => void
}) {
  const [show, setShow] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <Field label={label} hint={hint}>
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <i className={`ti ${icon} text-base text-sand-900/30 dark:text-night-50/30`} />
          </div>
          <input
            ref={inputRef}
            type={show ? 'text' : 'password'}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder ?? 'sk-…'}
            className={cn(
              'w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-sand-200 dark:border-night-600',
              'bg-white dark:bg-night-700 text-sand-900 dark:text-night-50',
              'placeholder:text-sand-900/25 dark:placeholder:text-night-50/25',
              'focus:outline-none focus:ring-2 focus:ring-gold-400/50 focus:border-gold-400',
              'font-mono transition-colors'
            )}
          />
        </div>
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="px-3 rounded-xl border border-sand-200 dark:border-night-600 text-sand-900/40 dark:text-night-50/40 hover:text-sand-900 dark:hover:text-night-50 transition-colors"
        >
          <i className={`ti ${show ? 'ti-eye-off' : 'ti-eye'} text-base`} />
        </button>
      </div>
    </Field>
  )
}

// integration row
function IntegrationRow({ icon, name, description, connected, onConnect, onDisconnect, comingSoon }: {
  icon: string; name: string; description: string
  connected?: boolean; onConnect?: () => void; onDisconnect?: () => void; comingSoon?: boolean
}) {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-sand-50 dark:border-night-700/50 last:border-0">
      <div className={cn(
        'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
        connected ? 'bg-teal-50 dark:bg-teal-900/20' : 'bg-sand-100 dark:bg-night-700'
      )}>
        <i className={cn(
          `ti ${icon} text-lg`,
          connected ? 'text-teal-500' : 'text-sand-900/30 dark:text-night-50/30'
        )} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-sand-900 dark:text-night-50">{name}</p>
          {connected && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 px-1.5 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 inline-block" />
              Activo
            </span>
          )}
          {comingSoon && (
            <span className="text-[10px] font-medium text-sand-900/40 dark:text-night-50/40 bg-sand-100 dark:bg-night-700 px-1.5 py-0.5 rounded-full">
              Próximamente
            </span>
          )}
        </div>
        <p className="text-xs text-sand-900/40 dark:text-night-50/40 mt-0.5 truncate">{description}</p>
      </div>
      {!comingSoon && (
        <button
          type="button"
          onClick={connected ? onDisconnect : onConnect}
          className={cn(
            'shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors',
            connected
              ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
              : 'bg-sand-900 dark:bg-night-50 text-white dark:text-night-900 hover:opacity-90'
          )}
        >
          {connected ? 'Desconectar' : 'Conectar'}
        </button>
      )}
    </div>
  )
}

// save feedback toast
function SaveFeedback({ state }: { state: 'idle' | 'saving' | 'saved' | 'error' }) {
  if (state === 'idle') return null
  return (
    <div className={cn(
      'flex items-center gap-2 text-sm px-4 py-2 rounded-xl transition-all',
      state === 'saving' && 'text-sand-900/50 dark:text-night-50/50',
      state === 'saved' && 'text-teal-600 dark:text-teal-400',
      state === 'error' && 'text-red-500',
    )}>
      {state === 'saving' && <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
      {state === 'saved' && <i className="ti ti-check text-base" />}
      {state === 'error' && <i className="ti ti-alert-circle text-base" />}
      <span>
        {state === 'saving' ? 'Guardando…' : state === 'saved' ? 'Guardado' : 'Error al guardar'}
      </span>
    </div>
  )
}


// Stripe configured flag (will be true once STRIPE_SECRET_KEY is set)
const STRIPE_CONFIGURED = true

// ── Billing plans config ─────────────────────────────────────────────────────
const PLANS = [
  {
    key: 'starter' as const,
    name: 'Starter',
    icon: 'ti-rocket',
    monthlyPrice: 299,
    annualPrice: 2990,
    priceIds: {
      monthly: 'price_1TbQ07FULeu7PzK6ncQVbEUm',
      annual:  'price_1TbQ0DFULeu7PzK63w9dujNN',
    },
    features: [
      '5 campañas / mes',
      '10.000 contactos',
      '1 usuario',
      'KIE.ai + Suno',
      'Analytics básico',
      'Soporte email',
    ],
    highlighted: false,
  },
  {
    key: 'professional' as const,
    name: 'Professional',
    icon: 'ti-star',
    monthlyPrice: 799,
    annualPrice: 7990,
    priceIds: {
      monthly: 'price_1TbQ0JFULeu7PzK6x1Bj5bEa',
      annual:  'price_1TbQ0PFULeu7PzK6z1MhbjAT',
    },
    features: [
      '25 campañas / mes',
      '100.000 contactos',
      '5 usuarios',
      'Multi-vertical',
      'Analytics avanzado',
      'Integraciones CRM',
      'Soporte prioritario',
    ],
    highlighted: true,
  },
  {
    key: 'enterprise' as const,
    name: 'Enterprise',
    icon: 'ti-building-skyscraper',
    monthlyPrice: 1999,
    annualPrice: 19990,
    priceIds: {
      monthly: 'price_1TbQ0VFULeu7PzK6EaZAXHQK',
      annual:  'price_1TbQ0cFULeu7PzK6FcYlj2v2',
    },
    features: [
      'Campañas ilimitadas',
      'Contactos ilimitados',
      'Usuarios ilimitados',
      'API access',
      'SLA dedicado',
      'Onboarding personalizado',
      'Gestor de cuenta',
    ],
    highlighted: false,
  },
]

// ── BillingSection ────────────────────────────────────────────────────────────
function BillingSection({ tenant }: { tenant: NonNullable<ReturnType<typeof useAuth>['tenant']> }) {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly')
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)

  const { data: usage } = useQuery({
    queryKey: ['billing_usage', tenant.id],
    staleTime: 60_000,
    queryFn: async () => {
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
      const [{ count }, { data: stats }] = await Promise.all([
        supabase.from('campaigns').select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id).gte('created_at', monthStart),
        supabase.from('campaign_stats').select('emails_sent, cost_actual').eq('tenant_id', tenant.id),
      ])
      const sent = (stats ?? []).reduce((a, s) => a + (s.emails_sent ?? 0), 0)
      const cost = (stats ?? []).reduce((a, s) => a + (s.cost_actual ?? 0), 0)
      return { campaigns: count ?? 0, contactos: sent, coste: cost }
    },
  })

  const currentPlan = tenant.plan ?? 'starter'
  const stripeStatus = tenant.stripe_status
  const hasActiveSub = !!tenant.stripe_subscription_id && stripeStatus === 'active'

  const statusBadge = {
    active:   { label: 'Activo',        cls: 'bg-teal-50 text-teal-600 dark:bg-teal-900/20 dark:text-teal-400' },
    trialing: { label: 'Trial',         cls: 'bg-gold-50 text-gold-600 dark:bg-gold-900/20 dark:text-gold-400' },
    past_due: { label: 'Pago pendiente',cls: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' },
    canceled: { label: 'Cancelado',     cls: 'bg-sand-100 text-sand-500 dark:bg-night-700 dark:text-night-400' },
    inactive: { label: 'Sin suscripción',cls:'bg-sand-100 text-sand-500 dark:bg-night-700 dark:text-night-400' },
    unpaid:   { label: 'Sin pagar',     cls: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' },
  }
  const badge = statusBadge[stripeStatus ?? 'inactive']

  async function callBillingSession(action: 'checkout' | 'portal', priceId?: string) {
    setLoadingPlan(priceId ?? 'portal')

    try {
      const body = {
        action,
        price_id: priceId,
        return_url: window.location.href,
        success_url: `${window.location.origin}/settings?billing=success`,
        cancel_url:  `${window.location.origin}/settings?billing=cancel`,
      }
      const res = await supabase.functions.invoke('create-billing-session', { body })

      if (res.error) throw new Error(res.error.message)
      const { url } = res.data as { url: string }
      if (url) window.location.href = url
    } catch (err) {
      alert('Error al iniciar el pago. Inténtalo de nuevo.')
    } finally {
      setLoadingPlan(null)
    }
  }

  const annualSavings = Math.round((1 - (PLANS[0].annualPrice / 12) / PLANS[0].monthlyPrice) * 100)

  return (
    <div className="space-y-5">
      {/* Current status bar */}
      <div className="flex items-center justify-between p-4 bg-sand-50 dark:bg-night-700/50 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gold-50 dark:bg-gold-900/20 flex items-center justify-center">
            <i className={`ti ${PLANS.find(p => p.key === currentPlan)?.icon ?? 'ti-sparkles'} text-lg text-gold-500`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-sand-900 dark:text-night-50">
                {PLAN_LABELS[currentPlan]}
              </span>
              <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', badge.cls)}>
                {badge.label}
              </span>
            </div>
            <p className="text-xs text-sand-900/40 dark:text-night-50/40 mt-0.5">
              {tenant.stripe_price_id
                ? ['price_1TbQ0DFULeu7PzK63w9dujNN','price_1TbQ0PFULeu7PzK6z1MhbjAT','price_1TbQ0cFULeu7PzK6FcYlj2v2'].includes(tenant.stripe_price_id ?? '')
                    ? 'Facturación anual'
                    : 'Facturación mensual'
                : 'Sin suscripción activa'}
            </p>
          </div>
        </div>
        {hasActiveSub && (
          <button
            onClick={() => callBillingSession('portal')}
            disabled={loadingPlan === 'portal'}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border border-sand-200 dark:border-night-600 text-sand-900/60 dark:text-night-50/60 hover:text-sand-900 dark:hover:text-night-50 transition-colors disabled:opacity-50"
          >
            {loadingPlan === 'portal'
              ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
              : <i className="ti ti-external-link text-sm" />
            }
            Gestionar suscripción
          </button>
        )}
      </div>

      {/* Usage mini-stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Campañas este mes', value: usage ? usage.campaigns.toString() : '—', icon: 'ti-campaign' },
          { label: 'Contactos alcanzados', value: usage ? (usage.contactos >= 1000 ? `${(usage.contactos/1000).toFixed(1)}k` : usage.contactos.toString()) : '—', icon: 'ti-users' },
          { label: 'Coste acumulado', value: usage ? `€${usage.coste.toFixed(0)}` : '—', icon: 'ti-coin-euro' },
        ].map(({ label, value, icon }) => (
          <div key={label} className="bg-sand-50 dark:bg-night-700/50 rounded-xl p-3">
            <i className={`ti ${icon} text-sm text-sand-900/30 dark:text-night-50/30`} />
            <p className="font-display text-lg font-semibold text-sand-900 dark:text-night-50 mt-1 tabular-nums">{value}</p>
            <p className="text-[10px] text-sand-900/40 dark:text-night-50/40 mt-0.5 leading-tight">{label}</p>
          </div>
        ))}
      </div>

      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-3">
        <span className={cn('text-sm', billing === 'monthly' ? 'text-sand-900 dark:text-night-50 font-medium' : 'text-sand-900/40 dark:text-night-50/40')}>
          Mensual
        </span>
        <button
          onClick={() => setBilling(b => b === 'monthly' ? 'annual' : 'monthly')}
          className={cn(
            'relative w-11 h-6 rounded-full transition-colors',
            billing === 'annual' ? 'bg-gold-400' : 'bg-sand-200 dark:bg-night-600'
          )}
        >
          <div className={cn(
            'absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform',
            billing === 'annual' ? 'translate-x-6' : 'translate-x-1'
          )} />
        </button>
        <div className="flex items-center gap-1.5">
          <span className={cn('text-sm', billing === 'annual' ? 'text-sand-900 dark:text-night-50 font-medium' : 'text-sand-900/40 dark:text-night-50/40')}>
            Anual
          </span>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400">
            -{annualSavings}%
          </span>
        </div>
      </div>

      {/* Pricing cards */}
      <div className="grid grid-cols-1 gap-3">
        {PLANS.map(plan => {
          const isCurrent = plan.key === currentPlan
          const price = billing === 'monthly' ? plan.monthlyPrice : Math.round(plan.annualPrice / 12)
          const priceId = plan.priceIds[billing]
          const isLoading = loadingPlan === priceId
          const isDowngrade = PLANS.findIndex(p => p.key === plan.key) < PLANS.findIndex(p => p.key === currentPlan)

          return (
            <div
              key={plan.key}
              className={cn(
                'relative rounded-2xl border p-4 transition-all',
                plan.highlighted
                  ? 'border-gold-400 bg-gold-50/50 dark:bg-gold-900/5'
                  : 'border-sand-200 dark:border-night-600 bg-white dark:bg-night-800',
                isCurrent && 'ring-2 ring-gold-400/50'
              )}
            >
              {plan.highlighted && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-gold-400 text-night-900 uppercase tracking-wide">
                    Más popular
                  </span>
                </div>
              )}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5',
                    plan.highlighted ? 'bg-gold-100 dark:bg-gold-900/20' : 'bg-sand-100 dark:bg-night-700'
                  )}>
                    <i className={cn(`ti ${plan.icon} text-base`, plan.highlighted ? 'text-gold-600 dark:text-gold-400' : 'text-sand-900/40 dark:text-night-50/40')} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-sand-900 dark:text-night-50">{plan.name}</p>
                      {isCurrent && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gold-50 dark:bg-gold-900/20 text-gold-600 dark:text-gold-400">
                          Plan actual
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="font-display text-2xl font-bold text-sand-900 dark:text-night-50">€{price}</span>
                      <span className="text-xs text-sand-900/40 dark:text-night-50/40">/mes</span>
                      {billing === 'annual' && (
                        <span className="text-xs text-sand-900/30 dark:text-night-50/30 ml-1">
                          · €{plan.annualPrice}/año
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => !isCurrent && callBillingSession('checkout', priceId)}
                  disabled={isCurrent || isLoading}
                  className={cn(
                    'shrink-0 text-xs font-medium px-4 py-2 rounded-xl transition-colors flex items-center gap-1.5',
                    isCurrent
                      ? 'bg-sand-100 dark:bg-night-700 text-sand-900/30 dark:text-night-50/30 cursor-default'
                      : plan.highlighted
                      ? 'bg-gold-400 hover:bg-gold-500 text-night-900'
                      : 'bg-sand-900 dark:bg-night-50 text-white dark:text-night-900 hover:opacity-90',
                    'disabled:opacity-50'
                  )}
                >
                  {isLoading && <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />}
                  {isCurrent ? 'Plan actual' : isDowngrade ? 'Cambiar' : 'Contratar'}
                </button>
              </div>

              <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-1.5 text-xs text-sand-900/60 dark:text-night-50/60">
                    <i className="ti ti-check text-sm text-teal-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>

      {/* Setup notice */}
      {!STRIPE_CONFIGURED && (
        <div className="flex gap-2 p-3 rounded-xl bg-gold-50 dark:bg-gold-900/10 border border-gold-200 dark:border-gold-800/40 text-xs text-gold-700 dark:text-gold-400">
          <i className="ti ti-info-circle text-base shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Configura tu Stripe Secret Key</p>
            <p className="mt-0.5 opacity-80">
              Para activar el checkout añade <code className="font-mono bg-gold-100 dark:bg-gold-900/30 px-1 py-0.5 rounded">STRIPE_SECRET_KEY</code> en
              los secretos de tu Edge Function de Supabase. Webhook URL: <code className="font-mono bg-gold-100 dark:bg-gold-900/30 px-1 py-0.5 rounded">https://asolssebjyjyfbggraew.supabase.co/functions/v1/stripe-webhook</code>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────
export function Settings() {
  const { tenant, user, refreshTenant } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const billingResult = searchParams.get('billing') // 'success' | 'cancel'

  // Clear billing param + refresh tenant after Stripe redirect
  useEffect(() => {
    if (billingResult) {
      if (billingResult === 'success') refreshTenant()
      const t = setTimeout(() => {
        searchParams.delete('billing')
        setSearchParams(searchParams, { replace: true })
      }, 5000)
      return () => clearTimeout(t)
    }
  }, [billingResult])

  // Usage metrics for current month
  const { data: usageData } = useQuery({
    queryKey: ['settings_usage', tenant?.id],
    enabled: !!tenant?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const monthStart = startOfMonth(new Date()).toISOString()
      const [{ count: campaignCount }, { data: stats }] = await Promise.all([
        supabase
          .from('campaigns')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenant!.id)
          .gte('created_at', monthStart),
        supabase
          .from('campaign_stats')
          .select('emails_sent, cost_actual')
          .eq('tenant_id', tenant!.id),
      ])
      const totalSent = (stats ?? []).reduce((acc, s) => acc + (s.emails_sent ?? 0), 0)
      const totalCost = (stats ?? []).reduce((acc, s) => acc + (s.cost_actual ?? 0), 0)
      return { campaigns: campaignCount ?? 0, contactos: totalSent, coste: totalCost }
    },
  })

  // ── fetch settings ──
  const { data: settings, isLoading } = useQuery<TenantSettings>({
    queryKey: ['tenant_settings', tenant?.id],
    enabled: !!tenant?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_settings')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .single()
      if (error) throw error
      return data as TenantSettings
    },
  })

  const { data: profiles } = useQuery({
    queryKey: ['profiles', tenant?.id],
    enabled: !!tenant?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })

  // ── local state ──
  const [orgName, setOrgName] = useState('')
  const [orgVertical, setOrgVertical] = useState('insurance')
  const [website, setWebsite] = useState('')
  const [supportEmail, setSupportEmail] = useState('')
  const [kieKey, setKieKey] = useState('')
  const [sunoKey, setSunoKey] = useState('')
  const [mailerliteKey, setMailerliteKey] = useState('')
  const [integrations, setIntegrations] = useState<TenantSettings['integrations']>({})

  // ── sync state when data loads ──
  useEffect(() => {
    if (tenant) {
      setOrgName(tenant.name ?? '')
      setOrgVertical(tenant.vertical ?? 'insurance')
    }
  }, [tenant])

  useEffect(() => {
    if (settings) {
      setWebsite(settings.website ?? '')
      setSupportEmail(settings.support_email ?? '')
      setKieKey(settings.api_keys?.kie_ai ?? '')
      setSunoKey(settings.api_keys?.suno ?? '')
      setMailerliteKey(settings.api_keys?.mailerlite ?? '')
      setIntegrations(settings.integrations ?? {})
    }
  }, [settings])

  // ── save org ──
  const saveOrg = useMutation({
    mutationFn: async () => {
      const [r1, r2] = await Promise.all([
        supabase.from('tenants').update({ name: orgName, vertical: orgVertical }).eq('id', tenant!.id),
        supabase.from('tenant_settings').upsert({
          tenant_id: tenant!.id,
          website: website || null,
          support_email: supportEmail || null,
        }, { onConflict: 'tenant_id' }),
      ])
      if (r1.error) throw r1.error
      if (r2.error) throw r2.error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant_settings'] })
      toast.success('Organización guardada', 'Los cambios se han guardado correctamente.')
    },
    onError: (err: any) => {
      toast.error('Error al guardar', err?.message ?? 'Inténtalo de nuevo.')
    },
  })

  // ── save API keys ──
  const saveKeys = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('tenant_settings').upsert({
        tenant_id: tenant!.id,
        api_keys: {
          ...(kieKey ? { kie_ai: kieKey } : {}),
          ...(sunoKey ? { suno: sunoKey } : {}),
          ...(mailerliteKey ? { mailerlite: mailerliteKey } : {}),
        },
      }, { onConflict: 'tenant_id' })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant_settings'] })
      toast.success('Claves API guardadas', 'Las claves se han actualizado correctamente.')
    },
    onError: (err: any) => {
      toast.error('Error al guardar claves', err?.message ?? 'Inténtalo de nuevo.')
    },
  })

  // ── toggle integration ──
  const toggleIntegration = async (key: keyof TenantSettings['integrations'], connected: boolean) => {
    const updated = {
      ...integrations,
      [key]: { ...(integrations[key] ?? {}), connected },
    }
    setIntegrations(updated)
    await supabase.from('tenant_settings').upsert(
      { tenant_id: tenant!.id, integrations: updated },
      { onConflict: 'tenant_id' }
    )
    qc.invalidateQueries({ queryKey: ['tenant_settings'] })
  }

  const ROLE_LABELS: Record<string, string> = { admin: 'Admin', manager: 'Manager', analyst: 'Analyst' }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in pb-12">

      {/* header */}
      <div>
        <h1 className="font-display text-2xl text-sand-900 dark:text-night-50 font-semibold">
          Configuración
        </h1>
        <p className="text-sm text-sand-900/50 dark:text-night-50/50 mt-0.5">
          Gestiona tu organización, integraciones y equipo
        </p>
      </div>

      {/* Billing result banner */}
      {billingResult === 'success' && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-teal-50 dark:bg-teal-900/10 border border-teal-200 dark:border-teal-800/40">
          <div className="w-8 h-8 rounded-xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center shrink-0">
            <i className="ti ti-check text-base text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">¡Suscripción activada!</p>
            <p className="text-xs text-teal-600/70 dark:text-teal-400/70 mt-0.5">
              Tu plan ha sido actualizado. Los cambios ya están activos.
            </p>
          </div>
        </div>
      )}
      {billingResult === 'cancel' && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-sand-50 dark:bg-night-700/50 border border-sand-200 dark:border-night-600">
          <i className="ti ti-info-circle text-base text-sand-400 shrink-0" />
          <p className="text-sm text-sand-900/60 dark:text-night-50/60">
            Pago cancelado. Tu plan actual permanece sin cambios.
          </p>
        </div>
      )}

      {/* ── Organización ── */}
      <SectionCard title="Organización">
        <Field label="Nombre" hint="Nombre visible en informes y emails">
          <Input value={orgName} onChange={setOrgName} placeholder="Acme Corp" />
        </Field>
        <Field label="Vertical" hint="Sector principal de actividad">
          <Select value={orgVertical} onChange={setOrgVertical} options={VERTICAL_OPTIONS} />
        </Field>
        <Field label="Website">
          <Input value={website} onChange={setWebsite} placeholder="https://empresa.com" />
        </Field>
        <Field label="Email soporte">
          <Input value={supportEmail} onChange={setSupportEmail} placeholder="hello@empresa.com" />
        </Field>
        <div className="flex items-center justify-end gap-3 pt-3">
          <button
            onClick={() => saveOrg.mutate()}
            disabled={saveOrg.isPending}
            className="btn-primary text-sm py-2 px-5 disabled:opacity-50"
          >
            Guardar cambios
          </button>
        </div>
      </SectionCard>

      {/* ── Plan & Billing ── */}
      <SectionCard title="Plan & Facturación" description="Gestiona tu suscripción y cambia de plan en cualquier momento">
        {tenant && <BillingSection tenant={tenant} />}
      </SectionCard>

      {/* ── AI Providers ── */}
      <SectionCard title="AI Providers" description="Claves de API para generación de voz y música">
        <ApiKeyField
          label="KIE.ai"
          hint="Generación de voz con IA"
          icon="ti-microphone"
          value={kieKey}
          onChange={setKieKey}
          placeholder="kie_live_…"
        />
        <ApiKeyField
          label="Suno API"
          hint="Generación de música con IA"
          icon="ti-wave-sine"
          value={sunoKey}
          onChange={setSunoKey}
          placeholder="suno_…"
        />
        <div className="flex items-center justify-end gap-3 pt-3">
          <button
            onClick={() => saveKeys.mutate()}
            disabled={saveKeys.isPending}
            className="btn-primary text-sm py-2 px-5 disabled:opacity-50"
          >
            Guardar claves
          </button>
        </div>
      </SectionCard>

      {/* ── Entrega de email ── */}
      <SectionCard title="Entrega de email" description="Proveedor para el envío de las campañas">
        <ApiKeyField
          label="Mailerlite API Key"
          hint="Tu clave de API de MailerLite"
          icon="ti-mail"
          value={mailerliteKey}
          onChange={setMailerliteKey}
          placeholder="mlite_…"
        />
        <div className="flex items-center justify-end gap-3 pt-3">
          <button
            onClick={() => saveKeys.mutate()}
            disabled={saveKeys.isPending}
            className="btn-primary text-sm py-2 px-5 disabled:opacity-50"
          >
            Guardar
          </button>
        </div>
      </SectionCard>

      {/* ── Integraciones ── */}
      <SectionCard title="Integraciones CRM & Canales">
        <IntegrationRow
          icon="ti-database"
          name="Salesforce CRM"
          description="Sincroniza contactos y actualiza registros tras cada campaña"
          connected={integrations.salesforce?.connected}
          onConnect={() => toggleIntegration('salesforce', true)}
          onDisconnect={() => toggleIntegration('salesforce', false)}
        />
        <IntegrationRow
          icon="ti-topology-ring"
          name="HubSpot"
          description="Importa listas de contactos y envía eventos de engagement"
          connected={integrations.hubspot?.connected}
          onConnect={() => toggleIntegration('hubspot', true)}
          onDisconnect={() => toggleIntegration('hubspot', false)}
        />
        <IntegrationRow
          icon="ti-brand-whatsapp"
          name="WhatsApp Business"
          description="Canal alternativo de entrega para campañas de audio"
          connected={integrations.whatsapp?.connected}
          comingSoon
        />
      </SectionCard>

      {/* ── Equipo ── */}
      <SectionCard title="Equipo" description="Miembros con acceso a esta organización">
        <div className="space-y-0 divide-y divide-sand-50 dark:divide-night-700/50">
          {(profiles ?? []).map(p => (
            <div key={p.id} className="flex items-center gap-3 py-3">
              <div className="w-8 h-8 rounded-full bg-gold-100 dark:bg-gold-900/20 flex items-center justify-center shrink-0">
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <span className="text-sm font-semibold text-gold-600 dark:text-gold-400">
                    {(p.full_name ?? '?')[0].toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sand-900 dark:text-night-50 truncate">
                  {p.full_name ?? '—'}
                  {p.id === user?.id && (
                    <span className="ml-2 text-[10px] text-sand-900/30 dark:text-night-50/30">(tú)</span>
                  )}
                </p>
              </div>
              <span className="text-xs px-2 py-1 rounded-lg bg-sand-100 dark:bg-night-700 text-sand-900/50 dark:text-night-50/50 font-medium">
                {ROLE_LABELS[p.role] ?? p.role}
              </span>
            </div>
          ))}
          {(profiles ?? []).length === 0 && (
            <p className="text-sm text-sand-900/40 dark:text-night-50/40 py-3">Sin miembros cargados</p>
          )}
        </div>
        <div className="pt-4">
          <button
            disabled
            className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl border border-dashed border-sand-300 dark:border-night-600 text-sand-900/40 dark:text-night-50/40 cursor-not-allowed"
            title="Próximamente"
          >
            <i className="ti ti-user-plus text-base" />
            Invitar miembro
          </button>
          <p className="text-xs text-sand-900/30 dark:text-night-50/30 mt-1.5">Invitaciones disponibles en plan Professional+</p>
        </div>
      </SectionCard>

      {/* ── Zona peligrosa ── */}
      <SectionCard title="Zona de riesgo">
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium text-sand-900 dark:text-night-50">Eliminar organización</p>
            <p className="text-xs text-sand-900/40 dark:text-night-50/40 mt-0.5">
              Elimina permanentemente todos los datos. Esta acción no se puede deshacer.
            </p>
          </div>
          <button
            disabled
            className="text-sm font-medium px-4 py-2 rounded-xl text-red-400 border border-red-200 dark:border-red-900/40 opacity-40 cursor-not-allowed"
          >
            Eliminar
          </button>
        </div>
      </SectionCard>

    </div>
  )
}
