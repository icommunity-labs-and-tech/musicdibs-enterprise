import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'

const CONTACTS = [
  'María García', 'Carlos López', 'Ana Martínez', 'Pedro Sánchez', 'Laura Fernández',
  'Miguel Torres', 'Elena Ruiz', 'Juan Morales', 'Isabel Jiménez', 'Francisco Núñez',
]

type JobStatus = 'done' | 'processing' | 'queued' | 'error'

interface Job {
  id: number
  name: string
  status: JobStatus
  duration?: number
}

function makeJobs(): Job[] {
  return Array.from({ length: 20 }, (_, i) => ({
    id: i + 1,
    name: CONTACTS[i % CONTACTS.length],
    status: i < 7 ? 'done' : i < 9 ? 'processing' : 'queued',
    duration: i < 7 ? Math.round(45 + Math.random() * 30) : undefined,
  }))
}

export function GenerationQueue() {
  const navigate = useNavigate()
  const [jobs, setJobs] = useState<Job[]>(makeJobs)
  const [tick, setTick] = useState(0)

  // Simulate progress
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 3000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    setJobs((prev) => {
      const next = [...prev]
      const processingIdx = next.findIndex((j) => j.status === 'processing')
      const queuedIdx = next.findIndex((j) => j.status === 'queued')
      if (processingIdx !== -1) {
        next[processingIdx] = { ...next[processingIdx], status: 'done', duration: 52 }
        if (queuedIdx !== -1) {
          next[queuedIdx] = { ...next[queuedIdx], status: 'processing' }
        }
      }
      return next
    })
  }, [tick])

  const done = jobs.filter((j) => j.status === 'done').length
  const total = 1247
  const pct = Math.round((done / total) * 100)

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div>
        <button onClick={() => navigate('/campaigns')} className="flex items-center gap-1.5 text-sm text-sand-900/40 dark:text-night-50/40 hover:text-sand-900 dark:hover:text-night-50 transition-colors mb-3">
          <i className="ti ti-arrow-left text-sm" /> Campañas
        </button>
        <h1 className="font-display text-2xl text-sand-900 dark:text-night-50 font-semibold">
          Cola de generación
        </h1>
        <p className="text-sm text-sand-900/50 dark:text-night-50/50 mt-0.5">
          Feliz Cumpleaños Premium — Asegurados 2026
        </p>
      </div>

      {/* Progress bar */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="font-display text-3xl font-semibold text-sand-900 dark:text-night-50">{done}</span>
            <span className="text-sand-900/40 dark:text-night-50/40 text-sm ml-1">/ {total.toLocaleString('es-ES')}</span>
          </div>
          <div className="text-right">
            <p className="text-xs text-sand-900/40 dark:text-night-50/40">ETA</p>
            <p className="text-sm font-sans font-semibold text-sand-900 dark:text-night-50">~1h 47min</p>
          </div>
        </div>
        <div className="h-3 bg-sand-200 dark:bg-night-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#C9973A] to-[#2BB5A0] rounded-full transition-all duration-1000"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-sand-900/40 dark:text-night-50/40 mt-2">{pct}% completado</p>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-4 mt-5 pt-4 border-t border-black/8 dark:border-white/8">
          {[
            { label: 'Completados', value: done, color: 'teal' },
            { label: 'En proceso', value: jobs.filter((j) => j.status === 'processing').length, color: 'gold' },
            { label: 'En cola', value: total - done - jobs.filter((j) => j.status === 'processing').length, color: 'neutral' },
            { label: 'Errores', value: 0, color: 'red' },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <p className={cn(
                'font-display text-xl font-semibold',
                color === 'teal' ? 'text-[#0D7A64] dark:text-[#2BB5A0]' :
                color === 'gold' ? 'text-[#8C5E0A] dark:text-[#C9973A]' :
                color === 'red' ? 'text-red-500' :
                'text-sand-900/50 dark:text-night-50/50'
              )}>{value}</p>
              <p className="text-xs text-sand-900/40 dark:text-night-50/40 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Jobs list */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-black/8 dark:border-white/8">
          <p className="text-sm font-sans font-medium text-sand-900/50 dark:text-night-50/50">
            Mostrando 20 de {total.toLocaleString('es-ES')} trabajos
          </p>
        </div>
        <div className="divide-y divide-black/5 dark:divide-white/5">
          {jobs.map((job) => (
            <div key={job.id} className="px-5 py-3 flex items-center gap-4">
              <span className="text-xs font-mono text-sand-900/30 dark:text-night-50/30 w-8 text-right flex-shrink-0">
                #{job.id}
              </span>
              <p className="text-sm font-sans text-sand-900 dark:text-night-50 flex-1">{job.name}</p>
              {job.duration && (
                <span className="text-xs font-mono text-sand-900/40 dark:text-night-50/40">{job.duration}s</span>
              )}
              <JobStatusBadge status={job.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function JobStatusBadge({ status }: { status: JobStatus }) {
  const map = {
    done: { label: 'Listo', cls: 'badge-teal' },
    processing: { label: 'Procesando', cls: 'badge-gold' },
    queued: { label: 'En cola', cls: 'badge bg-black/5 dark:bg-white/8 text-sand-900/40 dark:text-night-50/40' },
    error: { label: 'Error', cls: 'badge-red' },
  }
  const { label, cls } = map[status]
  return (
    <span className={cn(cls, 'flex items-center gap-1')}>
      {status === 'processing' && <i className="ti ti-loader-2 animate-spin text-[10px]" />}
      {label}
    </span>
  )
}
