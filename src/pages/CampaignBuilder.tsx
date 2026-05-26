import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCampaignStore, type CampaignDraft } from '@/store/campaignStore'
import { formatCurrency, cn } from '@/lib/utils'

type DraftUpdater = (patch: Partial<CampaignDraft>) => void

const STEPS = [
  { id: 0, label: 'Campaña', icon: 'ti-speakerphone' },
  { id: 1, label: 'Audiencia', icon: 'ti-users' },
  { id: 2, label: 'Plantilla AI', icon: 'ti-sparkles' },
  { id: 3, label: 'Assets', icon: 'ti-wave-sine' },
  { id: 4, label: 'Entrega', icon: 'ti-send' },
  { id: 5, label: 'Lanzar', icon: 'ti-rocket' },
]

const SAMPLE_CONTACTS = [
  { name: 'María García', birthday: '3 Jun', policy: 'Vida Premium', years: 8 },
  { name: 'Carlos López', birthday: '8 Jun', policy: 'Hogar Plus', years: 3 },
  { name: 'Ana Martínez', birthday: '11 Jun', policy: 'Vida Premium', years: 12 },
  { name: 'Pedro Sánchez', birthday: '15 Jun', policy: 'Auto', years: 5 },
  { name: 'Laura Fernández', birthday: '19 Jun', policy: 'Salud', years: 1 },
]

export function CampaignBuilder() {
  const navigate = useNavigate()
  const { draft, updateDraft, nextStep, prevStep, resetDraft } = useCampaignStore()
  const [launching, setLaunching] = useState(false)
  const [launched, setLaunched] = useState(false)

  const step = draft.step
  const totalCost = 1247 * 0.19

  function handleLaunch() {
    setLaunching(true)
    setTimeout(() => {
      setLaunching(false)
      setLaunched(true)
    }, 1800)
  }

  if (launched) {
    return <LaunchSuccess onQueue={() => navigate('/campaigns/c1/queue')} onNew={() => { resetDraft(); setLaunched(false) }} />
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
          {step === 1 && <StepAudiencia contacts={SAMPLE_CONTACTS} />}
          {step === 2 && <StepPlantilla draft={draft} update={updateDraft} />}
          {step === 3 && <StepAssets draft={draft} update={updateDraft} />}
          {step === 4 && <StepEntrega draft={draft} update={updateDraft} />}
          {step === 5 && <StepLanzar cost={totalCost} launching={launching} onLaunch={handleLaunch} />}

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
          <label className="block text-xs font-sans font-medium text-sand-900/60 dark:text-night-50/60 mb-1.5">
            Tipo
          </label>
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
          <label className="block text-xs font-sans font-medium text-sand-900/60 dark:text-night-50/60 mb-1.5">
            Vertical
          </label>
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
        <label className="block text-xs font-sans font-medium text-sand-900/60 dark:text-night-50/60 mb-1.5">
          Objetivo
        </label>
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

function StepAudiencia({ contacts }: { contacts: typeof SAMPLE_CONTACTS }) {
  return (
    <div className="space-y-4">
      <h2 className="font-display text-lg font-semibold text-sand-900 dark:text-night-50">
        Audiencia
      </h2>
      <div className="flex items-center gap-3 p-4 rounded-xl bg-sand-50 dark:bg-night-900 border border-black/8 dark:border-white/8">
        <div className="w-10 h-10 rounded-xl bg-[#2BB5A0]/15 flex items-center justify-center">
          <i className="ti ti-database text-[#0D7A64] dark:text-[#2BB5A0] text-lg" />
        </div>
        <div>
          <p className="text-sm font-sans font-semibold text-sand-900 dark:text-night-50">Salesforce CRM</p>
          <p className="text-xs text-sand-900/50 dark:text-night-50/50">Conectado · Sincronizado hace 2h</p>
        </div>
        <span className="ml-auto badge-teal">Activo</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 px-4 py-3 rounded-xl bg-[#C9973A]/8 dark:bg-[#C9973A]/12 border border-[#C9973A]/20">
          <p className="text-2xl font-display font-semibold text-[#8C5E0A] dark:text-[#C9973A]">1,247</p>
          <p className="text-xs text-sand-900/50 dark:text-night-50/50 mt-0.5">Contactos con cumpleaños en junio</p>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-black/8 dark:border-white/8">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-sand-50 dark:bg-night-900">
              <th className="px-4 py-2.5 text-left text-xs font-sans font-medium text-sand-900/40 dark:text-night-50/40">Nombre</th>
              <th className="px-4 py-2.5 text-left text-xs font-sans font-medium text-sand-900/40 dark:text-night-50/40">Cumpleaños</th>
              <th className="px-4 py-2.5 text-left text-xs font-sans font-medium text-sand-900/40 dark:text-night-50/40">Póliza</th>
              <th className="px-4 py-2.5 text-left text-xs font-sans font-medium text-sand-900/40 dark:text-night-50/40">Años</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 dark:divide-white/5">
            {contacts.map((c) => (
              <tr key={c.name}>
                <td className="px-4 py-2.5 font-sans font-medium text-sand-900 dark:text-night-50">{c.name}</td>
                <td className="px-4 py-2.5 text-sand-900/60 dark:text-night-50/60">{c.birthday}</td>
                <td className="px-4 py-2.5 text-sand-900/60 dark:text-night-50/60">{c.policy}</td>
                <td className="px-4 py-2.5 text-sand-900/60 dark:text-night-50/60">{c.years}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={4} className="px-4 py-2.5 text-xs text-sand-900/30 dark:text-night-50/30 text-center">
                + 1,242 más…
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StepPlantilla({ draft, update }: { draft: CampaignDraft; update: DraftUpdater }) {
  const vars = ['{nombre}', '{años_como_cliente}', '{tipo_póliza}', '{ciudad}']
  return (
    <div className="space-y-4">
      <h2 className="font-display text-lg font-semibold text-sand-900 dark:text-night-50">
        Prompt de generación AI
      </h2>
      <div>
        <label className="block text-xs font-sans font-medium text-sand-900/60 dark:text-night-50/60 mb-1.5">
          Prompt
        </label>
        <textarea
          className="w-full px-3 py-2 rounded-lg text-sm bg-[#F5EFE6] dark:bg-[#0C0A08] border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-[#C9973A]/30 transition-all min-h-[120px] resize-none font-mono text-xs"
          value={draft.aiPrompt}
          onChange={(e) => update({ aiPrompt: e.target.value })}
          placeholder="Crea una canción de cumpleaños emotiva para {nombre}, cliente de {años_como_cliente} años con póliza {tipo_póliza}…"
        />
        <div className="flex flex-wrap gap-1.5 mt-2">
          {vars.map((v) => (
            <button
              key={v}
              onClick={() => update({ aiPrompt: draft.aiPrompt + v })}
              className="px-2 py-0.5 rounded font-mono text-xs bg-[#C9973A]/10 text-[#8C5E0A] dark:text-[#C9973A] border border-[#C9973A]/20 hover:bg-[#C9973A]/20 transition-colors"
            >
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
      <h2 className="font-display text-lg font-semibold text-sand-900 dark:text-night-50">
        Configuración de assets
      </h2>
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
          <span className="font-mono font-semibold text-[#C9973A]">€0.19</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-2">
          <span className="text-sand-900/60 dark:text-night-50/60">Total estimado (1,247 clientes)</span>
          <span className="font-mono font-semibold text-sand-900 dark:text-night-50">€236.93</span>
        </div>
      </div>
    </div>
  )
}

function StepEntrega({ draft, update }: { draft: CampaignDraft; update: DraftUpdater }) {
  return (
    <div className="space-y-4">
      <h2 className="font-display text-lg font-semibold text-sand-900 dark:text-night-50">
        Canal de entrega
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {[
          { id: 'email', icon: 'ti-mail', label: 'Email', sublabel: 'via Mailerlite' },
          { id: 'whatsapp', icon: 'ti-brand-whatsapp', label: 'WhatsApp', sublabel: 'Próximamente' },
        ].map((ch) => (
          <button
            key={ch.id}
            disabled={ch.id === 'whatsapp'}
            onClick={() => update({ deliveryChannel: ch.id as typeof draft.deliveryChannel })}
            className={cn(
              'flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all',
              draft.deliveryChannel === ch.id
                ? 'border-[#C9973A]/60 bg-[#C9973A]/8'
                : 'border-black/10 dark:border-white/10',
              ch.id === 'whatsapp' && 'opacity-40 cursor-not-allowed'
            )}
          >
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

function StepLanzar({ cost, launching, onLaunch }: { cost: number; launching: boolean; onLaunch: () => void }) {
  return (
    <div className="space-y-5">
      <h2 className="font-display text-lg font-semibold text-sand-900 dark:text-night-50">
        Resumen y lanzamiento
      </h2>
      <div className="space-y-3">
        {[
          { label: 'Contactos', value: '1,247', icon: 'ti-users' },
          { label: 'Assets a generar', value: '1,247 canciones + 1,247 visualizers', icon: 'ti-wave-sine' },
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
      <button
        onClick={onLaunch}
        disabled={launching}
        className={cn(
          'w-full py-3 rounded-xl font-sans font-semibold text-sm flex items-center justify-center gap-2 transition-all',
          launching
            ? 'bg-[#C9973A]/50 text-white cursor-not-allowed'
            : 'bg-gradient-to-r from-[#C9973A] to-[#8C5E0A] text-white hover:opacity-90 active:scale-99 shadow-lg shadow-[#C9973A]/20'
        )}
      >
        {launching ? (
          <>
            <i className="ti ti-loader-2 animate-spin" />
            Lanzando campaña…
          </>
        ) : (
          <>
            <i className="ti ti-rocket" />
            Lanzar campaña
          </>
        )}
      </button>
    </div>
  )
}

/* ─── Preview bg-white dark:bg-[#1A1510] rounded-xl border border-black/8 dark:border-white/8 shadow-sm ────────────────────────────────────────────────────────── */

function PreviewCard({ step, cost, draft }: { step: number; cost: number; draft: CampaignDraft }) {
  return (
    <div className="bg-white dark:bg-[#1A1510] rounded-xl border border-black/8 dark:border-white/8 shadow-sm p-5 space-y-4 h-fit sticky top-6">
      <p className="text-xs font-sans font-medium text-sand-900/40 dark:text-night-50/40 uppercase tracking-widest">Vista previa</p>

      {/* Campaign name */}
      <div>
        <p className="font-display text-base font-semibold text-sand-900 dark:text-night-50 leading-snug">
          {draft.name || 'Sin nombre'}
        </p>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {draft.type && <span className="badge inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#C9973A]/15 text-[#8C5E0A] dark:text-[#C9973A] capitalize">{draft.type}</span>}
          {draft.vertical && <span className="badge inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#2BB5A0]/15 text-[#0D7A64] dark:text-[#2BB5A0] capitalize">{draft.vertical}</span>}
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

      {step >= 3 && (
        <Waveform />
      )}

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
          <div className="flex items-center justify-between text-xs mt-1">
            <span className="text-sand-900/40 dark:text-night-50/40">€0.19 × 1,247</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#C9973A]/15 text-[#8C5E0A] dark:text-[#C9973A]">€0.19/cliente</span>
          </div>
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
        <span
          key={i}
          className="w-1 rounded-full bg-[#C9973A] wave-bar"
          style={{ '--mh': `${h}px`, '--delay': `${i * 80}ms` } as React.CSSProperties}
        />
      ))}
    </div>
  )
}

/* ─── Launch success ──────────────────────────────────────────────────────── */

function LaunchSuccess({ onQueue, onNew }: { onQueue: () => void; onNew: () => void }) {
  return (
    <div className="max-w-lg mx-auto mt-20 text-center animate-slide-up">
      <div className="w-16 h-16 rounded-2xl bg-[#2BB5A0]/15 flex items-center justify-center mx-auto mb-5">
        <i className="ti ti-check text-3xl text-[#2BB5A0]" />
      </div>
      <h2 className="font-display text-2xl font-semibold text-sand-900 dark:text-night-50 mb-2">
        ¡Campaña lanzada!
      </h2>
      <p className="text-sand-900/60 dark:text-night-50/60 text-sm mb-8">
        1,247 assets comenzando a generarse · ~2h estimadas
      </p>
      <div className="flex flex-col gap-3">
        <button onClick={onQueue} className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-[#C9973A] text-white font-semibold text-sm hover:bg-[#b8832e] transition-all">
          <i className="ti ti-list-check" />
          Ver cola de generación
        </button>
        <button onClick={onNew} className="inline-flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg text-sm font-medium text-sand-900/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/5 transition-all">
          Crear otra campaña
        </button>
      </div>
    </div>
  )
}
