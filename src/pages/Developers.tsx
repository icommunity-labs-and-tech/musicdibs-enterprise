import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/store/toastStore'
import { cn } from '@/lib/utils'

// ── types ─────────────────────────────────────────────────────────────────────
interface ApiKey {
  id: string
  name: string
  key_prefix: string
  last_used_at: string | null
  created_at: string
  revoked_at: string | null
}

interface Webhook {
  id: string
  name: string
  url: string
  events: string[]
  active: boolean
  created_at: string
}

interface WebhookDelivery {
  id: string
  event: string
  success: boolean
  status_code: number | null
  duration_ms: number | null
  delivered_at: string
}

const ALL_EVENTS = [
  { key: 'campaign.created', label: 'campaign.created', desc: 'Nueva campaña creada via API' },
  { key: 'campaign.sent',    label: 'campaign.sent',    desc: 'Campaña enviada a Mailerlite' },
  { key: 'campaign.failed',  label: 'campaign.failed',  desc: 'Error al enviar campaña' },
  { key: 'stats.updated',    label: 'stats.updated',    desc: 'Stats de campaña actualizados' },
]

// ── code snippets ─────────────────────────────────────────────────────────────
function getSnippets(prefix: string) {
  const key = prefix ? `${prefix}xxxx_your_full_key` : 'sk_live_your_api_key'
  return {
    install: `npm install @musicdibs/enterprise-sdk`,
    quickstart: `import MusicDibsClient from '@musicdibs/enterprise-sdk'

const client = new MusicDibsClient({ apiKey: '${key}' })

// Crear campaña
const campaign = await client.campaigns.create({
  name: 'Renovación póliza Q4',
  subject: 'Tu renovación está lista',
  vertical: 'insurance',
  language: 'es',
  tone: 'professional',
  total_contacts: 1500,
})

console.log(campaign.id) // uuid`,
    list: `const { data, meta } = await client.campaigns.list({
  status: 'sent',
  page: 1,
  limit: 20,
})
// meta.total → total de campañas`,
    send: `// La campaña debe estar en status 'ready' (generación completada)
const result = await client.campaigns.send(campaign.id)
// { success: true, mailerlite_campaign_id: '...' }`,
    stats: `const stats = await client.campaigns.stats(campaign.id)
const openRate = stats.emails_opened / stats.emails_sent
console.log(\`Open rate: \${(openRate * 100).toFixed(1)}%\`)`,
    curl: `curl https://asolssebjyjyfbggraew.supabase.co/functions/v1/api/campaigns \\
  -H "X-API-Key: ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Mi campaña","total_contacts":500}'`,
  }
}

const ENDPOINTS = [
  { method: 'GET',   path: '/campaigns',          desc: 'Listar campañas. Params: page, limit, status' },
  { method: 'POST',  path: '/campaigns',          desc: 'Crear campaña (status: draft)' },
  { method: 'GET',   path: '/campaigns/:id',      desc: 'Obtener campaña + stats' },
  { method: 'PATCH', path: '/campaigns/:id',      desc: 'Actualizar campaña (solo draft)' },
  { method: 'POST',  path: '/campaigns/:id/send', desc: 'Enviar campaña (requiere status: ready)' },
  { method: 'GET',   path: '/campaigns/:id/stats','desc': 'Stats de una campaña enviada' },
]

const METHOD_COLORS: Record<string, string> = {
  GET:   'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  POST:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  PATCH: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
}

// ── component ─────────────────────────────────────────────────────────────────
export function Developers() {
  const { tenant, user } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const [newKeyName, setNewKeyName] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [freshKey, setFreshKey] = useState<string | null>(null)
  const [activeSnippet, setActiveSnippet] = useState<keyof ReturnType<typeof getSnippets>>('quickstart')
  const [copied, setCopied] = useState(false)

  // webhook state
  const [showWebhookForm, setShowWebhookForm] = useState(false)
  const [wbName, setWbName] = useState('')
  const [wbUrl, setWbUrl] = useState('')
  const [wbEvents, setWbEvents] = useState<string[]>(['campaign.sent'])
  const [wbFreshSecret, setWbFreshSecret] = useState<string | null>(null)
  const [selectedWebhook, setSelectedWebhook] = useState<string | null>(null)

  // ── API keys query (via EF) ─────────────────────────────────────────────
  const { data: keys = [] } = useQuery<ApiKey[]>({
    queryKey: ['api_keys', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('manage-api-keys', {
        body: { action: 'list' },
      })
      if (error) throw error
      return (data?.keys ?? []).filter((k: ApiKey) => !k.revoked_at)
    },
    enabled: !!tenant,
  })

  // ── webhooks query ─────────────────────────────────────────────────────
  const { data: webhooks = [] } = useQuery<Webhook[]>({
    queryKey: ['webhooks', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_webhooks')
        .select('id, name, url, events, active, created_at')
        .eq('tenant_id', tenant!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!tenant,
  })

  // ── deliveries query ────────────────────────────────────────────────────
  const { data: deliveries = [] } = useQuery<WebhookDelivery[]>({
    queryKey: ['webhook_deliveries', selectedWebhook],
    queryFn: async () => {
      if (!selectedWebhook) return []
      const { data, error } = await supabase
        .from('webhook_deliveries')
        .select('id, event, success, status_code, duration_ms, delivered_at')
        .eq('webhook_id', selectedWebhook)
        .order('delivered_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return data ?? []
    },
    enabled: !!selectedWebhook,
    refetchInterval: 10_000,
  })

  // ── create webhook ──────────────────────────────────────────────────────
  const createWebhook = useMutation({
    mutationFn: async () => {
      if (!wbUrl || !wbName) throw new Error('Nombre y URL son obligatorios')
      const secret = 'whsec_' + Array.from(
        crypto.getRandomValues(new Uint8Array(24))
      ).map(b => b.toString(36)).join('').slice(0, 32)

      const { error } = await supabase.from('tenant_webhooks').insert({
        tenant_id: tenant!.id,
        name: wbName,
        url: wbUrl,
        secret,
        events: wbEvents,
        created_by: user!.id,
      })
      if (error) throw error
      return secret
    },
    onSuccess: (secret) => {
      setWbFreshSecret(secret)
      setShowWebhookForm(false)
      setWbName(''); setWbUrl(''); setWbEvents(['campaign.sent'])
      qc.invalidateQueries({ queryKey: ['webhooks'] })
      toast.success('Webhook creado', 'Copia el secret ahora — no se mostrará de nuevo.')
    },
    onError: (err: any) => toast.error('Error creando webhook', err.message),
  })

  // ── toggle webhook active ───────────────────────────────────────────────
  const toggleWebhook = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('tenant_webhooks').update({ active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
    onError: (err: any) => toast.error('Error', err.message),
  })

  // ── delete webhook ──────────────────────────────────────────────────────
  const deleteWebhook = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tenant_webhooks').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks'] })
      if (selectedWebhook) setSelectedWebhook(null)
      toast.success('Webhook eliminado')
    },
    onError: (err: any) => toast.error('Error', err.message),
  })

  // ── generate API key (via EF — enforces limit, audit log, mdb_live_ prefix) ─
  const generateKey = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.functions.invoke('manage-api-keys', {
        body: { action: 'create', name: name || 'API Key' },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return data.raw_key as string
    },
    onSuccess: (raw) => {
      setFreshKey(raw)
      setShowCreate(false)
      setNewKeyName('')
      qc.invalidateQueries({ queryKey: ['api_keys'] })
      toast.success('API key generada', 'Cópiala ahora — no se mostrará de nuevo.')
    },
    onError: (err: any) => toast.error('Error generando key', err.message),
  })

  // ── revoke API key (via EF — audit log) ────────────────────────────────
  const revokeKey = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke('manage-api-keys', {
        body: { action: 'revoke', key_id: id },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['api_keys'] })
      toast.success('API key revocada')
    },
    onError: (err: any) => toast.error('Error', err.message),
  })

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const snippets = getSnippets(keys[0]?.key_prefix ?? '')
  const baseUrl = 'https://asolssebjyjyfbggraew.supabase.co/functions/v1/api'

  return (
    <div className="space-y-6 max-w-5xl">
      {/* header */}
      <div>
        <h1 className="font-display text-2xl font-semibold text-sand-900 dark:text-night-50">
          Developers
        </h1>
        <p className="text-sm text-sand-900/50 dark:text-night-50/50 mt-1">
          Integra MusicDibs Enterprise en tu CRM o plataforma mediante la REST API o el SDK oficial.
        </p>
      </div>

      {/* fresh key banner */}
      {freshKey && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700">
          <div className="flex items-start gap-3">
            <i className="ti ti-key text-emerald-500 text-xl flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-emerald-800 dark:text-emerald-300 text-sm mb-1">
                API key generada — cópiala ahora
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-400 mb-2">
                Esta es la única vez que se muestra la clave completa.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-xs bg-white dark:bg-black/20 px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-700 truncate">
                  {freshKey}
                </code>
                <button
                  onClick={() => copyText(freshKey)}
                  className="flex-shrink-0 px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium transition-colors flex items-center gap-1.5"
                >
                  <i className={cn('text-sm', copied ? 'ti ti-check' : 'ti ti-copy')} />
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>
            <button onClick={() => setFreshKey(null)} className="text-emerald-400 hover:text-emerald-600 flex-shrink-0">
              <i className="ti ti-x text-base" />
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── API Keys ─────────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-[#1A1510] rounded-2xl border border-black/6 dark:border-white/6 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-sand-900 dark:text-night-50 text-sm">API Keys</h2>
              <p className="text-xs text-sand-900/50 dark:text-night-50/50">Autenticación por cabecera <code className="font-mono">X-API-Key</code></p>
            </div>
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C9973A] hover:bg-[#b8832e] text-white text-xs font-semibold transition-colors"
            >
              <i className="ti ti-plus text-sm" />
              Nueva key
            </button>
          </div>

          {/* create form */}
          {showCreate && (
            <div className="flex gap-2 mb-4 p-3 rounded-xl bg-[#F5EFE6] dark:bg-[#0C0A08] border border-black/8 dark:border-white/8">
              <input
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="Nombre (ej: Producción CRM)"
                className="flex-1 px-3 py-1.5 rounded-lg text-sm bg-white dark:bg-[#1A1510] border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-[#C9973A]/30"
                onKeyDown={(e) => e.key === 'Enter' && generateKey.mutate(newKeyName)}
              />
              <button
                onClick={() => generateKey.mutate(newKeyName)}
                disabled={generateKey.isPending}
                className="px-3 py-1.5 rounded-lg bg-[#C9973A] text-white text-xs font-semibold hover:bg-[#b8832e] disabled:opacity-60 transition-colors flex items-center gap-1"
              >
                {generateKey.isPending ? <i className="ti ti-loader-2 animate-spin text-sm" /> : null}
                Generar
              </button>
            </div>
          )}

          {/* keys list */}
          {keys.length === 0 ? (
            <div className="text-center py-8 text-sand-900/30 dark:text-night-50/30">
              <i className="ti ti-key text-3xl block mb-2" />
              <p className="text-sm">Sin API keys. Genera una para empezar.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {keys.map((k) => (
                <div key={k.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#F5EFE6] dark:bg-[#0C0A08] border border-black/6 dark:border-white/6">
                  <i className="ti ti-key text-[#C9973A] text-base flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-sand-900 dark:text-night-50 truncate">{k.name}</p>
                    <p className="text-xs font-mono text-sand-900/40 dark:text-night-50/40">{k.key_prefix}…</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {k.last_used_at ? (
                      <p className="text-[10px] text-sand-900/40 dark:text-night-50/40">
                        Último uso {format(new Date(k.last_used_at), 'dd MMM', { locale: es })}
                      </p>
                    ) : (
                      <p className="text-[10px] text-sand-900/30 dark:text-night-50/30">Nunca usada</p>
                    )}
                    <p className="text-[10px] text-sand-900/30 dark:text-night-50/30">
                      {format(new Date(k.created_at), 'dd MMM yy', { locale: es })}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm(`¿Revocar la key "${k.name}"? Esta acción no se puede deshacer.`)) {
                        revokeKey.mutate(k.id)
                      }
                    }}
                    title="Revocar"
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-sand-900/30 hover:text-red-500 transition-colors"
                  >
                    <i className="ti ti-trash text-sm" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Endpoint reference ───────────────────────────────────────── */}
        <div className="bg-white dark:bg-[#1A1510] rounded-2xl border border-black/6 dark:border-white/6 p-5">
          <h2 className="font-semibold text-sand-900 dark:text-night-50 text-sm mb-1">REST API</h2>
          <p className="text-xs text-sand-900/50 dark:text-night-50/50 mb-4 font-mono break-all">{baseUrl}/</p>
          <div className="space-y-2">
            {ENDPOINTS.map((ep) => (
              <div key={ep.method + ep.path} className="flex items-start gap-2.5 py-2 border-b border-black/4 dark:border-white/4 last:border-0">
                <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5', METHOD_COLORS[ep.method] ?? '')}>
                  {ep.method}
                </span>
                <div className="min-w-0">
                  <code className="text-xs font-mono text-sand-900 dark:text-night-50">{ep.path}</code>
                  <p className="text-xs text-sand-900/50 dark:text-night-50/50 mt-0.5">{ep.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Webhook secret banner ──────────────────────────────────────────── */}
      {wbFreshSecret && (
        <div className="p-4 rounded-2xl bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700">
          <div className="flex items-start gap-3">
            <i className="ti ti-webhook text-violet-500 text-xl flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-violet-800 dark:text-violet-300 text-sm mb-1">
                Webhook secret — cópialo ahora
              </p>
              <p className="text-xs text-violet-600 dark:text-violet-400 mb-2">
                Úsalo para verificar la firma <code className="font-mono">X-MusicDibs-Signature</code> de los eventos.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-xs bg-white dark:bg-black/20 px-3 py-2 rounded-lg border border-violet-200 dark:border-violet-700 truncate">
                  {wbFreshSecret}
                </code>
                <button onClick={() => copyText(wbFreshSecret)} className="flex-shrink-0 px-3 py-2 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-xs font-medium transition-colors flex items-center gap-1.5">
                  <i className={cn('text-sm', copied ? 'ti ti-check' : 'ti ti-copy')} />
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>
            <button onClick={() => setWbFreshSecret(null)} className="text-violet-400 hover:text-violet-600 flex-shrink-0"><i className="ti ti-x text-base" /></button>
          </div>
        </div>
      )}

      {/* ── Webhooks section ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Webhook endpoints */}
        <div className="bg-white dark:bg-[#1A1510] rounded-2xl border border-black/6 dark:border-white/6 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-sand-900 dark:text-night-50 text-sm">Webhooks salientes</h2>
              <p className="text-xs text-sand-900/50 dark:text-night-50/50">Recibe eventos en tu infraestructura en tiempo real</p>
            </div>
            <button onClick={() => setShowWebhookForm(!showWebhookForm)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-xs font-semibold transition-colors">
              <i className="ti ti-plus text-sm" /> Añadir
            </button>
          </div>

          {/* create form */}
          {showWebhookForm && (
            <div className="mb-4 p-3 rounded-xl bg-[#F5EFE6] dark:bg-[#0C0A08] border border-black/8 dark:border-white/8 space-y-2">
              <input value={wbName} onChange={e => setWbName(e.target.value)} placeholder="Nombre (ej: CRM Producción)"
                className="w-full px-3 py-1.5 rounded-lg text-sm bg-white dark:bg-[#1A1510] border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-violet-400/30" />
              <input value={wbUrl} onChange={e => setWbUrl(e.target.value)} placeholder="https://tu-crm.com/webhooks/musicdibs" type="url"
                className="w-full px-3 py-1.5 rounded-lg text-sm bg-white dark:bg-[#1A1510] border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-violet-400/30" />
              <div>
                <p className="text-xs text-sand-900/50 dark:text-night-50/50 mb-1.5">Eventos</p>
                <div className="grid grid-cols-2 gap-1">
                  {ALL_EVENTS.map(ev => (
                    <label key={ev.key} className="flex items-center gap-2 cursor-pointer group">
                      <input type="checkbox" checked={wbEvents.includes(ev.key)}
                        onChange={e => setWbEvents(e.target.checked ? [...wbEvents, ev.key] : wbEvents.filter(x => x !== ev.key))}
                        className="w-3.5 h-3.5 accent-violet-500" />
                      <code className="text-[11px] font-mono text-sand-900/70 dark:text-night-50/70 group-hover:text-sand-900 dark:group-hover:text-night-50">{ev.key}</code>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button onClick={() => setShowWebhookForm(false)} className="px-3 py-1.5 rounded-lg text-xs border border-black/10 dark:border-white/10 hover:bg-black/4 dark:hover:bg-white/4 transition-colors">Cancelar</button>
                <button onClick={() => createWebhook.mutate()} disabled={createWebhook.isPending || !wbUrl || !wbName}
                  className="px-3 py-1.5 rounded-lg bg-violet-500 text-white text-xs font-semibold hover:bg-violet-600 disabled:opacity-60 transition-colors flex items-center gap-1">
                  {createWebhook.isPending && <i className="ti ti-loader-2 animate-spin text-xs" />}
                  Crear webhook
                </button>
              </div>
            </div>
          )}

          {/* list */}
          {webhooks.length === 0 ? (
            <div className="text-center py-8 text-sand-900/30 dark:text-night-50/30">
              <i className="ti ti-webhook text-3xl block mb-2" />
              <p className="text-sm">Sin webhooks configurados.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {webhooks.map(wh => (
                <div key={wh.id}
                  className={cn('p-3 rounded-xl border cursor-pointer transition-all', selectedWebhook === wh.id ? 'border-violet-400 bg-violet-50 dark:bg-violet-900/10' : 'border-black/6 dark:border-white/6 hover:border-black/15 dark:hover:border-white/15')}
                  onClick={() => setSelectedWebhook(selectedWebhook === wh.id ? null : wh.id)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-sand-900 dark:text-night-50 truncate">{wh.name}</p>
                        <span className={cn('w-2 h-2 rounded-full flex-shrink-0', wh.active ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600')} />
                      </div>
                      <p className="text-xs text-sand-900/40 dark:text-night-50/40 truncate font-mono">{wh.url}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {wh.events.map(ev => (
                          <code key={ev} className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400">{ev}</code>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={e => { e.stopPropagation(); toggleWebhook.mutate({ id: wh.id, active: !wh.active }) }}
                        title={wh.active ? 'Desactivar' : 'Activar'}
                        className="p-1.5 rounded-lg hover:bg-black/6 dark:hover:bg-white/6 text-sand-900/40 dark:text-night-50/40 hover:text-sand-900 dark:hover:text-night-50 transition-colors">
                        <i className={cn('text-sm', wh.active ? 'ti ti-player-pause' : 'ti ti-player-play')} />
                      </button>
                      <button onClick={e => { e.stopPropagation(); if (confirm('¿Eliminar este webhook?')) deleteWebhook.mutate(wh.id) }}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-sand-900/30 hover:text-red-500 transition-colors">
                        <i className="ti ti-trash text-sm" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Delivery log */}
        <div className="bg-white dark:bg-[#1A1510] rounded-2xl border border-black/6 dark:border-white/6 p-5">
          <h2 className="font-semibold text-sand-900 dark:text-night-50 text-sm mb-1">Log de entregas</h2>
          <p className="text-xs text-sand-900/50 dark:text-night-50/50 mb-4">
            {selectedWebhook ? 'Últimas 20 llamadas del webhook seleccionado' : 'Selecciona un webhook para ver sus entregas'}
          </p>
          {!selectedWebhook ? (
            <div className="text-center py-8 text-sand-900/20 dark:text-night-50/20">
              <i className="ti ti-list-check text-3xl block mb-2" />
              <p className="text-sm">Sin webhook seleccionado</p>
            </div>
          ) : deliveries.length === 0 ? (
            <div className="text-center py-8 text-sand-900/30 dark:text-night-50/30">
              <i className="ti ti-clock text-3xl block mb-2" />
              <p className="text-sm">Sin entregas aún</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {deliveries.map(d => (
                <div key={d.id} className="flex items-center gap-2.5 py-2 px-3 rounded-lg hover:bg-black/3 dark:hover:bg-white/3">
                  <i className={cn('text-base flex-shrink-0', d.success ? 'ti ti-circle-check text-emerald-500' : 'ti ti-alert-circle text-red-400')} />
                  <div className="flex-1 min-w-0">
                    <code className="text-xs font-mono text-sand-900/70 dark:text-night-50/70">{d.event}</code>
                    <p className="text-[11px] text-sand-900/40 dark:text-night-50/40">
                      {format(new Date(d.delivered_at), 'dd MMM HH:mm:ss', { locale: es })}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={cn('text-xs font-mono', d.success ? 'text-emerald-500' : 'text-red-400')}>
                      {d.status_code ?? '—'}
                    </span>
                    <p className="text-[11px] text-sand-900/30 dark:text-night-50/30">{d.duration_ms}ms</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Webhook verification snippet */}
      <div className="bg-white dark:bg-[#1A1510] rounded-2xl border border-black/6 dark:border-white/6 p-5">
        <h2 className="font-semibold text-sand-900 dark:text-night-50 text-sm mb-1">Verificar firma del webhook</h2>
        <p className="text-xs text-sand-900/50 dark:text-night-50/50 mb-3">Verifica que el evento viene de MusicDibs antes de procesarlo.</p>
        <pre className="text-xs font-mono text-sand-900/80 dark:text-night-50/80 bg-[#F5EFE6]/50 dark:bg-[#0C0A08]/50 p-4 rounded-xl overflow-x-auto leading-relaxed">{`import { createHmac } from 'crypto'

function verifyWebhookSignature(
  payload: string,      // raw request body (string)
  signature: string,    // X-MusicDibs-Signature header value
  secret: string,       // your webhook secret (whsec_...)
): boolean {
  const expected = 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex')
  return expected === signature
}

// Express example
app.post('/webhooks/musicdibs', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['x-musicdibs-signature'] as string
  if (!verifyWebhookSignature(req.body.toString(), sig, process.env.WEBHOOK_SECRET!)) {
    return res.status(401).send('Invalid signature')
  }
  const event = JSON.parse(req.body)
  console.log('Event:', event.event, event.data)
  res.status(200).send('OK')
})`}</pre>
      </div>

      {/* ── Code snippets ─────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#1A1510] rounded-2xl border border-black/6 dark:border-white/6 overflow-hidden">
        {/* tabs */}
        <div className="flex items-center gap-0 border-b border-black/6 dark:border-white/6 overflow-x-auto">
          {([
            { key: 'install',    label: 'Instalación' },
            { key: 'quickstart', label: 'Quick start' },
            { key: 'list',       label: 'Listar' },
            { key: 'send',       label: 'Enviar' },
            { key: 'stats',      label: 'Stats' },
            { key: 'curl',       label: 'cURL' },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveSnippet(tab.key)}
              className={cn(
                'px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors',
                activeSnippet === tab.key
                  ? 'border-[#C9973A] text-[#C9973A]'
                  : 'border-transparent text-sand-900/50 dark:text-night-50/50 hover:text-sand-900 dark:hover:text-night-50'
              )}
            >
              {tab.label}
            </button>
          ))}
          <button
            onClick={() => copyText(snippets[activeSnippet])}
            className="ml-auto mr-3 flex items-center gap-1.5 px-3 py-1.5 my-1.5 rounded-lg text-xs font-medium text-sand-900/50 dark:text-night-50/50 hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex-shrink-0"
          >
            <i className={cn('text-sm', copied ? 'ti ti-check text-emerald-500' : 'ti ti-copy')} />
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>

        {/* code */}
        <pre className="p-5 text-xs font-mono text-sand-900/80 dark:text-night-50/80 overflow-x-auto leading-relaxed bg-[#F5EFE6]/50 dark:bg-[#0C0A08]/50">
          <code>{snippets[activeSnippet]}</code>
        </pre>
      </div>
    </div>
  )
}
