import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

const VERTICAL_OPTIONS = [
  { value: 'insurance', label: 'Seguros', icon: 'ti-shield' },
  { value: 'banking', label: 'Banca', icon: 'ti-building-bank' },
  { value: 'retail', label: 'Retail', icon: 'ti-shopping-cart' },
  { value: 'music', label: 'Música', icon: 'ti-music' },
  { value: 'telecom', label: 'Telecomunicaciones', icon: 'ti-antenna' },
  { value: 'real_estate', label: 'Inmobiliaria', icon: 'ti-home' },
  { value: 'other', label: 'Otro', icon: 'ti-dots' },
]

const STEPS = [
  { id: 'org',  label: 'Tu organización', icon: 'ti-building' },
  { id: 'keys', label: 'Proveedores IA',  icon: 'ti-sparkles' },
  { id: 'done', label: 'Listo',           icon: 'ti-check' },
]

export function Onboarding() {
  const { tenant, patchTenant } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)

  // Step 0 — org
  const [orgName, setOrgName] = useState(tenant?.name ?? '')
  const [vertical, setVertical] = useState(tenant?.vertical ?? '')

  // Step 1 — keys
  const [kieKey, setKieKey] = useState('')
  const [sunoKey, setSunoKey] = useState('')
  const [mailerliteKey, setMailerliteKey] = useState('')
  const [showKie, setShowKie] = useState(false)
  const [showSuno, setShowSuno] = useState(false)
  const [showMail, setShowMail] = useState(false)

  const saveOrg = useMutation({
    mutationFn: async () => {
      await supabase.from('tenants')
        .update({ name: orgName, vertical })
        .eq('id', tenant!.id)
    },
    onSuccess: () => setStep(1),
  })

  const saveKeys = useMutation({
    mutationFn: async () => {
      await supabase.from('tenant_settings').upsert({
        tenant_id: tenant!.id,
        api_keys: {
          ...(kieKey ? { kie_ai: kieKey } : {}),
          ...(sunoKey ? { suno: sunoKey } : {}),
          ...(mailerliteKey ? { mailerlite: mailerliteKey } : {}),
        },
      }, { onConflict: 'tenant_id' })
    },
    onSuccess: () => setStep(2),
  })

  const complete = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('tenants')
        .update({ setup_complete: true })
        .eq('id', tenant!.id)
      if (error) throw error
    },
    onSuccess: () => {
      // Optimistic update: set setup_complete locally so ProtectedRoute
      // stops rendering Onboarding BEFORE the navigate call, avoiding the
      // race condition where navigate fires but the route is still guarded.
      patchTenant({ setup_complete: true })
      navigate('/campaigns/new')
    },
  })

  return (
    <div className="min-h-screen bg-[#FAF7F2] dark:bg-[#0F0C08] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">

        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-8 h-8 rounded-xl bg-gold-400 flex items-center justify-center">
            <i className="ti ti-music text-base text-white" />
          </div>
          <span className="font-display font-semibold text-lg text-sand-900 dark:text-night-50">
            MusicDibs <span className="text-gold-500">Enterprise</span>
          </span>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                i < step  ? 'bg-teal-400 text-white' :
                i === step ? 'bg-gold-400 text-night-900' :
                             'bg-sand-200 dark:bg-night-700 text-sand-900/30 dark:text-night-50/30'
              )}>
                {i < step ? <i className="ti ti-check text-sm" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn('w-8 h-0.5 rounded-full transition-all', i < step ? 'bg-teal-400' : 'bg-sand-200 dark:bg-night-700')} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-night-800 rounded-3xl border border-sand-200 dark:border-night-700 shadow-xl shadow-black/5 p-8">

          {/* ── Step 0: Organización ────────────────────────────────────────── */}
          {step === 0 && (
            <div className="space-y-6">
              <div>
                <h1 className="font-display text-2xl font-bold text-sand-900 dark:text-night-50">
                  Bienvenido a MusicDibs Enterprise
                </h1>
                <p className="text-sm text-sand-900/50 dark:text-night-50/50 mt-1.5">
                  Configura tu organización en menos de 2 minutos.
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-sand-900 dark:text-night-50 mb-1.5 block">
                    Nombre de la organización
                  </label>
                  <input
                    type="text"
                    value={orgName}
                    onChange={e => setOrgName(e.target.value)}
                    placeholder="Acme Corp"
                    className="w-full px-4 py-2.5 rounded-xl border border-sand-200 dark:border-night-600 bg-white dark:bg-night-700 text-sand-900 dark:text-night-50 placeholder:text-sand-900/25 focus:outline-none focus:ring-2 focus:ring-gold-400/50 focus:border-gold-400 text-sm transition-colors"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-sand-900 dark:text-night-50 mb-1.5 block">
                    Sector principal
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {VERTICAL_OPTIONS.map(v => (
                      <button
                        key={v.value}
                        type="button"
                        onClick={() => setVertical(v.value)}
                        className={cn(
                          'flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all text-left',
                          vertical === v.value
                            ? 'border-gold-400 bg-gold-50 dark:bg-gold-900/10 text-gold-700 dark:text-gold-400'
                            : 'border-sand-200 dark:border-night-600 text-sand-900/60 dark:text-night-50/60 hover:border-sand-300 dark:hover:border-night-500'
                        )}
                      >
                        <i className={`ti ${v.icon} text-base shrink-0`} />
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button
                onClick={() => saveOrg.mutate()}
                disabled={!orgName.trim() || !vertical || saveOrg.isPending}
                className="w-full py-3 rounded-xl bg-gold-400 hover:bg-gold-500 text-night-900 font-semibold text-sm transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {saveOrg.isPending
                  ? <><div className="w-4 h-4 border-2 border-night-900/30 border-t-night-900 rounded-full animate-spin" /> Guardando…</>
                  : <>Siguiente <i className="ti ti-arrow-right text-base" /></>}
              </button>
            </div>
          )}

          {/* ── Step 1: API Keys ────────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h1 className="font-display text-2xl font-bold text-sand-900 dark:text-night-50">
                  Conecta tus proveedores IA
                </h1>
                <p className="text-sm text-sand-900/50 dark:text-night-50/50 mt-1.5">
                  Necesitas al menos un proveedor de audio para generar campañas. Puedes añadirlo ahora o más tarde en Configuración.
                </p>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'KIE.ai', hint: 'Generación de voz con IA', icon: 'ti-microphone', placeholder: 'kie_live_…', val: kieKey, setVal: setKieKey, show: showKie, setShow: setShowKie },
                  { label: 'Suno API', hint: 'Generación de música con IA', icon: 'ti-wave-sine', placeholder: 'suno_…', val: sunoKey, setVal: setSunoKey, show: showSuno, setShow: setShowSuno },
                  { label: 'Mailerlite', hint: 'Envío de emails', icon: 'ti-mail', placeholder: 'mlite_…', val: mailerliteKey, setVal: setMailerliteKey, show: showMail, setShow: setShowMail },
                ].map(({ label, hint, icon, placeholder, val, setVal, show, setShow }) => (
                  <div key={label} className="bg-sand-50 dark:bg-night-700/50 rounded-xl p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-medium text-sand-900 dark:text-night-50">{label}</p>
                        <p className="text-xs text-sand-900/40 dark:text-night-50/40">{hint}</p>
                      </div>
                      {val && <i className="ti ti-check text-sm text-teal-500 mt-0.5" />}
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <i className={`ti ${icon} absolute left-3 top-1/2 -translate-y-1/2 text-sm text-sand-900/30 dark:text-night-50/30`} />
                        <input
                          type={show ? 'text' : 'password'}
                          value={val}
                          onChange={e => setVal(e.target.value)}
                          placeholder={placeholder}
                          className="w-full pl-8 pr-3 py-2 rounded-lg border border-sand-200 dark:border-night-600 bg-white dark:bg-night-700 text-sand-900 dark:text-night-50 placeholder:text-sand-900/20 focus:outline-none focus:ring-2 focus:ring-gold-400/40 text-xs font-mono transition-colors"
                        />
                      </div>
                      <button type="button" onClick={() => setShow(!show)} className="px-2.5 rounded-lg border border-sand-200 dark:border-night-600 text-sand-900/30 dark:text-night-50/30 hover:text-sand-900 dark:hover:text-night-50 transition-colors">
                        <i className={`ti ${show ? 'ti-eye-off' : 'ti-eye'} text-sm`} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 py-3 rounded-xl border border-sand-200 dark:border-night-600 text-sand-900/60 dark:text-night-50/60 text-sm font-medium hover:bg-sand-50 dark:hover:bg-night-700 transition-colors"
                >
                  Saltar por ahora
                </button>
                <button
                  onClick={() => saveKeys.mutate()}
                  disabled={saveKeys.isPending}
                  className="flex-2 flex-1 py-3 rounded-xl bg-gold-400 hover:bg-gold-500 text-night-900 font-semibold text-sm transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {saveKeys.isPending
                    ? <div className="w-4 h-4 border-2 border-night-900/30 border-t-night-900 rounded-full animate-spin" />
                    : <>Guardar y continuar <i className="ti ti-arrow-right text-base" /></>}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Done ────────────────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center mx-auto">
                <i className="ti ti-rocket text-3xl text-teal-500" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold text-sand-900 dark:text-night-50">
                  ¡Todo listo, {tenant?.name}!
                </h1>
                <p className="text-sm text-sand-900/50 dark:text-night-50/50 mt-2 leading-relaxed">
                  Tu organización está configurada. Crea tu primera campaña con audio generado por IA.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-left">
                {[
                  { icon: 'ti-pencil', label: 'Define el brief', desc: 'Sector, tono, objetivo' },
                  { icon: 'ti-sparkles', label: 'IA genera audio', desc: 'KIE.ai o Suno' },
                  { icon: 'ti-send', label: 'Envía la campaña', desc: 'Vía Mailerlite' },
                ].map(({ icon, label, desc }) => (
                  <div key={label} className="bg-sand-50 dark:bg-night-700/50 rounded-xl p-3">
                    <i className={`ti ${icon} text-base text-gold-500`} />
                    <p className="text-xs font-semibold text-sand-900 dark:text-night-50 mt-2">{label}</p>
                    <p className="text-[10px] text-sand-900/40 dark:text-night-50/40 mt-0.5">{desc}</p>
                  </div>
                ))}
              </div>
              <button
                onClick={() => complete.mutate()}
                disabled={complete.isPending}
                className="w-full py-3 rounded-xl bg-gold-400 hover:bg-gold-500 text-night-900 font-semibold text-sm transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {complete.isPending
                  ? <div className="w-4 h-4 border-2 border-night-900/30 border-t-night-900 rounded-full animate-spin" />
                  : <><i className="ti ti-plus text-base" /> Crear mi primera campaña</>}
              </button>
            </div>
          )}
        </div>

        {/* Skip link */}
        {step < 2 && (
          <button
            onClick={() => complete.mutate()}
            className="w-full text-center text-xs text-sand-900/30 dark:text-night-50/30 hover:text-sand-900/50 dark:hover:text-night-50/50 mt-4 transition-colors"
          >
            Configurar más tarde desde Ajustes →
          </button>
        )}
      </div>
    </div>
  )
}
