import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase, type Campaign } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrency, formatNumber, cn } from '@/lib/utils'

type StatusFilter = 'all' | Campaign['status']
type SortKey = 'created_at' | 'name' | 'total_contacts' | 'cost_estimate'

const STATUS_LABELS: Record<Campaign['status'], string> = {
  draft:      'Borrador',
  queued:     'En cola',
  generating: 'Generando',
  ready:      'Lista',
  sent:       'Enviada',
  archived:   'Archivada',
}

const STATUS_STYLES: Record<Campaign['status'], string> = {
  sent:       'bg-[#2BB5A0]/15 text-[#0D7A64] dark:text-[#2BB5A0]',
  generating: 'bg-[#C9973A]/15 text-[#8C5E0A] dark:text-[#C9973A]',
  queued:     'bg-[#C9973A]/10 text-[#8C5E0A] dark:text-[#C9973A]',
  ready:      'bg-[#2BB5A0]/15 text-[#0D7A64] dark:text-[#2BB5A0]',
  draft:      'bg-black/5 dark:bg-white/8 text-sand-900/50 dark:text-night-50/50',
  archived:   'bg-black/5 dark:bg-white/8 text-sand-900/30 dark:text-night-50/30',
}

const VERTICAL_LABELS: Record<string, string> = {
  insurance: 'Seguros', telecom: 'Telecom', ecommerce: 'Ecommerce',
  banking: 'Banca', retail: 'Retail',
}

export function Campaigns() {
  const navigate = useNavigate()
  const { tenant } = useAuth()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortAsc, setSortAsc] = useState(false)

  const { data: campaigns = [], isLoading, refetch } = useQuery<Campaign[]>({
    queryKey: ['campaigns', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!tenant,
    refetchInterval: 15_000, // poll every 15s for status changes
  })

  // Client-side filter + sort (fast enough for campaign counts at this scale)
  const filtered = useMemo(() => {
    let rows = campaigns

    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.vertical.toLowerCase().includes(q) ||
        c.type.toLowerCase().includes(q)
      )
    }

    if (statusFilter !== 'all') {
      rows = rows.filter((c) => c.status === statusFilter)
    }

    rows = [...rows].sort((a, b) => {
      let av: string | number = a[sortKey] ?? ''
      let bv: string | number = b[sortKey] ?? ''
      if (typeof av === 'string') av = av.toLowerCase()
      if (typeof bv === 'string') bv = bv.toLowerCase()
      return sortAsc ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
    })

    return rows
  }, [campaigns, search, statusFilter, sortKey, sortAsc])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v)
    else { setSortKey(key); setSortAsc(false) }
  }

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: campaigns.length }
    campaigns.forEach((c) => { counts[c.status] = (counts[c.status] ?? 0) + 1 })
    return counts
  }, [campaigns])

  const SortIcon = ({ k }: { k: SortKey }) => (
    <i className={cn(
      'ti text-[10px] ml-1',
      sortKey === k ? (sortAsc ? 'ti-arrow-up text-[#C9973A]' : 'ti-arrow-down text-[#C9973A]') : 'ti-arrows-sort opacity-30'
    )} />
  )

  return (
    <div className="max-w-6xl mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-sand-900 dark:text-night-50 font-semibold">
            Campañas
          </h1>
          <p className="text-sm text-sand-900/50 dark:text-night-50/50 mt-0.5">
            {isLoading ? 'Cargando…' : `${campaigns.length} campaña${campaigns.length !== 1 ? 's' : ''} en total`}
          </p>
        </div>
        <button
          onClick={() => navigate('/campaigns/new')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#C9973A] text-white font-semibold text-sm hover:bg-[#b8832e] active:scale-95 transition-all duration-150"
        >
          <i className="ti ti-plus text-sm" /> Nueva campaña
        </button>
      </div>

      {/* Search + Status filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-sand-900/30 dark:text-night-50/30 text-sm pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, vertical…"
            className="w-full pl-8 pr-3 py-2 rounded-lg text-sm bg-white dark:bg-[#1A1510] border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-[#C9973A]/30 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sand-900/30 dark:text-night-50/30 hover:text-sand-900 dark:hover:text-night-50"
            >
              <i className="ti ti-x text-xs" />
            </button>
          )}
        </div>

        {/* Status pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(['all', 'draft', 'queued', 'generating', 'ready', 'sent', 'archived'] as const).map((s) => {
            const count = statusCounts[s] ?? 0
            if (s !== 'all' && count === 0) return null
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  statusFilter === s
                    ? 'bg-[#C9973A] text-white shadow-sm'
                    : 'bg-white dark:bg-[#1A1510] border border-black/10 dark:border-white/10 text-sand-900/60 dark:text-night-50/60 hover:border-[#C9973A]/40'
                )}
              >
                {s === 'all' ? 'Todas' : STATUS_LABELS[s]}
                <span className={cn(
                  'px-1 rounded text-[10px] font-semibold',
                  statusFilter === s ? 'bg-white/20' : 'bg-black/8 dark:bg-white/10'
                )}>
                  {s === 'all' ? campaigns.length : count}
                </span>
              </button>
            )
          })}
        </div>

        <button
          onClick={() => refetch()}
          className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center text-sand-900/30 dark:text-night-50/30 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          title="Actualizar"
        >
          <i className={cn('ti ti-refresh text-sm', isLoading && 'animate-spin')} />
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1A1510] rounded-xl border border-black/8 dark:border-white/8 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3 text-sand-900/30 dark:text-night-50/30">
              <i className="ti ti-loader-2 animate-spin text-2xl" />
              <p className="text-sm">Cargando campañas…</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-sand-900/30 dark:text-night-50/30">
            <i className="ti ti-speakerphone text-3xl" />
            <p className="text-sm">
              {search || statusFilter !== 'all' ? 'Sin resultados para este filtro' : 'Sin campañas todavía'}
            </p>
            {!search && statusFilter === 'all' && (
              <button
                onClick={() => navigate('/campaigns/new')}
                className="text-xs text-[#C9973A] hover:underline"
              >
                Crear primera campaña →
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/8 dark:border-white/8">
                {[
                  { label: 'Nombre',     key: 'name' as SortKey },
                  { label: 'Vertical',   key: null },
                  { label: 'Contactos',  key: 'total_contacts' as SortKey },
                  { label: 'Coste est.', key: 'cost_estimate' as SortKey },
                  { label: 'Creada',     key: 'created_at' as SortKey },
                  { label: 'Estado',     key: null },
                  { label: '',           key: null },
                ].map(({ label, key }) => (
                  <th
                    key={label}
                    onClick={() => key && toggleSort(key)}
                    className={cn(
                      'px-5 py-3 text-left text-xs font-sans font-medium text-sand-900/40 dark:text-night-50/40 uppercase tracking-wide whitespace-nowrap',
                      key && 'cursor-pointer hover:text-sand-900/70 dark:hover:text-night-50/70 select-none'
                    )}
                  >
                    {label}{key && <SortIcon k={key} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              {filtered.map((c) => (
                <CampaignRow key={c.id} campaign={c} navigate={navigate} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer count */}
      {!isLoading && filtered.length > 0 && filtered.length !== campaigns.length && (
        <p className="text-xs text-sand-900/40 dark:text-night-50/40 text-center">
          Mostrando {filtered.length} de {campaigns.length} campañas
        </p>
      )}
    </div>
  )
}

function CampaignRow({ campaign: c, navigate }: { campaign: Campaign; navigate: (path: string) => void }) {
  const createdDate = new Date(c.created_at).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'short', year: '2-digit',
  })

  return (
    <tr className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors group">
      {/* Name */}
      <td className="px-5 py-4 max-w-xs">
        <p
          className="font-sans font-medium text-sand-900 dark:text-night-50 truncate hover:text-gold-600 dark:hover:text-gold-400 cursor-pointer transition-colors"
          onClick={() => navigate(`/campaigns/${c.id}`)}
        >{c.name}</p>
        <p className="text-xs text-sand-900/40 dark:text-night-50/40 mt-0.5 capitalize">{c.type}</p>
      </td>

      {/* Vertical */}
      <td className="px-5 py-4">
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#C9973A]/10 text-[#8C5E0A] dark:text-[#C9973A]">
          {VERTICAL_LABELS[c.vertical] ?? c.vertical}
        </span>
      </td>

      {/* Contacts */}
      <td className="px-5 py-4 font-mono text-sm text-sand-900/70 dark:text-night-50/70">
        {formatNumber(c.total_contacts)}
      </td>

      {/* Cost */}
      <td className="px-5 py-4 font-mono text-sm text-sand-900/70 dark:text-night-50/70">
        {c.cost_estimate ? formatCurrency(c.cost_estimate) : '—'}
      </td>

      {/* Date */}
      <td className="px-5 py-4 text-xs text-sand-900/50 dark:text-night-50/50 whitespace-nowrap">
        {createdDate}
      </td>

      {/* Status */}
      <td className="px-5 py-4">
        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 w-fit', STATUS_STYLES[c.status])}>
          {c.status === 'generating' && <i className="ti ti-loader-2 animate-spin text-[10px]" />}
          {STATUS_LABELS[c.status]}
        </span>
      </td>

      {/* Actions */}
      <td className="px-5 py-4">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {(c.status === 'generating' || c.status === 'queued') && (
            <button
              onClick={() => navigate(`/campaigns/${c.id}/queue`)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#C9973A]/10 text-[#8C5E0A] dark:text-[#C9973A] hover:bg-[#C9973A]/20 transition-colors"
            >
              <i className="ti ti-list-check text-xs" /> Cola
            </button>
          )}
          <button
            onClick={() => navigate(`/campaigns/${c.id}`)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-sand-900/30 dark:text-night-50/30 hover:bg-black/5 dark:hover:bg-white/5 hover:text-sand-900 dark:hover:text-night-50 transition-colors"
            title="Ver detalle"
          >
            <i className="ti ti-arrow-right text-sm" />
          </button>
        </div>
      </td>
    </tr>
  )
}
