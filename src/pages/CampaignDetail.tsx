import { useParams, useNavigate, Link } from 'react-router-dom'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { cn, formatCurrency, formatNumber, formatPercent } from '@/lib/utils'
import type { Campaign, CampaignStats, GenerationJob } from '@/lib/supabase'
import { useToast } from '@/store/toastStore'

// ── label maps ────────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<Campaign['status'], string> = {
  draft: 'Borrador', queued: 'En cola', generating: 'Generando',
  ready: 'Lista', sent: 'Enviada', archived: 'Archivada',
}
const STATUS_STYLES: Record<Campaign['status'], string> = {
  draft:      'bg-sand-100 text-sand-500 dark:bg-night-700 dark:text-night-300',
  queued:     'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
  generating: 'bg-gold-50 text-gold-600 dark:bg-gold-900/20 dark:text-gold-400',
  ready:      'bg-teal-50 text-teal-600 dark:bg-teal-900/20 dark:text-teal-400',
  sent:       'bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-300',
  archived:   'bg-sand-100 text-sand-400 dark:bg-night-700 dark:text-night-500',
}
const VERTICAL_LABELS: Record<string, string> = {
  insurance: 'Seguros', banking: 'Banca', music: 'Música',
  retail: 'Retail', telecom: 'Teleco', real_estate: 'Inmobiliaria', other: 'Otro',
}
const JOB_STATUS_STYLES: Record<GenerationJob['status'], string> = {
  queued:     'bg-blue-50 text-blue-500 dark:bg-blue-900/20',
  processing: 'bg-gold-50 text-gold-500 dark:bg-gold-900/10',
  done:       'bg-teal-50 text-teal-500 dark:bg-teal-900/20',
  failed:     'bg-red-50 text-red-500 dark:bg-red-900/20',
}
const JOB_ICONS: Record<GenerationJob['status'], string> = {
  queued: 'ti-clock', processing: 'ti-loader-2', done: 'ti-check', failed: 'ti-x',
}

// ── stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, accent }: {
  icon: string; label: string; value: string; sub?: string
  accent?: 'gold' | 'teal' | 'neutral'
}) {
  const cls = {
    gold:    'bg-gold-50 dark:bg-gold-900/20 text-gold-500',
    teal:    'bg-teal-50 dark:bg-teal-900/20 text-teal-500',
    neutral: 'bg-sand-100 dark:bg-night-700 text-sand-400 dark:text-night-400',
  }[accent ?? 'neutral']

  return (
    <div className="bg-white dark:bg-night-800 border border-sand-200 dark:border-night-700 rounded-2xl p-5 flex flex-col gap-3">
      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', cls)}>
        <i className={`ti ${icon} text-lg`} />
      </div>
      <div>
        <p className="text-xs text-sand-900/50 dark:text-night-50/50 font-medium uppercase tracking-wide">{label}</p>
        <p className="font-display text-2xl font-semibold text-sand-900 dark:text-night-50 mt-0.5 tabular-nums">{value}</p>
        {sub && <p className="text-xs text-sand-900/35 dark:text-night-50/35 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── config row ────────────────────────────────────────────────────────────────
function ConfigRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-sand-50 dark:border-night-700/50 last:border-0 gap-4">
      <span className="text-xs text-sand-900/45 dark:text-night-50/45 font-medium shrink-0 w-32">{label}</span>
      <span className="text-sm text-sand-900 dark:text-night-50 text-right">{value}</span>
    </div>
  )
}


// ── CSV export ────────────────────────────────────────────────────────────────
function exportCampaignCSV(
  campaign: Campaign,
  stats: CampaignStats | null,
  jobs: GenerationJob[]
) {
  const rows: string[][] = []

  // Summary header
  rows.push(['== RESUMEN DE CAMPAÑA =='])
  rows.push(['Campo', 'Valor'])
  rows.push(['Nombre', campaign.name])
  rows.push(['Estado', campaign.status])
  rows.push(['Vertical', campaign.vertical])
  rows.push(['Tipo', campaign.type])
  rows.push(['Tono', campaign.tone ?? '—'])
  rows.push(['Idioma', campaign.language])
  rows.push(['Canal', campaign.delivery_channel])
  rows.push(['Proveedor IA', campaign.ai_provider])
  rows.push(['Total contactos', campaign.total_contacts.toString()])
  rows.push(['Coste estimado', campaign.cost_estimate ? `€${campaign.cost_estimate}` : '—'])
  rows.push(['Creada', new Date(campaign.created_at).toLocaleString('es-ES')])
  rows.push([])

  // Performance
  if (stats) {
    rows.push(['== RENDIMIENTO =='])
    rows.push(['Métrica', 'Valor'])
    rows.push(['Emails enviados', stats.emails_sent.toString()])
    rows.push(['Emails abiertos', stats.emails_opened.toString()])
    rows.push(['Open rate', `${((stats.emails_opened / stats.emails_sent) * 100).toFixed(1)}%`])
    rows.push(['Clicks', stats.emails_clicked.toString()])
    rows.push(['Click rate', `${((stats.emails_clicked / stats.emails_sent) * 100).toFixed(1)}%`])
    rows.push(['CTOR', stats.emails_opened > 0 ? `${((stats.emails_clicked / stats.emails_opened) * 100).toFixed(1)}%` : '—'])
    rows.push(['Bajas', stats.unsubscribes.toString()])
    rows.push(['Coste real', `€${stats.cost_actual.toFixed(2)}`])
    rows.push([])
  }

  // Jobs
  if (jobs.length > 0) {
    rows.push(['== JOBS DE GENERACIÓN =='])
    rows.push(['#', 'Estado', 'Creado', 'Error'])
    jobs.forEach((j, i) => {
      rows.push([
        (i + 1).toString(),
        j.status,
        new Date(j.created_at).toLocaleString('es-ES'),
        j.error_message ?? '',
      ])
    })
  }

  const csv = rows
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `campaña_${campaign.name.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── main ──────────────────────────────────────────────────────────────────────
export function CampaignDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const qc = useQueryClient()
  const [showConfirm, setShowConfirm] = useState(false)
  const [sending, setSending] = useState(false)

  async function sendCampaign() {
    if (!c) return
    setSending(true)
    setShowConfirm(false)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await supabase.functions.invoke('send-campaign', {
        body: { campaign_id: c.id },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (res.error) throw new Error(res.error.message)
      const body = res.data as { error?: string; success?: boolean }
      if (body?.error) throw new Error(body.error)
      toast.success('Campaña enviada', `"${c.name}" se ha enviado correctamente.`)
      qc.invalidateQueries({ queryKey: ['campaign', c.id] })
    } catch (err) {
      toast.error('Error al enviar', err instanceof Error ? err.message : 'Inténtalo de nuevo.')
    } finally {
      setSending(false)
    }
  }
  const { tenant } = useAuth()

  const { data, isLoading, error } = useQuery({
    queryKey: ['campaign_detail', id],
    enabled: !!id && !!tenant?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const [{ data: campaign, error: ce }, { data: stats }, { data: jobs }] = await Promise.all([
        supabase.from('campaigns').select('*').eq('id', id!).eq('tenant_id', tenant!.id).single(),
        supabase.from('campaign_stats').select('*').eq('campaign_id', id!).maybeSingle(),
        supabase.from('generation_jobs').select('*').eq('campaign_id', id!).order('created_at', { ascending: true }),
      ])
      if (ce) throw ce
      return { campaign: campaign as Campaign, stats: stats as CampaignStats | null, jobs: (jobs ?? []) as GenerationJob[] }
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !data?.campaign) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="rounded-2xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 p-6 text-sm text-red-600 dark:text-red-400">
          {error ? `Error: ${(error as Error).message}` : 'Campaña no encontrada'}
        </div>
      </div>
    )
  }

  const { campaign: c, stats, jobs } = data
  const hasStats = stats && (stats.emails_sent ?? 0) > 0
  const openRate = hasStats ? (stats.emails_opened / stats.emails_sent) * 100 : null
  const clickRate = hasStats ? (stats.emails_clicked / stats.emails_sent) * 100 : null
  const ctor = hasStats && stats.emails_opened > 0 ? (stats.emails_clicked / stats.emails_opened) * 100 : null
  const createdAt = new Date(c.created_at)
  const doneJobs = jobs.filter(j => j.status === 'done').length
  const isActive = c.status === 'queued' || c.status === 'generating'

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-12">

      {/* breadcrumb + header */}
      <div>
        <div className="flex items-center gap-1.5 text-xs text-sand-900/40 dark:text-night-50/40 mb-3">
          <Link to="/campaigns" className="hover:text-sand-900 dark:hover:text-night-50 transition-colors">
            Campañas
          </Link>
          <i className="ti ti-chevron-right text-[10px]" />
          <span className="text-sand-900/60 dark:text-night-50/60 truncate max-w-[200px]">{c.name}</span>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <button
              onClick={() => navigate('/campaigns')}
              className="mt-1 w-8 h-8 rounded-xl flex items-center justify-center text-sand-900/40 dark:text-night-50/40 hover:bg-sand-100 dark:hover:bg-night-700 transition-colors shrink-0"
            >
              <i className="ti ti-arrow-left text-base" />
            </button>
            <div>
              <h1 className="font-display text-2xl font-semibold text-sand-900 dark:text-night-50">{c.name}</h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1', STATUS_STYLES[c.status])}>
                  {c.status === 'generating' && <i className="ti ti-loader-2 animate-spin text-[10px]" />}
                  {STATUS_LABELS[c.status]}
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gold-50 dark:bg-gold-900/20 text-gold-700 dark:text-gold-400">
                  {VERTICAL_LABELS[c.vertical] ?? c.vertical}
                </span>
                <span className="text-xs text-sand-900/35 dark:text-night-50/35">
                  {format(createdAt, "d MMM yyyy 'a las' HH:mm", { locale: es })}
                  {' · '}
                  {formatDistanceToNow(createdAt, { locale: es, addSuffix: true })}
                </span>
              </div>
            </div>
          </div>

          {/* primary CTAs */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                exportCampaignCSV(c, stats, jobs)
                toast.success('CSV exportado', `Campaña "${c.name}" descargada.`)
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-sand-200 dark:border-night-600 text-sand-900/60 dark:text-night-50/60 hover:text-sand-900 dark:hover:text-night-50 text-sm font-medium transition-colors"
              title="Exportar CSV"
            >
              <i className="ti ti-download text-base" />
              <span className="hidden sm:inline">Exportar</span>
            </button>
            {isActive ? (
              <Link
                to={`/campaigns/${c.id}/queue`}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gold-400 hover:bg-gold-500 text-night-900 text-sm font-medium transition-colors"
              >
                <i className="ti ti-list-check text-base" />
                Ver cola
              </Link>
            ) : c.status === 'ready' ? (
              <button
                onClick={() => setShowConfirm(true)}
                disabled={sending}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-60 text-white text-sm font-medium transition-colors"
              >
                {sending
                  ? <><i className="ti ti-loader-2 animate-spin text-base" /> Enviando…</>
                  : <><i className="ti ti-send text-base" /> Enviar campaña</>
                }
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* performance stats — only if sent/ready with data */}
      {hasStats ? (
        <div>
          <p className="text-xs font-semibold text-sand-900/40 dark:text-night-50/40 uppercase tracking-wide mb-3">
            Rendimiento
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon="ti-send" label="Enviados" value={formatNumber(stats!.emails_sent)} accent="neutral" />
            <StatCard icon="ti-mail-opened" label="Open rate" value={formatPercent(openRate!)} sub={`${formatNumber(stats!.emails_opened)} aperturas`} accent="gold" />
            <StatCard icon="ti-cursor-text" label="Click rate" value={formatPercent(clickRate!)} sub={ctor != null ? `CTOR ${formatPercent(ctor)}` : undefined} accent="teal" />
            <StatCard icon="ti-coin-euro" label="Coste real" value={formatCurrency(stats!.cost_actual)} sub={stats!.unsubscribes > 0 ? `${stats!.unsubscribes} bajas` : 'Sin bajas'} accent="neutral" />
          </div>
        </div>
      ) : (
        <div className="bg-sand-50 dark:bg-night-700/40 rounded-2xl p-5 flex items-center gap-3 text-sm text-sand-900/50 dark:text-night-50/50">
          <i className="ti ti-chart-bar text-lg text-sand-300 dark:text-night-600 shrink-0" />
          {c.status === 'sent'
            ? 'Las métricas de rendimiento aparecerán en las próximas horas.'
            : c.status === 'ready'
            ? 'La campaña está lista para enviar. Las métricas se mostrarán después del envío.'
            : 'Las métricas estarán disponibles cuando la campaña sea enviada.'}
        </div>
      )}

      {/* two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* config — 2 cols */}
        <div className="lg:col-span-2 bg-white dark:bg-night-800 border border-sand-200 dark:border-night-700 rounded-2xl p-5">
          <p className="text-xs font-semibold text-sand-900/40 dark:text-night-50/40 uppercase tracking-wide mb-1">
            Configuración
          </p>
          <ConfigRow label="Tipo" value={c.type} />
          <ConfigRow label="Objetivo" value={c.goal} />
          <ConfigRow label="Tono" value={c.tone} />
          <ConfigRow label="Idioma" value={c.language} />
          <ConfigRow label="Canal" value={c.delivery_channel === 'email' ? 'Email' : 'WhatsApp'} />
          <ConfigRow label="Proveedor IA" value={c.ai_provider} />
          <ConfigRow label="Estilo musical" value={c.music_style} />
          <ConfigRow label="Duración audio" value={c.duration_seconds ? `${c.duration_seconds}s` : null} />
          <ConfigRow label="Asunto email" value={c.subject} />
          <ConfigRow label="Contactos" value={formatNumber(c.total_contacts)} />
          <ConfigRow label="Coste estimado" value={c.cost_estimate ? formatCurrency(c.cost_estimate) : null} />
          {c.ai_prompt && (
            <div className="mt-3 pt-3 border-t border-sand-50 dark:border-night-700/50">
              <p className="text-xs text-sand-900/40 dark:text-night-50/40 font-medium mb-1.5">Prompt IA</p>
              <p className="text-sm text-sand-900/70 dark:text-night-50/70 leading-relaxed whitespace-pre-wrap">
                {c.ai_prompt}
              </p>
            </div>
          )}
        </div>

        {/* jobs sidebar */}
        <div className="bg-white dark:bg-night-800 border border-sand-200 dark:border-night-700 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-sand-900/40 dark:text-night-50/40 uppercase tracking-wide">
              Jobs de generación
            </p>
            {jobs.length > 0 && (
              <span className="text-xs text-sand-900/40 dark:text-night-50/40">
                {doneJobs}/{jobs.length}
              </span>
            )}
          </div>

          {jobs.length === 0 ? (
            <p className="text-sm text-sand-900/35 dark:text-night-50/35">Sin jobs registrados</p>
          ) : (
            <div className="space-y-2">
              {/* progress bar */}
              {jobs.length > 0 && (
                <div className="w-full h-1.5 bg-sand-100 dark:bg-night-700 rounded-full mb-3 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-teal-400 transition-all duration-700"
                    style={{ width: `${(doneJobs / jobs.length) * 100}%` }}
                  />
                </div>
              )}
              {jobs.map((job, i) => (
                <div key={job.id} className="flex items-center gap-2.5">
                  <div className={cn(
                    'w-6 h-6 rounded-lg flex items-center justify-center shrink-0',
                    JOB_STATUS_STYLES[job.status]
                  )}>
                    <i className={cn(
                      `ti ${JOB_ICONS[job.status]} text-xs`,
                      job.status === 'processing' && 'animate-spin'
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-sand-900 dark:text-night-50 truncate">
                      Contacto #{(i + 1).toString().padStart(3, '0')}
                    </p>
                    {job.error_message && (
                      <p className="text-[10px] text-red-500 truncate">{job.error_message}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-sand-900/30 dark:text-night-50/30 shrink-0 tabular-nums">
                    {formatDistanceToNow(new Date(job.created_at), { locale: es, addSuffix: true })}
                  </span>
                </div>
              ))}
              {isActive && (
                <Link
                  to={`/campaigns/${c.id}/queue`}
                  className="mt-2 flex items-center justify-center gap-1 w-full py-2 rounded-xl text-xs font-medium text-gold-600 dark:text-gold-400 hover:bg-gold-50 dark:hover:bg-gold-900/10 transition-colors"
                >
                  <i className="ti ti-external-link text-sm" />
                  Ver cola en tiempo real
                </Link>
              )}
            </div>
          )}
        </div>
      </div>


      {/* ── Send confirmation modal ────────────────────────────────────────── */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1A1510] rounded-2xl border border-black/8 dark:border-white/8 shadow-xl p-6 w-full max-w-sm">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center flex-shrink-0">
                <i className="ti ti-send text-teal-500 text-xl" />
              </div>
              <div>
                <h3 className="font-semibold text-sand-900 dark:text-night-50">
                  Confirmar envío
                </h3>
                <p className="text-sm text-sand-900/60 dark:text-night-50/60 mt-0.5">
                  Vas a enviar <strong>"{c?.name}"</strong> a {formatNumber(c?.total_contacts ?? 0)} contactos vía Mailerlite. Esta acción no se puede deshacer.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium border border-black/10 dark:border-white/10 hover:bg-black/4 dark:hover:bg-white/4 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={sendCampaign}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-teal-500 hover:bg-teal-600 text-white transition-colors"
              >
                Sí, enviar ahora
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}