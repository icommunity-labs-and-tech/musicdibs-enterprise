import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useCampaignStore, type CampaignDraft } from '@/store/campaignStore'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrency, cn } from '@/lib/utils'
import { useToast } from '@/store/toastStore'

type DraftUpdater = (patch: Partial<CampaignDraft>) => void

const STEPS = [
  { id: 0, label: 'Campaña', icon: 'ti-speakerphone' },
  { id: 1, label: 'Audiencia', icon: 'ti-users' },
  { id: 2, label: 'Plantilla AI', icon: 'ti-sparkles' },
  { id: 3, label: 'Assets', icon: 'ti-wave-sine' },
  { id: 4, label: 'Entrega', icon: 'ti-send' },
  { id: 5, label: 'Lanzar', icon: 'ti-rocket' },
]

const COST_PER_CONTACT = 0.19

export function CampaignBuilder() {
  const navigate = useNavigate()
  const { draft, updateDraft, nextStep, prevStep, resetDraft } = useCampaignStore()
  const { tenant, user } = useAuth()
  const toast = useToast()
  const [launching, setLaunching] = useState(false)
  const [launched, setLaunched] = useState(false)
  const [launchError, setLaunchError] = useState<string | null>(null)
  const [campaignId, setCampaignId] = useState<string | null>(null)

  const step = draft.step
  const totalCost = (draft.totalContacts || 0) * COST_PER_CONTACT

  async function handleLaunch() {
    if (!tenant || !user) return
    setLaunching(true)
    setLaunchError(null)

    try {
      // 1. Insert campaign
      const { data: campaign, error: campErr } = await supabase
        .from('campaigns')
        .insert({
          tenant_id: tenant.id,
          created_by: user.id,
          name: draft.name || 'Nueva campaña',
          type: draft.type || 'seasonal',
          vertical: draft.vertical || 'insurance',
          goal: draft.goal || null,
          status: 'queued',
          contact_list_id: draft.contact_list_id || null,
          total_contacts: draft.totalContacts || 0,
          ai_prompt: draft.aiPrompt || null,
          tone: draft.tone,
          language: draft.language,
          ai_provider: draft.aiProvider,
          music_style: draft.musicStyle || null,
          duration_seconds: draft.duration,
          delivery_channel: draft.deliveryChannel,
          subject: draft.subject || null,
          trigger_type: draft.triggerType || null,
          cost_estimate: totalCost,
        })
        .select()
        .single()

      if (campErr || !campaign) throw new Error(campErr?.message ?? 'Error creando campaña')

      // 2. Insert generation job
      const { error: jobErr } = await supabase.from('generation_jobs').insert({
        campaign_id: campaign.id,
        tenant_id: tenant.id,
        status: 'queued',
        provider: draft.aiProvider,
        prompt: draft.aiPrompt || null,
        style: draft.musicStyle || null,
        duration_seconds: draft.duration,
      })

      if (jobErr) console.warn('Job insert warning:', jobErr.message)

      setCampaignId(campaign.id)
      setLaunched(true)
      toast.success('Campaña lanzada', `"${draft.name || 'Nueva campaña'}" está en cola de generación.`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setLaunchError(msg)
      toast.error('Error al lanzar campaña', msg)
    } finally {
      setLaunching(false)
    }
  }

  if (launched && campaignId) {
    return (
      <LaunchSuccess
        onQueue={() => navigate(`/campaigns/${campaignId}/queue`)}
        onNew={() => { resetDraft(); setLaunched(false); setCampaignId(null) }}
      />
    )
  }

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <button onClick={() => navigate('/campaigns')} className="flex items-center gap-1.5 text-sm text-sand-900/40 dark:text-night-50/40 hover:text-sand-900 dark:hover:text-night-50 transition-colors mb-3">
          <i className="ti ti-arrow-left text-sm" /> Campañas
        </button>
        <h1 className="font-display text-2xl text-sand-900 dark:text-night-50 font-semibold">
          Nueva campaña
        </h1>
      </div>

      {/* Step nav */}
      <div className="flex items-center gap-0 mb-6 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center">
            <button
              onClick={() => step > s.id && updateDraft({ step: s.id })}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-sans font-medium transition-all whitespace-nowrap',
                s.id === step
                  ? 'bg-[#C9973A] text-white shadow-sm'
                  : s.id < step
                  ? 'text-[#8C5E0A] dark:text-[#C9973A] cursor-pointer hover:bg-[#C9973A]/10'
                  : 'text-sand-900/30 dark:text-night-50/30 cursor-default'
              )}
            >
              <i className={cn('ti text-sm', s.icon)} />
              {s.label}
            </button>
            {i < STEPS.length - 1 && (
              <div className={cn(
                'w-6 h-px mx-1 flex-shrink-0',
                i < step ? 'bg-[#C9973A]/40' : 'bg-black/10 dark:bg-white/10'
              )} />
            )}
          </div>
        ))}
      </div>

      {/* Body */}
      <div className="grid grid-cols-[1fr_320px] gap-5">
        {/* Left panel */}
        <div className="bg-white dark:bg-[#1A1510] rounded-xl border border-black/8 dark:border-white/8 shadow-sm p-6 space-y-5">
          {step === 0 && <StepCampaign draft={draft} update={updateDraft} />}
          {step === 1 && <StepAudiencia draft={draft} update={updateDraft} tenantId={tenant?.id ?? ''} />}
          {step === 2 && <StepPlantilla draft={draft} update={updateDraft} />}
          {step === 3 && <StepAssets draft={draft} update={updateDraft} />}
          {step === 4 && <StepEntrega draft={draft} update={updateDraft} />}
          {step === 5 && (
            <StepLanzar
              cost={totalCost}
              launching={launching}
              error={launchError}
              onLaunch={handleLaunch}
            />
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4 border-t border-black/8 dark:border-white/8">
            <button
              onClick={prevStep}
              disabled={step === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-sand-900/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/5 transition-all disabled:opacity-30"
            >
              <i className="ti ti-arrow-left text-sm" /> Anterior
            </button>
            {step < 5 ? (
              <button onClick={nextStep} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#C9973A] text-white font-semibold text-sm hover:bg-[#b8832e] active:scale-95 transition-all duration-150">
                Siguiente <i className="ti ti-arrow-right text-sm" />
              </button>
            ) : null}
          </div>
        </div>

        {/* Right preview */}
        <PreviewCard step={step} cost={totalCost} draft={draft} />
      </div>
    </div>
  )
}

/* ─── Step components ─────────────────────────────────────────────────────── */

function StepCampaign({ draft, update }: { draft: CampaignDraft; update: DraftUpdater }) {
  return (
    <div className="space-y-4">
      <h2 className="font-display text-lg font-semibold text-sand-900 dark:text-night-50">
        Detalles de la campaña
      </h2>
      <div>
        <label className="block text-xs font-sans font-medium text-sand-900/60 dark:text-night-50/60 mb-1.5">
          Nombre de campaña
        </label>
        <input
          className="w-full px-3 py-2 rounded-lg text-sm bg-[#F5EFE6] dark:bg-[#0C0A08] border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-[#C9973A]/30 transition-all"
          value={draft.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="Ej: Feliz Cumpleaños Premium — Asegurados 2026"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-sans font-medium text-sand-900/60 dark:text-night-50/60 mb-1.5">Tipo</label>
          <select className="w-full px-3 py-2 rounded-lg text-sm bg-[#F5EFE6] dark:bg-[#0C0A08] border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-[#C9973A]/30 transition-all" value={draft.type} onChange={(e) => update({ type: e.target.value as typeof draft.type })}>
            <option value="">Seleccionar…</option>
            <option value="birthday">Cumpleaños</option>
            <option value="anniversary">Aniversario</option>
            <option value="winback">Win-back</option>
            <option value="seasonal">Estacional</option>
            <option value="loyalty">Fidelización</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-sans font-medium text-sand-900/60 dark:text-night-50/60 mb-1.5">Vertical</label>
          <select className="w-full px-3 py-2 rounded-lg text-sm bg-[#F5EFE6] dark:bg-[#0C0A08] border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-[#C9973A]/30 transition-all" value={draft.vertical} onChange={(e) => update({ vertical: e.target.value as typeof draft.vertical })}>
            <option value="">Seleccionar…</option>
            <option value="insurance">Seguros</option>
            <option value="telecom">Telecomunicaciones</option>
            <option value="ecommerce">Ecommerce</option>
            <option value="banking">Banca</option>
            <option value="retail">Retail</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-sans font-medium text-sand-900/60 dark:text-night-50/60 mb-1.5">Objetivo</label>
        <select className="w-full px-3 py-2 rounded-lg text-sm bg-[#F5EFE6] dark:bg-[#0C0A08] border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-[#C9973A]/30 transition-all" value={draft.goal} onChange={(e) => update({ goal: e.target.value })}>
          <option value="">Seleccionar…</option>
          <option value="engagement">Engagement emocional</option>
          <option value="retention">Retención</option>
          <option value="upsell">Upsell</option>
          <option value="reactivation">Reactivación</option>
        </select>
      </div>
    </div>
  )
}

interface ContactList {
  id: string
  name: string
  description: string | null
  contact_count: number
  color: string
  mailerlite_group_id: string | null
}

function StepAudiencia({ draft, update, tenantId }: {
  draft: CampaignDraft
  update: DraftUpdater
  tenantId: string
}) {
  const { data: lists = [], isLoading } = useQuery<ContactList[]>({
    queryKey: ['contact_lists', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contact_lists')
        .select('id, name, description, contact_count, color, mailerlite_group_id')
        .eq('tenant_id', tenantId)
        .order('name')
      if (error) throw error
      return data ?? []
    },
    enabled: !!tenantId,
  })

  const selected = lists.find(l => l.id === draft.contact_list_id)

  function selectList(list: ContactList) {
    update({ contact_list_id: list.id, totalContacts: list.contact_count })
  }

  return (
    <div className="space-y-4">
      <h2 className="font-display text-lg font-semibold text-sand-900 dark:text-night-50">Audiencia</h2>
      <p className="text-sm text-sand-900/60 dark:text-night-50/60">
        Selecciona la lista de contactos que recibirá esta campaña.
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-[#C9973A] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : lists.length === 0 ? (
        <div className="text-center py-8 rounded-xl border border-dashed border-black/10 dark:border-white/10">
          <i className="ti ti-users text-2xl text-sand-900/30 dark:text-night-50/30 mb-2 block" />
          <p className="text-sm text-sand-900/50 dark:text-night-50/50">No hay listas de contactos.</p>
          <a href="/contacts" className="mt-2 inline-block text-xs text-[#C9973A] hover:underline">
            Crear lista en Contactos →
          </a>
        </div>
      ) : (
        <div className="space-y-2">
          {lists.map(list => {
            const isSelected = draft.contact_list_id === list.id
            const hasMl = !!list.mailerlite_group_id
            return (
              <button
                key={list.id}
                onClick={() => selectList(list)}
                className={cn(
                  'w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all',
                  isSelected
                    ? 'border-[#C9973A] bg-[#C9973A]/8 dark:bg-[#C9973A]/12'
                    : 'border-black/8 dark:border-white/8 hover:border-[#C9973A]/40 hover:bg-sand-50 dark:hover:bg-night-900/50'
                )}
              >
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: list.color }} />
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium truncate', isSelected ? 'text-[#8C5E0A] dark:text-[#C9973A]' : 'text-sand-900 dark:text-night-50')}>
                    {list.name}
                  </p>
                  {list.description && (
                    <p className="text-xs text-sand-900/40 dark:text-night-50/40 truncate mt-0.5">{list.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {!hasMl && (
                    <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <i className="ti ti-alert-triangle text-xs" /> Sin grupo ML
                    </span>
                  )}
                  <span className="text-sm font-semibold text-sand-900 dark:text-night-50">
                    {list.contact_count.toLocaleString()}
                  </span>
                  <span className="text-xs text-sand-900/40 dark:text-night-50/40">contactos</span>
                  {isSelected && <i className="ti ti-check text-[#C9973A] text-base" />}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {selected && (
        <div className="px-4 py-3 rounded-xl bg-[#C9973A]/8 dark:bg-[#C9973A]/12 border border-[#C9973A]/20 flex items-center justify-between">
          <div>
            <p className="text-xs text-sand-900/50 dark:text-night-50/50">Lista seleccionada</p>
            <p className="text-sm font-semibold text-[#8C5E0A] dark:text-[#C9973A]">{selected.name}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-display font-semibold text-[#8C5E0A] dark:text-[#C9973A]">
              {selected.contact_count.toLocaleString()}
            </p>
            <p className="text-xs text-sand-900/50 dark:text-night-50/50">contactos</p>
          </div>
        </div>
      )}
    </div>
  )
}

function StepPlantilla({ draft, update }: { draft: CampaignDraft; update: DraftUpdater }) {
  const vars = ['{nombre}', '{años_como_cliente}', '{tipo_póliza}', '{ciudad}']
  return (
    <div className="space-y-4">
      <h2 className="font-display text-lg font-semibold text-sand-900 dark:text-night-50">Prompt de generación AI</h2>
      <div>
        <label className="block text-xs font-sans font-medium text-sand-900/60 dark:text-night-50/60 mb-1.5">Prompt</label>
        <textarea
          className="w-full px-3 py-2 rounded-lg text-sm bg-[#F5EFE6] dark:bg-[#0C0A08] border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-[#C9973A]/30 transition-all min-h-[120px] resize-none font-mono text-xs"
          value={draft.aiPrompt}
          onChange={(e) => update({ aiPrompt: e.target.value })}
          placeholder="Crea una canción de cumpleaños emotiva para {nombre}, cliente de {años_como_cliente} años…"
        />
        <div className="flex flex-wrap gap-1.5 mt-2">
          {vars.map((v) => (
            <button key={v} onClick={() => update({ aiPrompt: draft.aiPrompt + v })}
              className="px-2 py-0.5 rounded font-mono text-xs bg-[#C9973A]/10 text-[#8C5E0A] dark:text-[#C9973A] border border-[#C9973A]/20 hover:bg-[#C9973A]/20 transition-colors">
              {v}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-sans font-medium text-sand-900/60 dark:text-night-50/60 mb-1.5">Tono</label>
          <select className="w-full px-3 py-2 rounded-lg text-sm bg-[#F5EFE6] dark:bg-[#0C0A08] border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-[#C9973A]/30 transition-all" value={draft.tone} onChange={(e) => update({ tone: e.target.value })}>
            <option value="warm">Cálido</option>
            <option value="professional">Profesional</option>
            <option value="fun">Divertido</option>
            <option value="emotional">Emotivo</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-sans font-medium text-sand-900/60 dark:text-night-50/60 mb-1.5">Idioma</label>
          <select className="w-full px-3 py-2 rounded-lg text-sm bg-[#F5EFE6] dark:bg-[#0C0A08] border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-[#C9973A]/30 transition-all" value={draft.language} onChange={(e) => update({ language: e.target.value })}>
            <option value="es">Español</option>
            <option value="en">English</option>
            <option value="fr">Français</option>
            <option value="pt">Português</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-sans font-medium text-sand-900/60 dark:text-night-50/60 mb-1.5">Proveedor</label>
          <select className="w-full px-3 py-2 rounded-lg text-sm bg-[#F5EFE6] dark:bg-[#0C0A08] border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-[#C9973A]/30 transition-all" value={draft.aiProvider} onChange={(e) => update({ aiProvider: e.target.value as typeof draft.aiProvider })}>
            <option value="kie.ai">KIE.ai</option>
            <option value="suno">Suno API</option>
          </select>
        </div>
      </div>
    </div>
  )
}

function StepAssets({ draft, update }: { draft: CampaignDraft; update: DraftUpdater }) {
  return (
    <div className="space-y-4">
      <h2 className="font-display text-lg font-semibold text-sand-900 dark:text-night-50">Configuración de assets</h2>
      <div className="grid grid-cols-2 gap-3">
        {['Canción AI', 'Visualizer'].map((asset) => (
          <div key={asset} className="flex items-center gap-3 p-3.5 rounded-xl border-2 border-[#C9973A]/40 bg-[#C9973A]/5 cursor-pointer">
            <i className={cn('ti text-lg text-[#C9973A]', asset === 'Canción AI' ? 'ti-wave-sine' : 'ti-player-play')} />
            <span className="text-sm font-sans font-medium text-sand-900 dark:text-night-50">{asset}</span>
            <i className="ti ti-check ml-auto text-[#C9973A]" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-sans font-medium text-sand-900/60 dark:text-night-50/60 mb-1.5">Estilo musical</label>
          <select className="w-full px-3 py-2 rounded-lg text-sm bg-[#F5EFE6] dark:bg-[#0C0A08] border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-[#C9973A]/30 transition-all" value={draft.musicStyle} onChange={(e) => update({ musicStyle: e.target.value })}>
            <option value="orchestral">Orquestal</option>
            <option value="pop">Pop</option>
            <option value="jazz">Jazz</option>
            <option value="acoustic">Acústico</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-sans font-medium text-sand-900/60 dark:text-night-50/60 mb-1.5">Duración</label>
          <select className="w-full px-3 py-2 rounded-lg text-sm bg-[#F5EFE6] dark:bg-[#0C0A08] border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-[#C9973A]/30 transition-all" value={draft.duration} onChange={(e) => update({ duration: Number(e.target.value) })}>
            <option value={30}>30 seg</option>
            <option value={60}>60 seg</option>
            <option value={90}>90 seg</option>
            <option value={120}>120 seg</option>
          </select>
        </div>
      </div>
      <div className="p-4 rounded-xl bg-sand-50 dark:bg-night-900 border border-black/8 dark:border-white/8">
        <div className="flex items-center justify-between text-sm">
          <span className="text-sand-900/60 dark:text-night-50/60">Coste por cliente</span>
          <span className="font-mono font-semibold text-[#C9973A]">€{COST_PER_CONTACT.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-2">
          <span className="text-sand-900/60 dark:text-night-50/60">Total estimado ({draft.totalContacts.toLocaleString()} clientes)</span>
          <span className="font-mono font-semibold text-sand-900 dark:text-night-50">{formatCurrency(draft.totalContacts * COST_PER_CONTACT)}</span>
        </div>
      </div>
    </div>
  )
}

function StepEntrega({ draft, update }: { draft: CampaignDraft; update: DraftUpdater }) {
  return (
    <div className="space-y-4">
      <h2 className="font-display text-lg font-semibold text-sand-900 dark:text-night-50">Canal de entrega</h2>
      <div className="grid grid-cols-2 gap-3">
        {[
          { id: 'email', icon: 'ti-mail', label: 'Email', sublabel: 'via Mailerlite' },
          { id: 'whatsapp', icon: 'ti-brand-whatsapp', label: 'WhatsApp', sublabel: 'Próximamente' },
        ].map((ch) => (
          <button key={ch.id} disabled={ch.id === 'whatsapp'}
            onClick={() => update({ deliveryChannel: ch.id as typeof draft.deliveryChannel })}
            className={cn(
              'flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all',
              draft.deliveryChannel === ch.id ? 'border-[#C9973A]/60 bg-[#C9973A]/8' : 'border-black/10 dark:border-white/10',
              ch.id === 'whatsapp' && 'opacity-40 cursor-not-allowed'
            )}>
            <i className={cn('ti text-lg', ch.icon, draft.deliveryChannel === ch.id ? 'text-[#C9973A]' : 'text-sand-900/40 dark:text-night-50/40')} />
            <div>
              <p className="text-sm font-sans font-medium text-sand-900 dark:text-night-50">{ch.label}</p>
              <p className="text-xs text-sand-900/40 dark:text-night-50/40">{ch.sublabel}</p>
            </div>
          </button>
        ))}
      </div>
      <div>
        <label className="block text-xs font-sans font-medium text-sand-900/60 dark:text-night-50/60 mb-1.5">Asunto del email</label>
        <input className="w-full px-3 py-2 rounded-lg text-sm bg-[#F5EFE6] dark:bg-[#0C0A08] border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-[#C9973A]/30 transition-all" value={draft.subject} onChange={(e) => update({ subject: e.target.value })} placeholder="🎂 ¡Feliz Cumpleaños, {nombre}!" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-sans font-medium text-sand-900/60 dark:text-night-50/60 mb-1.5">Disparador</label>
          <select className="w-full px-3 py-2 rounded-lg text-sm bg-[#F5EFE6] dark:bg-[#0C0A08] border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-[#C9973A]/30 transition-all" value={draft.triggerType} onChange={(e) => update({ triggerType: e.target.value })}>
            <option value="birthday">Día del cumpleaños</option>
            <option value="day_before">Día antes</option>
            <option value="week_before">Semana antes</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-sans font-medium text-sand-900/60 dark:text-night-50/60 mb-1.5">Hora de envío</label>
          <input type="time" className="w-full px-3 py-2 rounded-lg text-sm bg-[#F5EFE6] dark:bg-[#0C0A08] border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-[#C9973A]/30 transition-all" value={draft.triggerTime} onChange={(e) => update({ triggerTime: e.target.value })} />
        </div>
      </div>
    </div>
  )
}

function StepLanzar({ cost, launching, error, onLaunch }: { cost: number; launching: boolean; error: string | null; onLaunch: () => void }) {
  return (
    <div className="space-y-5">
      <h2 className="font-display text-lg font-semibold text-sand-900 dark:text-night-50">Resumen y lanzamiento</h2>
      <div className="space-y-3">
        {[
          { label: 'Contactos', value: '1,247', icon: 'ti-users' },
          { label: 'Assets a generar', value: '1,247 canciones + visualizers', icon: 'ti-wave-sine' },
          { label: 'Coste total', value: formatCurrency(cost), icon: 'ti-coin-euro' },
          { label: 'Tiempo estimado', value: '~2 horas', icon: 'ti-clock' },
          { label: 'Período de envío', value: 'Junio 2026', icon: 'ti-calendar' },
        ].map(({ label, value, icon }) => (
          <div key={label} className="flex items-center gap-3 py-3 border-b border-black/5 dark:border-white/5">
            <i className={cn('ti text-sm text-sand-900/30 dark:text-night-50/30 w-5 text-center', icon)} />
            <span className="text-sm text-sand-900/60 dark:text-night-50/60 flex-1">{label}</span>
            <span className="text-sm font-sans font-semibold text-sand-900 dark:text-night-50">{value}</span>
          </div>
        ))}
      </div>
      {error && (
        <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      <button onClick={onLaunch} disabled={launching}
        className={cn(
          'w-full py-3 rounded-xl font-sans font-semibold text-sm flex items-center justify-center gap-2 transition-all',
          launching
            ? 'bg-[#C9973A]/50 text-white cursor-not-allowed'
            : 'bg-gradient-to-r from-[#C9973A] to-[#8C5E0A] text-white hover:opacity-90 shadow-lg shadow-[#C9973A]/20'
        )}>
        {launching ? (
          <><i className="ti ti-loader-2 animate-spin" /> Lanzando campaña…</>
        ) : (
          <><i className="ti ti-rocket" /> Lanzar campaña</>
        )}
      </button>
    </div>
  )
}

function PreviewCard({ step, cost, draft }: { step: number; cost: number; draft: CampaignDraft }) {
  return (
    <div className="bg-white dark:bg-[#1A1510] rounded-xl border border-black/8 dark:border-white/8 shadow-sm p-5 space-y-4 h-fit sticky top-6">
      <p className="text-xs font-sans font-medium text-sand-900/40 dark:text-night-50/40 uppercase tracking-widest">Vista previa</p>
      <div>
        <p className="font-display text-base font-semibold text-sand-900 dark:text-night-50 leading-snug">
          {draft.name || 'Sin nombre'}
        </p>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {draft.type && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#C9973A]/15 text-[#8C5E0A] dark:text-[#C9973A] capitalize">{draft.type}</span>}
          {draft.vertical && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#2BB5A0]/15 text-[#0D7A64] dark:text-[#2BB5A0] capitalize">{draft.vertical}</span>}
        </div>
      </div>
      {step >= 1 && (
        <div className="py-3 px-4 rounded-xl bg-sand-50 dark:bg-night-900">
          <div className="flex items-center gap-2">
            <i className="ti ti-users text-sm text-[#C9973A]" />
            <span className="text-sm font-mono font-semibold text-sand-900 dark:text-night-50">1,247</span>
            <span className="text-xs text-sand-900/50 dark:text-night-50/50">contactos</span>
          </div>
        </div>
      )}
      {step >= 2 && draft.tone && (
        <div className="flex items-center gap-2 text-sm">
          <i className="ti ti-sparkles text-[#C9973A] text-sm" />
          <span className="text-sand-900/60 dark:text-night-50/60">Tono:</span>
          <span className="font-sans font-medium text-sand-900 dark:text-night-50 capitalize">{draft.tone}</span>
        </div>
      )}
      {step >= 3 && <Waveform />}
      {step >= 4 && (
        <div className="flex items-center gap-2 text-sm">
          <i className="ti ti-mail text-[#2BB5A0] text-sm" />
          <span className="text-sand-900/60 dark:text-night-50/60">Email · 09:00 CET</span>
        </div>
      )}
      {step >= 5 && (
        <div className="pt-3 border-t border-black/8 dark:border-white/8">
          <div className="flex items-center justify-between text-sm">
            <span className="text-sand-900/60 dark:text-night-50/60">Coste total</span>
            <span className="font-mono font-bold text-[#C9973A]">{formatCurrency(cost)}</span>
          </div>
          <p className="text-xs text-sand-900/40 dark:text-night-50/40 mt-1">€{COST_PER_CONTACT.toFixed(2)} × 1,247</p>
        </div>
      )}
    </div>
  )
}

function Waveform() {
  const heights = [8, 14, 22, 18, 12, 28, 20, 16, 24, 10, 18, 26, 14, 20, 8]
  return (
    <div className="flex items-center justify-center gap-1 h-10">
      {heights.map((h, i) => (
        <span key={i} className="w-1 rounded-full bg-[#C9973A] wave-bar"
          style={{ '--mh': `${h}px`, '--delay': `${i * 80}ms` } as React.CSSProperties} />
      ))}
    </div>
  )
}

function LaunchSuccess({ onQueue, onNew }: { onQueue: () => void; onNew: () => void }) {
  return (
    <div className="max-w-lg mx-auto mt-20 text-center animate-slide-up">
      <div className="w-16 h-16 rounded-2xl bg-[#2BB5A0]/15 flex items-center justify-center mx-auto mb-5">
        <i className="ti ti-check text-3xl text-[#2BB5A0]" />
      </div>
      <h2 className="font-display text-2xl font-semibold text-sand-900 dark:text-night-50 mb-2">¡Campaña lanzada!</h2>
      <p className="text-sand-900/60 dark:text-night-50/60 text-sm mb-8">
        1,247 assets comenzando a generarse · ~2h estimadas
      </p>
      <div className="flex flex-col gap-3">
        <button onClick={onQueue} className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-[#C9973A] text-white font-semibold text-sm hover:bg-[#b8832e] transition-all">
          <i className="ti ti-list-check" /> Ver cola de generación
        </button>
        <button onClick={onNew} className="inline-flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg text-sm font-medium text-sand-900/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/5 transition-all">
          Crear otra campaña
        </button>
      </div>
    </div>
  )
}

