import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase, type GenerationJob, type Campaign } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

type JobStatus = GenerationJob['status']

export function GenerationQueue() {
  const navigate = useNavigate()
  const { id: campaignId } = useParams<{ id: string }>()
  const { tenant } = useAuth()
  const [jobs, setJobs] = useState<GenerationJob[]>([])

  // Fetch campaign details
  const { data: campaign } = useQuery<Campaign | null>({
    queryKey: ['campaign', campaignId],
    queryFn: async () => {
      if (!campaignId) return null
      const { data } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .single()
      return data ?? null
    },
    enabled: !!campaignId,
  })

  // Initial fetch of jobs
  useEffect(() => {
    if (!campaignId || !tenant) return

    supabase
      .from('generation_jobs')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('queued_at', { ascending: true })
      .limit(100)
      .then(({ data }) => {
        if (data) setJobs(data)
      })
  }, [campaignId, tenant])

  // Realtime subscription
  useEffect(() => {
    if (!campaignId) return

    const channel = supabase
      .channel(`queue-${campaignId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'generation_jobs',
          filter: `campaign_id=eq.${campaignId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setJobs((prev) => [...prev, payload.new as GenerationJob])
          } else if (payload.eventType === 'UPDATE') {
            setJobs((prev) =>
              prev.map((j) => (j.id === payload.new.id ? (payload.new as GenerationJob) : j))
            )
          } else if (payload.eventType === 'DELETE') {
            setJobs((prev) => prev.filter((j) => j.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [campaignId])

  const done = jobs.filter((j) => j.status === 'done').length
  const processing = jobs.filter((j) => j.status === 'processing').length
  const queued = jobs.filter((j) => j.status === 'queued').length
  const failed = jobs.filter((j) => j.status === 'failed').length
  const total = campaign?.total_contacts ?? jobs.length
  const pct = total > 0 ? Math.min(Math.round((done / total) * 100), 100) : 0

  // ETA estimate: avg 52s/job, remaining = total - done - processing
  const remaining = total - done - processing
  const etaMin = Math.round((remaining * 52) / 60)
  const etaStr = etaMin > 60
    ? `~${Math.floor(etaMin / 60)}h ${etaMin % 60}min`
    : etaMin > 0 ? `~${etaMin}min` : 'Finalizando…'

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div>
        <button
          onClick={() => navigate('/campaigns')}
          className="flex items-center gap-1.5 text-sm text-sand-900/40 dark:text-night-50/40 hover:text-sand-900 dark:hover:text-night-50 transition-colors mb-3"
        >
          <i className="ti ti-arrow-left text-sm" /> Campañas
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl text-sand-900 dark:text-night-50 font-semibold">
              Cola de generación
            </h1>
            <p className="text-sm text-sand-900/50 dark:text-night-50/50 mt-0.5">
              {campaign?.name ?? 'Cargando…'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#2BB5A0]/10 border border-[#2BB5A0]/20">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2BB5A0] animate-pulse" />
            <span className="text-xs font-medium text-[#0D7A64] dark:text-[#2BB5A0]">Live</span>
          </div>
        </div>
      </div>

      {/* Progress card */}
      <div className="bg-white dark:bg-[#1A1510] rounded-xl border border-black/8 dark:border-white/8 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="font-display text-3xl font-semibold text-sand-900 dark:text-night-50">
              {done.toLocaleString('es-ES')}
            </span>
            <span className="text-sand-900/40 dark:text-night-50/40 text-sm ml-1">
              / {total.toLocaleString('es-ES')}
            </span>
          </div>
          <div className="text-right">
            <p className="text-xs text-sand-900/40 dark:text-night-50/40">ETA</p>
            <p className="text-sm font-sans font-semibold text-sand-900 dark:text-night-50">{etaStr}</p>
          </div>
        </div>
        <div className="h-3 bg-sand-200 dark:bg-night-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#C9973A] to-[#2BB5A0] rounded-full transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-sand-900/40 dark:text-night-50/40 mt-2">{pct}% completado</p>

        <div className="grid grid-cols-4 gap-4 mt-5 pt-4 border-t border-black/8 dark:border-white/8">
          {[
            { label: 'Completados', value: done, color: 'teal' },
            { label: 'En proceso', value: processing, color: 'gold' },
            { label: 'En cola', value: queued, color: 'neutral' },
            { label: 'Errores', value: failed, color: 'red' },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <p className={cn(
                'font-display text-xl font-semibold',
                color === 'teal' ? 'text-[#0D7A64] dark:text-[#2BB5A0]' :
                color === 'gold' ? 'text-[#8C5E0A] dark:text-[#C9973A]' :
                color === 'red' ? 'text-red-500' :
                'text-sand-900/50 dark:text-night-50/50'
              )}>{value.toLocaleString('es-ES')}</p>
              <p className="text-xs text-sand-900/40 dark:text-night-50/40 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Jobs list */}
      <div className="bg-white dark:bg-[#1A1510] rounded-xl border border-black/8 dark:border-white/8 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-black/8 dark:border-white/8 flex items-center justify-between">
          <p className="text-sm font-sans font-medium text-sand-900/50 dark:text-night-50/50">
            {jobs.length > 0
              ? `Mostrando ${jobs.length} de ${total.toLocaleString('es-ES')} trabajos`
              : 'Cargando trabajos…'}
          </p>
          {jobs.length === 0 && (
            <i className="ti ti-loader-2 animate-spin text-sand-900/30 dark:text-night-50/30" />
          )}
        </div>

        {jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-sand-900/30 dark:text-night-50/30">
            <i className="ti ti-list-check text-3xl mb-2" />
            <p className="text-sm">Sin trabajos todavía</p>
          </div>
        ) : (
          <div className="divide-y divide-black/5 dark:divide-white/5">
            {jobs.map((job, i) => (
              <JobRow key={job.id} job={job} index={i + 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function JobRow({ job, index }: { job: GenerationJob; index: number }) {
  const durationSec = job.started_at && job.completed_at
    ? Math.round((new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000)
    : null

  return (
    <div className="px-5 py-3 flex items-center gap-4">
      <span className="text-xs font-mono text-sand-900/30 dark:text-night-50/30 w-8 text-right flex-shrink-0">
        #{index}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-sans text-sand-900 dark:text-night-50 truncate">
          {job.prompt ? job.prompt.slice(0, 60) : `Job ${index}`}
        </p>
        <p className="text-xs text-sand-900/40 dark:text-night-50/40 mt-0.5">
          {job.provider} · {job.duration_seconds}s · {job.style ?? 'sin estilo'}
        </p>
      </div>
      {durationSec !== null && (
        <span className="text-xs font-mono text-sand-900/40 dark:text-night-50/40">{durationSec}s</span>
      )}
      <JobStatusBadge status={job.status} />
    </div>
  )
}

function JobStatusBadge({ status }: { status: JobStatus }) {
  const map: Record<JobStatus, { label: string; cls: string }> = {
    done:       { label: 'Listo',      cls: 'px-2 py-0.5 rounded-full text-xs font-medium bg-[#2BB5A0]/15 text-[#0D7A64] dark:text-[#2BB5A0]' },
    processing: { label: 'Procesando', cls: 'px-2 py-0.5 rounded-full text-xs font-medium bg-[#C9973A]/15 text-[#8C5E0A] dark:text-[#C9973A]' },
    queued:     { label: 'En cola',    cls: 'px-2 py-0.5 rounded-full text-xs font-medium bg-black/5 dark:bg-white/8 text-sand-900/40 dark:text-night-50/40' },
    failed:     { label: 'Error',      cls: 'px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/20 text-red-600' },
  }
  const { label, cls } = map[status]
  return (
    <span className={cn(cls, 'flex items-center gap-1 whitespace-nowrap')}>
      {status === 'processing' && <i className="ti ti-loader-2 animate-spin text-[10px]" />}
      {label}
    </span>
  )
}
