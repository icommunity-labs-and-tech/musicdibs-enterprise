import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/store/toastStore'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────
interface ContactList {
  id: string
  name: string
  description: string | null
  contact_count: number
  color: string
  tags: string[]
  mailerlite_group_id: string | null
  created_at: string
}

interface Contact {
  id: string
  list_id: string | null
  email: string
  first_name: string | null
  last_name: string | null
  company: string | null
  phone: string | null
  status: 'active' | 'unsubscribed' | 'bounced' | 'cleaned'
  subscribed_at: string | null
  created_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_BADGE: Record<string, string> = {
  active:       'bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400',
  unsubscribed: 'bg-sand-100 text-sand-900/50 dark:bg-night-700 dark:text-night-50/40',
  bounced:      'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
  cleaned:      'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
}

function initials(c: Contact) {
  const f = c.first_name?.[0] ?? ''
  const l = c.last_name?.[0] ?? ''
  return (f + l).toUpperCase() || c.email[0].toUpperCase()
}

function fullName(c: Contact) {
  if (c.first_name || c.last_name) return [c.first_name, c.last_name].filter(Boolean).join(' ')
  return null
}

// ── Modal: create/edit list ───────────────────────────────────────────────────
const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#f97316']

function ListModal({ list, onClose, tenantId }: {
  list?: ContactList | null
  onClose: () => void
  tenantId: string
}) {
  const qc = useQueryClient()
  const toast = useToast()
  const [name, setName]         = useState(list?.name ?? '')
  const [desc, setDesc]         = useState(list?.description ?? '')
  const [color, setColor]       = useState(list?.color ?? COLORS[0])
  const [mlGroupId, setMlGroupId] = useState(list?.mailerlite_group_id ?? '')

  const save = useMutation({
    mutationFn: async () => {
      const payload = { name, description: desc, color, mailerlite_group_id: mlGroupId.trim() || null }
      if (list) {
        await supabase.from('contact_lists').update(payload).eq('id', list.id)
      } else {
        await supabase.from('contact_lists').insert({ tenant_id: tenantId, ...payload })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact_lists'] })
      toast.success(list ? 'Lista actualizada' : 'Lista creada')
      onClose()
    },
    onError: (e: Error) => toast.error('Error al guardar', e.message),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-night-800 rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="font-display text-lg font-semibold text-sand-900 dark:text-night-50 mb-5">
          {list ? 'Editar lista' : 'Nueva lista de contactos'}
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-sand-900/60 dark:text-night-50/60 mb-1.5">Nombre</label>
            <input
              value={name} onChange={e => setName(e.target.value)}
              placeholder="Ej: Clientes Premium"
              className="w-full px-3 py-2 text-sm rounded-xl border border-sand-200 dark:border-night-600 bg-white dark:bg-night-700 text-sand-900 dark:text-night-50 focus:outline-none focus:ring-2 focus:ring-gold-400/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-sand-900/60 dark:text-night-50/60 mb-1.5">Descripción (opcional)</label>
            <textarea
              value={desc} onChange={e => setDesc(e.target.value)}
              rows={2}
              placeholder="Para qué se usa esta lista…"
              className="w-full px-3 py-2 text-sm rounded-xl border border-sand-200 dark:border-night-600 bg-white dark:bg-night-700 text-sand-900 dark:text-night-50 focus:outline-none focus:ring-2 focus:ring-gold-400/50 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-sand-900/60 dark:text-night-50/60 mb-1.5">
              Mailerlite Group ID <span className="text-sand-900/30 dark:text-night-50/30">(opcional)</span>
            </label>
            <input
              value={mlGroupId} onChange={e => setMlGroupId(e.target.value)}
              placeholder="Ej: 123456789"
              className="w-full px-3 py-2 text-sm rounded-xl border border-sand-200 dark:border-night-600 bg-white dark:bg-night-700 text-sand-900 dark:text-night-50 focus:outline-none focus:ring-2 focus:ring-gold-400/50 font-mono"
            />
            <p className="mt-1 text-xs text-sand-900/40 dark:text-night-50/40">
              Vincula esta lista a un grupo de Mailerlite para el envío de campañas de email.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-sand-900/60 dark:text-night-50/60 mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className={cn('w-7 h-7 rounded-full transition-all', color === c && 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-night-800 ring-current')}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose}
            className="px-4 py-2 text-sm rounded-xl border border-sand-200 dark:border-night-600 text-sand-900/60 dark:text-night-50/60 hover:bg-sand-50 dark:hover:bg-night-700">
            Cancelar
          </button>
          <button onClick={() => save.mutate()} disabled={!name.trim() || save.isPending}
            className="px-4 py-2 text-sm rounded-xl bg-sand-900 dark:bg-night-50 text-white dark:text-night-900 hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
            {save.isPending && <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />}
            {list ? 'Guardar cambios' : 'Crear lista'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal: add contact ────────────────────────────────────────────────────────
function AddContactModal({ listId, tenantId, onClose }: {
  listId: string | null
  tenantId: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const toast = useToast()
  const [form, setForm] = useState({ email: '', first_name: '', last_name: '', company: '', phone: '' })

  const save = useMutation({
    mutationFn: async () => {
      if (!form.email.trim()) throw new Error('El email es obligatorio')
      await supabase.from('contacts').insert({
        tenant_id: tenantId,
        list_id: listId,
        ...form,
        email: form.email.toLowerCase().trim(),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] })
      qc.invalidateQueries({ queryKey: ['contact_lists'] })
      toast.success('Contacto añadido')
      onClose()
    },
    onError: (e: Error) => toast.error('Error al añadir contacto', e.message),
  })

  const fields: { key: keyof typeof form; label: string; placeholder: string; required?: boolean }[] = [
    { key: 'email',      label: 'Email',    placeholder: 'nombre@empresa.es', required: true },
    { key: 'first_name', label: 'Nombre',   placeholder: 'Ana' },
    { key: 'last_name',  label: 'Apellidos',placeholder: 'García' },
    { key: 'company',    label: 'Empresa',  placeholder: 'Acme SL' },
    { key: 'phone',      label: 'Teléfono', placeholder: '+34 600 000 000' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-night-800 rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="font-display text-lg font-semibold text-sand-900 dark:text-night-50 mb-5">Añadir contacto</h2>
        <div className="grid grid-cols-2 gap-3">
          {fields.map(({ key, label, placeholder, required }) => (
            <div key={key} className={key === 'email' ? 'col-span-2' : ''}>
              <label className="block text-xs font-medium text-sand-900/60 dark:text-night-50/60 mb-1.5">
                {label}{required && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              <input
                type={key === 'email' ? 'email' : 'text'}
                value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full px-3 py-2 text-sm rounded-xl border border-sand-200 dark:border-night-600 bg-white dark:bg-night-700 text-sand-900 dark:text-night-50 focus:outline-none focus:ring-2 focus:ring-gold-400/50"
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose}
            className="px-4 py-2 text-sm rounded-xl border border-sand-200 dark:border-night-600 text-sand-900/60 dark:text-night-50/60 hover:bg-sand-50 dark:hover:bg-night-700">
            Cancelar
          </button>
          <button onClick={() => save.mutate()} disabled={!form.email.trim() || save.isPending}
            className="px-4 py-2 text-sm rounded-xl bg-sand-900 dark:bg-night-50 text-white dark:text-night-900 hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
            {save.isPending && <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />}
            Añadir contacto
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export function Contacts() {
  const { tenant } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()

  const [selectedList, setSelectedList]     = useState<string | null>(null) // null = all
  const [search, setSearch]                 = useState('')
  const [statusFilter, setStatusFilter]     = useState<string>('all')
  const [selectedIds, setSelectedIds]       = useState<Set<string>>(new Set())
  const [showListModal, setShowListModal]   = useState(false)
  const [editList, setEditList]             = useState<ContactList | null>(null)
  const [showAddContact, setShowAddContact] = useState(false)
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: lists = [] } = useQuery<ContactList[]>({
    queryKey: ['contact_lists', tenant?.id],
    enabled: !!tenant?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contact_lists')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .order('created_at')
      if (error) throw error
      return data ?? []
    },
  })

  const { data: contacts = [], isLoading } = useQuery<Contact[]>({
    queryKey: ['contacts', tenant?.id, selectedList],
    enabled: !!tenant?.id,
    staleTime: 30_000,
    queryFn: async () => {
      let q = supabase.from('contacts').select('*').eq('tenant_id', tenant!.id).order('created_at', { ascending: false })
      if (selectedList) q = q.eq('list_id', selectedList)
      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
  })

  // ── Derived ────────────────────────────────────────────────────────────────
  const filtered = contacts.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      c.email.toLowerCase().includes(q) ||
      (c.first_name ?? '').toLowerCase().includes(q) ||
      (c.last_name  ?? '').toLowerCase().includes(q) ||
      (c.company    ?? '').toLowerCase().includes(q)
    )
  })

  const stats = {
    total:        contacts.length,
    active:       contacts.filter(c => c.status === 'active').length,
    unsubscribed: contacts.filter(c => c.status === 'unsubscribed').length,
    bounced:      contacts.filter(c => c.status === 'bounced').length,
  }

  // ── Mutations ──────────────────────────────────────────────────────────────
  const deleteList = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('contact_lists').delete().eq('id', id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact_lists'] })
      qc.invalidateQueries({ queryKey: ['contacts'] })
      if (selectedList === editList?.id) setSelectedList(null)
      toast.success('Lista eliminada')
    },
    onError: (e: Error) => toast.error('Error', e.message),
  })

  const deleteContacts = useMutation({
    mutationFn: async (ids: string[]) => {
      await supabase.from('contacts').delete().in('id', ids)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] })
      qc.invalidateQueries({ queryKey: ['contact_lists'] })
      setSelectedIds(new Set())
      toast.success(`${selectedIds.size} contacto${selectedIds.size > 1 ? 's' : ''} eliminado${selectedIds.size > 1 ? 's' : ''}`)
    },
    onError: (e: Error) => toast.error('Error', e.message),
  })

  // ── CSV Import ─────────────────────────────────────────────────────────────
  async function handleCSV(file: File) {
    const text = await file.text()
    const lines = text.trim().split('\n')
    if (lines.length < 2) { toast.error('CSV vacío o inválido'); return }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))
    const rows = lines.slice(1)
    setImportProgress({ done: 0, total: rows.length })

    const BATCH = 50
    let imported = 0

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH).map(row => {
        const vals = row.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
        const obj: Record<string, string> = {}
        headers.forEach((h, idx) => { obj[h] = vals[idx] ?? '' })
        return {
          tenant_id:  tenant!.id,
          list_id:    selectedList,
          email:      (obj['email'] || obj['e-mail'] || obj['correo'] || '').toLowerCase(),
          first_name: obj['first_name'] || obj['nombre'] || obj['name'] || null,
          last_name:  obj['last_name']  || obj['apellidos'] || obj['surname'] || null,
          company:    obj['company']    || obj['empresa'] || null,
          phone:      obj['phone']      || obj['telefono'] || obj['teléfono'] || null,
        }
      }).filter(r => r.email && r.email.includes('@'))

      if (batch.length > 0) {
        const { error } = await supabase.from('contacts').upsert(batch, {
          onConflict: 'tenant_id,email',
          ignoreDuplicates: false,
        })
        if (error) console.warn('Batch error:', error)
        imported += batch.length
      }
      setImportProgress({ done: Math.min(i + BATCH, rows.length), total: rows.length })
    }

    setImportProgress(null)
    qc.invalidateQueries({ queryKey: ['contacts'] })
    qc.invalidateQueries({ queryKey: ['contact_lists'] })
    toast.success(`${imported} contactos importados`, `Archivo: ${file.name}`)
  }

  // ── Checkbox helpers ───────────────────────────────────────────────────────
  const allChecked = filtered.length > 0 && filtered.every(c => selectedIds.has(c.id))
  function toggleAll() {
    if (allChecked) setSelectedIds(new Set())
    else setSelectedIds(new Set(filtered.map(c => c.id)))
  }
  function toggleOne(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (!tenant) return null

  const currentList = lists.find(l => l.id === selectedList)

  return (
    <div className="flex h-full min-h-0">
      {/* ── Sidebar: lists ──────────────────────────────────────────────── */}
      <aside className="w-60 shrink-0 border-r border-sand-200 dark:border-night-700 flex flex-col bg-sand-50/50 dark:bg-night-800/50">
        <div className="p-4 border-b border-sand-200 dark:border-night-700 flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-sand-900 dark:text-night-50">Listas</h2>
          <button onClick={() => { setEditList(null); setShowListModal(true) }}
            className="w-6 h-6 rounded-lg bg-sand-900 dark:bg-night-50 text-white dark:text-night-900 flex items-center justify-center hover:opacity-80 transition-opacity">
            <i className="ti ti-plus text-xs" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {/* All contacts */}
          <button
            onClick={() => setSelectedList(null)}
            className={cn(
              'w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors',
              selectedList === null
                ? 'bg-sand-900 dark:bg-night-50 text-white dark:text-night-900'
                : 'text-sand-900/70 dark:text-night-50/70 hover:bg-sand-100 dark:hover:bg-night-700'
            )}
          >
            <div className="flex items-center gap-2.5">
              <i className="ti ti-users text-sm" />
              <span>Todos</span>
            </div>
            <span className={cn(
              'text-xs font-medium px-1.5 py-0.5 rounded-full',
              selectedList === null ? 'bg-white/20 text-white dark:text-night-900 dark:bg-night-900/20' : 'bg-sand-200 dark:bg-night-600 text-sand-900/60 dark:text-night-50/60'
            )}>
              {lists.reduce((s, l) => s + l.contact_count, 0)}
            </span>
          </button>

          {/* Individual lists */}
          {lists.map(list => (
            <div key={list.id} className="group relative">
              <button
                onClick={() => setSelectedList(list.id)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors pr-8',
                  selectedList === list.id
                    ? 'bg-sand-900 dark:bg-night-50 text-white dark:text-night-900'
                    : 'text-sand-900/70 dark:text-night-50/70 hover:bg-sand-100 dark:hover:bg-night-700'
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: list.color }} />
                  <span className="truncate">{list.name}</span>
                </div>
                <span className={cn(
                  'text-xs font-medium px-1.5 py-0.5 rounded-full shrink-0',
                  selectedList === list.id ? 'bg-white/20 text-white dark:text-night-900 dark:bg-night-900/20' : 'bg-sand-200 dark:bg-night-600 text-sand-900/60 dark:text-night-50/60'
                )}>
                  {list.contact_count}
                </span>
              </button>
              {/* Edit/delete actions */}
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5">
                <button onClick={e => { e.stopPropagation(); setEditList(list); setShowListModal(true) }}
                  className="w-5 h-5 rounded-md hover:bg-sand-200 dark:hover:bg-night-600 flex items-center justify-center text-sand-900/40 dark:text-night-50/40">
                  <i className="ti ti-pencil text-[10px]" />
                </button>
                <button onClick={e => {
                    e.stopPropagation()
                    if (confirm(`¿Eliminar "${list.name}"? Los contactos se moverán a Sin lista.`)) {
                      deleteList.mutate(list.id)
                    }
                  }}
                  className="w-5 h-5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/20 flex items-center justify-center text-sand-900/40 dark:text-night-50/40 hover:text-red-500">
                  <i className="ti ti-trash text-[10px]" />
                </button>
              </div>
            </div>
          ))}
        </nav>

        {/* Import CSV */}
        <div className="p-3 border-t border-sand-200 dark:border-night-700">
          <input ref={fileRef} type="file" accept=".csv" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleCSV(f); e.target.value = '' }} />
          <button onClick={() => fileRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-dashed border-sand-300 dark:border-night-600 text-xs text-sand-900/50 dark:text-night-50/50 hover:border-gold-400 hover:text-gold-600 dark:hover:text-gold-400 transition-colors">
            {importProgress
              ? <><div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                  {importProgress.done}/{importProgress.total}</>
              : <><i className="ti ti-file-import" /> Importar CSV</>
            }
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-sand-200 dark:border-night-700 flex items-center justify-between gap-4 shrink-0">
          <div>
            <h1 className="font-display text-xl font-bold text-sand-900 dark:text-night-50">
              {currentList ? currentList.name : 'Todos los contactos'}
            </h1>
            {currentList?.description && (
              <p className="text-xs text-sand-900/50 dark:text-night-50/50 mt-0.5">{currentList.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <button onClick={() => deleteContacts.mutate([...selectedIds])}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
                <i className="ti ti-trash text-sm" />
                Eliminar ({selectedIds.size})
              </button>
            )}
            <button onClick={() => setShowAddContact(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm bg-sand-900 dark:bg-night-50 text-white dark:text-night-900 hover:opacity-90 transition-opacity">
              <i className="ti ti-user-plus text-sm" />
              Añadir contacto
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="px-6 py-3 flex items-center gap-6 border-b border-sand-200 dark:border-night-700 bg-sand-50/30 dark:bg-night-800/30 shrink-0">
          {[
            { label: 'Total',        value: stats.total,        color: 'text-sand-900 dark:text-night-50' },
            { label: 'Activos',      value: stats.active,       color: 'text-teal-600 dark:text-teal-400' },
            { label: 'Bajas',        value: stats.unsubscribed, color: 'text-sand-900/40 dark:text-night-50/40' },
            { label: 'Rebotados',    value: stats.bounced,      color: 'text-red-500 dark:text-red-400' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2">
              <span className={cn('font-display text-lg font-bold tabular-nums', s.color)}>{s.value}</span>
              <span className="text-xs text-sand-900/40 dark:text-night-50/40">{s.label}</span>
            </div>
          ))}
          <div className="ml-auto flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-sand-900/30 dark:text-night-50/30 text-sm" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar…"
                className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-sand-200 dark:border-night-600 bg-white dark:bg-night-700 text-sand-900 dark:text-night-50 focus:outline-none focus:ring-2 focus:ring-gold-400/50 w-48"
              />
            </div>
            {/* Status filter */}
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="px-2 py-1.5 text-sm rounded-lg border border-sand-200 dark:border-night-600 bg-white dark:bg-night-700 text-sand-900 dark:text-night-50 focus:outline-none">
              <option value="all">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="unsubscribed">Baja</option>
              <option value="bounced">Rebotados</option>
              <option value="cleaned">Limpiados</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-6 h-6 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <div className="w-12 h-12 rounded-2xl bg-sand-100 dark:bg-night-700 flex items-center justify-center">
                <i className="ti ti-users-off text-xl text-sand-900/20 dark:text-night-50/20" />
              </div>
              <p className="text-sm text-sand-900/40 dark:text-night-50/40">
                {search ? 'No hay resultados' : 'Esta lista no tiene contactos aún'}
              </p>
              {!search && (
                <button onClick={() => setShowAddContact(true)}
                  className="text-xs text-gold-600 dark:text-gold-400 hover:underline">
                  Añadir el primero →
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sand-200 dark:border-night-700 bg-sand-50/50 dark:bg-night-800/50">
                  <th className="w-10 px-4 py-3 text-left">
                    <input type="checkbox" checked={allChecked} onChange={toggleAll}
                      className="rounded border-sand-300 dark:border-night-600 text-gold-500 focus:ring-gold-400/50" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-sand-900/50 dark:text-night-50/50 uppercase tracking-wide">Contacto</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-sand-900/50 dark:text-night-50/50 uppercase tracking-wide hidden md:table-cell">Empresa</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-sand-900/50 dark:text-night-50/50 uppercase tracking-wide hidden lg:table-cell">Lista</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-sand-900/50 dark:text-night-50/50 uppercase tracking-wide">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-sand-900/50 dark:text-night-50/50 uppercase tracking-wide hidden lg:table-cell">Fecha</th>
                  <th className="w-10 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-100 dark:divide-night-700">
                {filtered.map(contact => {
                  const name = fullName(contact)
                  const list = lists.find(l => l.id === contact.list_id)
                  return (
                    <tr key={contact.id}
                      className={cn(
                        'group hover:bg-sand-50/80 dark:hover:bg-night-700/50 transition-colors',
                        selectedIds.has(contact.id) && 'bg-gold-50/30 dark:bg-gold-900/5'
                      )}
                    >
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selectedIds.has(contact.id)} onChange={() => toggleOne(contact.id)}
                          className="rounded border-sand-300 dark:border-night-600 text-gold-500 focus:ring-gold-400/50" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold-300 to-gold-500 flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-bold text-night-900">{initials(contact)}</span>
                          </div>
                          <div className="min-w-0">
                            {name && <p className="text-sm font-medium text-sand-900 dark:text-night-50 truncate">{name}</p>}
                            <p className={cn('text-xs truncate', name ? 'text-sand-900/50 dark:text-night-50/50' : 'text-sand-900 dark:text-night-50')}>
                              {contact.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-sm text-sand-900/60 dark:text-night-50/60">{contact.company ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {list ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: list.color }} />
                            <span className="text-xs text-sand-900/70 dark:text-night-50/70 truncate max-w-[120px]">{list.name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-sand-900/30 dark:text-night-50/30">Sin lista</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize', STATUS_BADGE[contact.status])}>
                          {contact.status === 'active' ? 'Activo'
                            : contact.status === 'unsubscribed' ? 'Baja'
                            : contact.status === 'bounced' ? 'Rebotado'
                            : 'Limpiado'}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-xs text-sand-900/40 dark:text-night-50/40">
                          {new Date(contact.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => {
                            if (confirm(`¿Eliminar ${contact.email}?`)) deleteContacts.mutate([contact.id])
                          }}
                          className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center text-sand-900/30 dark:text-night-50/30 hover:text-red-500 transition-all">
                          <i className="ti ti-trash text-sm" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {showListModal && (
        <ListModal
          list={editList}
          tenantId={tenant.id}
          onClose={() => { setShowListModal(false); setEditList(null) }}
        />
      )}
      {showAddContact && (
        <AddContactModal
          listId={selectedList}
          tenantId={tenant.id}
          onClose={() => setShowAddContact(false)}
        />
      )}
    </div>
  )
}
