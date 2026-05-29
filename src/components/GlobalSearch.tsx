import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

type ResultKind = 'campaign' | 'contact' | 'list'

interface SearchResult {
  id: string
  kind: ResultKind
  title: string
  subtitle: string
  href: string
  icon: string
  badge?: string
  badgeColor?: string
}

// ── Status badge colors for campaigns ────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  sent:       'text-[#0D7A64] dark:text-[#2BB5A0]',
  generating: 'text-[#8C5E0A] dark:text-[#C9973A]',
  queued:     'text-[#8C5E0A] dark:text-[#C9973A]',
  ready:      'text-[#0D7A64] dark:text-[#2BB5A0]',
  draft:      'text-sand-900/40 dark:text-night-50/40',
  archived:   'text-sand-900/30 dark:text-night-50/30',
}

const STATUS_LABEL: Record<string, string> = {
  sent: 'Enviada', generating: 'Generando', queued: 'En cola',
  ready: 'Lista', draft: 'Borrador', archived: 'Archivada',
}

// ── Hook ──────────────────────────────────────────────────────────────────────

function useSearchResults(query: string, tenantId: string | undefined) {
  const trimmed = query.trim()

  const { data: campaigns = [], isFetching: fc } = useQuery({
    queryKey: ['search-campaigns', tenantId, trimmed],
    queryFn: async () => {
      const { data } = await supabase
        .from('campaigns')
        .select('id, name, status, total_contacts')
        .eq('tenant_id', tenantId!)
        .ilike('name', `%${trimmed}%`)
        .limit(5)
      return data ?? []
    },
    enabled: !!tenantId && trimmed.length >= 1,
  })

  const { data: contacts = [], isFetching: fco } = useQuery({
    queryKey: ['search-contacts', tenantId, trimmed],
    queryFn: async () => {
      const { data } = await supabase
        .from('contacts')
        .select('id, email, first_name, last_name, company, status')
        .eq('tenant_id', tenantId!)
        .or(`email.ilike.%${trimmed}%,first_name.ilike.%${trimmed}%,last_name.ilike.%${trimmed}%,company.ilike.%${trimmed}%`)
        .limit(5)
      return data ?? []
    },
    enabled: !!tenantId && trimmed.length >= 2,
  })

  const { data: lists = [], isFetching: fl } = useQuery({
    queryKey: ['search-lists', tenantId, trimmed],
    queryFn: async () => {
      const { data } = await supabase
        .from('contact_lists')
        .select('id, name, contact_count, description')
        .eq('tenant_id', tenantId!)
        .ilike('name', `%${trimmed}%`)
        .limit(4)
      return data ?? []
    },
    enabled: !!tenantId && trimmed.length >= 1,
  })

  const results: SearchResult[] = [
    ...campaigns.map((c) => ({
      id:          c.id,
      kind:        'campaign' as ResultKind,
      title:       c.name,
      subtitle:    `${c.total_contacts} contactos`,
      href:        `/campaigns/${c.id}`,
      icon:        'ti-speakerphone',
      badge:       STATUS_LABEL[c.status] ?? c.status,
      badgeColor:  STATUS_COLOR[c.status],
    })),
    ...contacts.map((c) => {
      const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email
      return {
        id:       c.id,
        kind:     'contact' as ResultKind,
        title:    name,
        subtitle: name !== c.email ? c.email : (c.company ?? ''),
        href:     '/contacts',
        icon:     'ti-user',
      }
    }),
    ...lists.map((l) => ({
      id:       l.id,
      kind:     'list' as ResultKind,
      title:    l.name,
      subtitle: `${l.contact_count ?? 0} contactos${l.description ? ` · ${l.description}` : ''}`,
      href:     '/contacts',
      icon:     'ti-users',
    })),
  ]

  return { results, loading: fc || fco || fl }
}

// ── Quick nav items (always shown when query is empty) ────────────────────────

const QUICK_NAV = [
  { label: 'Dashboard',     href: '/dashboard',    icon: 'ti-layout-dashboard' },
  { label: 'Campañas',      href: '/campaigns',    icon: 'ti-speakerphone' },
  { label: 'Contactos',     href: '/contacts',     icon: 'ti-users' },
  { label: 'Analytics',     href: '/analytics',    icon: 'ti-chart-bar' },
  { label: 'Configuración', href: '/settings',     icon: 'ti-settings' },
  { label: 'Actividad',     href: '/audit',        icon: 'ti-clipboard-list' },
]

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
}

export function GlobalSearch({ open, onClose }: Props) {
  const navigate    = useNavigate()
  const { tenant }  = useAuth()
  const inputRef    = useRef<HTMLInputElement>(null)
  const listRef     = useRef<HTMLDivElement>(null)

  const [query,   setQuery]   = useState('')
  const [focused, setFocused] = useState(0)

  // Debounce query for search
  const [debouncedQ, setDebouncedQ] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query), 250)
    return () => clearTimeout(t)
  }, [query])

  const { results, loading } = useSearchResults(debouncedQ, tenant?.id)

  // Items to display (quick nav or search results)
  const showQuick = query.trim().length === 0
  const items: Array<{ id: string; title: string; subtitle: string; href: string; icon: string; badge?: string; badgeColor?: string }> =
    showQuick
      ? QUICK_NAV.map((n) => ({ id: n.href, title: n.label, subtitle: '', href: n.href, icon: n.icon }))
      : results

  // Reset on open/close
  useEffect(() => {
    if (open) {
      setQuery('')
      setDebouncedQ('')
      setFocused(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Keep focused item in view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${focused}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [focused])

  const go = useCallback((href: string) => {
    navigate(href)
    onClose()
  }, [navigate, onClose])

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocused((f) => Math.min(f + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocused((f) => Math.max(f - 1, 0))
    } else if (e.key === 'Enter' && items[focused]) {
      go(items[focused].href)
    }
  }

  if (!open) return null

  const groupLabel = (idx: number) => {
    if (showQuick) return idx === 0 ? 'Navegación rápida' : null
    const r = results[idx]
    if (!r) return null
    const prev = results[idx - 1]
    if (!prev || prev.kind !== r.kind) {
      return r.kind === 'campaign' ? 'Campañas'
           : r.kind === 'contact'  ? 'Contactos'
           : 'Listas'
    }
    return null
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Panel */}
      <div className="relative w-full max-w-xl bg-white dark:bg-night-800 rounded-2xl shadow-2xl border border-black/8 dark:border-white/8 overflow-hidden">

        {/* Input row */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-black/8 dark:border-white/8">
          <i className={cn(
            'ti ti-search text-base flex-shrink-0',
            loading ? 'opacity-0' : 'text-sand-900/40 dark:text-night-50/40'
          )} />
          {loading && (
            <i className="ti ti-loader-2 animate-spin text-[#C9973A] text-base absolute left-4" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setFocused(0) }}
            onKeyDown={handleKey}
            placeholder="Buscar campañas, contactos, listas…"
            className="flex-1 bg-transparent text-sm text-sand-900 dark:text-night-50 placeholder:text-sand-900/30 dark:placeholder:text-night-50/30 outline-none"
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setFocused(0); inputRef.current?.focus() }}
              className="text-sand-900/30 dark:text-night-50/30 hover:text-sand-900 dark:hover:text-night-50 transition-colors"
            >
              <i className="ti ti-x text-sm" />
            </button>
          )}
          <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono text-sand-900/30 dark:text-night-50/30 bg-black/5 dark:bg-white/8 border border-black/8 dark:border-white/8 flex-shrink-0">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[380px] overflow-y-auto py-2">
          {items.length === 0 && debouncedQ.length > 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-sand-900/30 dark:text-night-50/30">
              <i className="ti ti-search-off text-2xl" />
              <p className="text-sm">Sin resultados para "{debouncedQ}"</p>
            </div>
          )}

          {items.map((item, idx) => {
            const label = groupLabel(idx)
            return (
              <div key={item.id + idx}>
                {label && (
                  <p className="px-4 pt-3 pb-1 text-[10px] font-medium uppercase tracking-widest text-sand-900/35 dark:text-night-50/35">
                    {label}
                  </p>
                )}
                <button
                  data-idx={idx}
                  onClick={() => go(item.href)}
                  onMouseEnter={() => setFocused(idx)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                    focused === idx
                      ? 'bg-[#C9973A]/8 dark:bg-[#C9973A]/10'
                      : 'hover:bg-black/3 dark:hover:bg-white/3'
                  )}
                >
                  <div className={cn(
                    'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
                    focused === idx
                      ? 'bg-[#C9973A]/15 text-[#8C5E0A] dark:text-[#C9973A]'
                      : 'bg-black/5 dark:bg-white/8 text-sand-900/50 dark:text-night-50/50'
                  )}>
                    <i className={`ti ${item.icon} text-xs`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-sand-900 dark:text-night-50 truncate">
                      {item.title}
                    </p>
                    {item.subtitle && (
                      <p className="text-xs text-sand-900/40 dark:text-night-50/40 truncate mt-0.5">
                        {item.subtitle}
                      </p>
                    )}
                  </div>

                  {item.badge && (
                    <span className={cn('text-xs flex-shrink-0', item.badgeColor)}>
                      {item.badge}
                    </span>
                  )}

                  {focused === idx && (
                    <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono text-sand-900/30 dark:text-night-50/30 bg-black/5 dark:bg-white/8 border border-black/8 dark:border-white/8 flex-shrink-0">
                      ↵
                    </kbd>
                  )}
                </button>
              </div>
            )
          })}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2.5 border-t border-black/5 dark:border-white/5 flex items-center gap-4">
          <span className="text-[10px] text-sand-900/30 dark:text-night-50/30 flex items-center gap-1">
            <kbd className="px-1 rounded bg-black/5 dark:bg-white/8 border border-black/8 dark:border-white/8 font-mono">↑↓</kbd>
            navegar
          </span>
          <span className="text-[10px] text-sand-900/30 dark:text-night-50/30 flex items-center gap-1">
            <kbd className="px-1 rounded bg-black/5 dark:bg-white/8 border border-black/8 dark:border-white/8 font-mono">↵</kbd>
            abrir
          </span>
          <span className="text-[10px] text-sand-900/30 dark:text-night-50/30 flex items-center gap-1">
            <kbd className="px-1 rounded bg-black/5 dark:bg-white/8 border border-black/8 dark:border-white/8 font-mono">Esc</kbd>
            cerrar
          </span>
        </div>
      </div>
    </div>
  )
}
