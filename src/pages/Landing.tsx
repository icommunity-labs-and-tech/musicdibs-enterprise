import { useState } from 'react'
import { Link } from 'react-router-dom'

const FEATURES = [
  { icon: 'ti-sparkles', title: 'Generación de audio con IA', desc: 'KIE.ai y Suno crean piezas musicales únicas y personalizadas para cada segmento de clientes en segundos.' },
  { icon: 'ti-mail-opened', title: 'Email marketing emocional', desc: 'Emails con audio integrado que generan conexión real. Open rates 3× superiores a campañas estándar.' },
  { icon: 'ti-chart-bar', title: 'Analytics en tiempo real', desc: 'Open rate, click rate, CTOR y coste por apertura. Todo medido y visible desde el momento del envío.' },
  { icon: 'ti-database', title: 'Integraciones CRM', desc: 'Conecta Salesforce o HubSpot y sincroniza contactos automáticamente antes de cada campaña.' },
  { icon: 'ti-users', title: 'Multi-vertical y multi-tenant', desc: 'Seguros, banca, retail, música. Cada organización con su propio espacio, datos y configuración.' },
  { icon: 'ti-shield-check', title: 'Infraestructura enterprise', desc: 'RLS por tenant, cifrado en tránsito y reposo, audit logs, SLA 99.9%. GDPR-ready.' },
]

const METRICS = [
  { value: '66%', label: 'open rate promedio' },
  { value: '18%', label: 'click rate promedio' },
  { value: '3×', label: 'vs. email estándar' },
  { value: '<60s', label: 'de brief a campaña lista' },
]

const PRICING = {
  monthly: { starter: 299, professional: 799, enterprise: 1999 },
  annual:  { starter: 249, professional: 666, enterprise: 1666 },
}

const PLANS = [
  { key: 'starter' as const, name: 'Starter', desc: 'Para equipos que empiezan con IA en sus campañas.', features: ['5 campañas / mes', '10.000 contactos', '1 usuario', 'Analytics básico', 'Soporte email'], cta: 'Empezar ahora', highlighted: false },
  { key: 'professional' as const, name: 'Professional', desc: 'Para equipos de marketing con volumen y multi-vertical.', features: ['25 campañas / mes', '100.000 contactos', '5 usuarios', 'Integraciones CRM', 'Analytics avanzado', 'Soporte prioritario'], cta: 'Empezar ahora', highlighted: true },
  { key: 'enterprise' as const, name: 'Enterprise', desc: 'Para grandes organizaciones con necesidades a medida.', features: ['Campañas ilimitadas', 'Contactos ilimitados', 'Usuarios ilimitados', 'API access', 'SLA dedicado', 'Gestor de cuenta'], cta: 'Hablar con ventas', highlighted: false },
]

const SECTORS = [
  { key: 'seguros', icon: 'ti-shield', label: 'Seguros', headline: 'Renueva pólizas con música que genera confianza', metric: '+52%', metricLabel: 'tasa de renovación', example: 'Una aseguradora envía un email con una pieza musical serena antes del vencimiento de póliza. Open rate: 71%.', useCase: 'Renovación de pólizas, fidelización de clientes, campañas de vida y hogar.' },
  { key: 'banca', icon: 'ti-building-bank', label: 'Banca', headline: 'Activa productos financieros con campañas emocionales', metric: '+38%', metricLabel: 'conversión en hipotecas', example: 'Un banco lanza un email musical para su campaña de hipotecas jóvenes. Click rate: 22%.', useCase: 'Hipotecas, fondos de inversión, cuentas premium, fidelización VIP.' },
  { key: 'musica', icon: 'ti-music', label: 'Música', headline: 'Lanza álbumes con campañas que se sienten', metric: '3.2×', metricLabel: 'streams en semana 1', example: 'Un sello independiente envía el prelanzamiento del álbum con un fragmento generado por IA. 66% open rate.', useCase: 'Prelanzamientos, giras, merch, fidelización de fans.' },
  { key: 'retail', icon: 'ti-shopping-cart', label: 'Retail', headline: 'Convierte campañas estacionales en experiencias', metric: '+29%', metricLabel: 'ticket medio en campañas', example: 'Una cadena de moda envía su campaña de Navidad con música exclusiva. CTOR del 19%.', useCase: 'Campañas estacionales, lanzamiento de producto, fidelización.' },
  { key: 'teleco', icon: 'ti-antenna', label: 'Teleco', headline: 'Reduce churn con comunicaciones que conectan', metric: '-31%', metricLabel: 'churn en segmento objetivo', example: 'Una operadora envía campañas de retención personalizadas con audio generado según el perfil del cliente.', useCase: 'Retención, upsell de tarifas, renovación de contratos.' },
  { key: 'inmobiliaria', icon: 'ti-home', label: 'Inmobiliaria', headline: 'Vende más rápido con la emoción del hogar', metric: '-18 días', metricLabel: 'tiempo medio de venta', example: 'Una promotora envía emails con música ambiental que evoca el hogar ideal. Open rate: 68%.', useCase: 'Captación de compradores, presentación de promociones, fidelización de inversores.' },
]

const FAQ_ITEMS = [
  { q: '¿Necesito conocimientos técnicos para usar MusicDibs Enterprise?', a: 'No. El builder es 100% no-code: describes el brief, seleccionas el tono y la IA genera el audio. El envío a tu ESP (Mailerlite, HubSpot, Salesforce) es automático.' },
  { q: '¿Los audios generados están libres de derechos?', a: 'Sí. Todo el audio generado a través de KIE.ai o Suno en nuestra plataforma es de uso comercial libre para tu organización. No hay royalties ni restricciones de distribución.' },
  { q: '¿Con qué plataformas de email se integra?', a: 'Actualmente con Mailerlite. En roadmap: HubSpot, Salesforce Marketing Cloud, Brevo y Klaviyo. Si usas otro ESP, contáctanos — priorizamos integraciones según demanda.' },
  { q: '¿Es compatible con GDPR?', a: 'Sí. Todos los datos se procesan en servidores europeos (EU-West). Ofrecemos DPA, logs de auditoría y eliminación de datos por solicitud. GDPR-ready desde el día 1.' },
  { q: '¿Cuánto tarda en generarse una campaña?', a: 'Menos de 60 segundos desde el brief hasta la campaña lista para envío. La generación de audio tarda entre 15 y 45 segundos según el modelo elegido.' },
  { q: '¿Puedo cancelar en cualquier momento?', a: 'Sí. Sin permanencia ni penalizaciones. Si cancelas un plan anual, te devolvemos el proporcional de los meses no utilizados.' },
]

export function Landing() {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('annual')
  const [activeSector, setActiveSector] = useState(0)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const prices = PRICING[billing]

  return (
    <div className="min-h-screen bg-[#FAF7F2] dark:bg-[#0F0C08] text-[#1A1510] dark:text-[#F5F0E8]">

      {/* Skip link */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-[#C9973A] focus:text-white focus:font-semibold focus:text-sm focus:shadow-lg">
        Saltar al contenido
      </a>

      {/* Nav */}
      <header>
        <nav aria-label="Navegación principal" className="sticky top-0 z-50 bg-[#FAF7F2]/90 dark:bg-[#0F0C08]/90 backdrop-blur border-b border-black/6 dark:border-white/6">
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#C9973A] flex items-center justify-center" aria-hidden="true">
                <i className="ti ti-music text-sm text-white" />
              </div>
              <span className="font-display font-semibold text-base">MusicDibs <span className="text-[#C9973A]">Enterprise</span></span>
            </div>
            <div className="hidden md:flex items-center gap-6 text-sm text-[#1A1510]/60 dark:text-[#F5F0E8]/60">
              <a href="#features" className="hover:text-[#1A1510] dark:hover:text-[#F5F0E8] transition-colors">Funcionalidades</a>
              <a href="#metrics" className="hover:text-[#1A1510] dark:hover:text-[#F5F0E8] transition-colors">Resultados</a>
              <a href="#pricing" className="hover:text-[#1A1510] dark:hover:text-[#F5F0E8] transition-colors">Precios</a>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/login" className="text-sm font-medium text-[#1A1510]/60 dark:text-[#F5F0E8]/60 hover:text-[#1A1510] dark:hover:text-[#F5F0E8] transition-colors">
                Iniciar sesión
              </Link>
              <Link to="/signup" className="text-sm font-medium px-4 py-2 rounded-xl bg-[#C9973A] hover:bg-[#B8862E] text-white transition-colors">
                Empezar gratis
              </Link>
            </div>
          </div>
        </nav>
      </header>

      <main id="main-content">

        {/* Hero */}
        <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#C9973A]/10 text-[#C9973A] text-xs font-semibold mb-6 border border-[#C9973A]/20">
            <i className="ti ti-sparkles text-sm" aria-hidden="true" />
            Powered by KIE.ai + Suno
          </div>
          <h1 className="font-display text-5xl md:text-6xl font-bold leading-tight mb-6 max-w-4xl mx-auto">
            Campañas de email con{' '}
            <span className="text-[#C9973A]">audio generado por IA</span>{' '}
            para empresas
          </h1>
          <p className="text-lg text-[#1A1510]/55 dark:text-[#F5F0E8]/55 max-w-2xl mx-auto mb-10 leading-relaxed">
            Convierte tus campañas de email marketing en experiencias sonoras únicas.
            IA genera música personalizada por segmento en segundos. Open rates 3× superiores.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/signup" className="min-h-[44px] px-6 py-3 rounded-xl bg-[#C9973A] hover:bg-[#B8862E] text-white font-semibold text-sm transition-colors flex items-center gap-2">
              <i className="ti ti-rocket text-base" aria-hidden="true" />
              Empezar gratis
            </Link>
            <a href="#features" className="min-h-[44px] px-6 py-3 rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 font-medium text-sm transition-colors flex items-center gap-2">
              <i className="ti ti-play text-base" aria-hidden="true" />
              Ver cómo funciona
            </a>
          </div>

          {/* Hero mockup */}
          <div className="mt-16 relative">
            <div className="bg-white dark:bg-[#1A1510] rounded-3xl border border-black/8 dark:border-white/8 shadow-2xl shadow-black/10 p-6 max-w-4xl mx-auto">
              <div className="flex items-center gap-2 mb-4" aria-hidden="true">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <span className="ml-2 text-xs text-black/30 dark:text-white/30 font-mono">enterprise.musicdibs.com/dashboard</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {[
                  { label: 'Emails enviados', value: '20.449', icon: 'ti-send', color: 'text-[#C9973A]' },
                  { label: 'Open rate', value: '66.1%', icon: 'ti-mail-opened', color: 'text-[#2BB5A0]' },
                  { label: 'Click rate', value: '18.4%', icon: 'ti-cursor-text', color: 'text-[#C9973A]' },
                  { label: 'Coste total', value: '€3.885', icon: 'ti-coin-euro', color: 'text-[#2BB5A0]' },
                ].map(({ label, value, icon, color }) => (
                  <div key={label} className="bg-[#FAF7F2] dark:bg-[#0F0C08] rounded-xl p-3 text-left">
                    <i className={`ti ${icon} text-base ${color}`} aria-hidden="true" />
                    <p className="font-display text-lg font-bold mt-1">{value}</p>
                    <p className="text-[10px] text-black/40 dark:text-white/40 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { name: 'Navidad — Seguros Hogar', status: 'Archivada', pct: 60, color: 'bg-[#C9973A]' },
                  { name: 'Fidelización VIP Banca', status: 'Enviada', pct: 74, color: 'bg-[#2BB5A0]' },
                  { name: 'Lanzamiento Álbum', status: 'Lista', pct: 0, color: 'bg-blue-400' },
                ].map(({ name, status, pct, color }) => (
                  <div key={name} className="bg-[#FAF7F2] dark:bg-[#0F0C08] rounded-xl p-3 text-left">
                    <p className="text-xs font-medium truncate">{name}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-black/40 dark:text-white/40">{status}</span>
                      {pct > 0 && <span className="text-[10px] font-semibold text-[#C9973A]">{pct}% open</span>}
                    </div>
                    {pct > 0 && (
                      <div className="mt-1.5 h-1 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute inset-0 -z-10 bg-[#C9973A]/10 blur-3xl rounded-full scale-75" aria-hidden="true" />
          </div>
        </section>

        {/* Metrics */}
        <section id="metrics" aria-label="Métricas clave" className="border-y border-black/6 dark:border-white/6 bg-white dark:bg-[#1A1510]/50">
          <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
            {METRICS.map(({ value, label }) => (
              <div key={label} className="text-center">
                <p className="font-display text-4xl font-bold text-[#C9973A]">{value}</p>
                <p className="text-sm text-[#1A1510]/50 dark:text-[#F5F0E8]/50 mt-1">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Sector tabs */}
        <section aria-label="Sectores" className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold text-[#1A1510]/40 dark:text-[#F5F0E8]/40 uppercase tracking-widest mb-3">Adaptado para cada sector</p>
            <h2 className="font-display text-3xl font-bold">¿Cuál es tu industria?</h2>
          </div>
          <div role="tablist" aria-label="Selecciona tu sector" className="flex flex-wrap justify-center gap-2 mb-10">
            {SECTORS.map(({ key, icon, label }, i) => (
              <button
                key={key}
                role="tab"
                id={`tab-${key}`}
                aria-selected={activeSector === i}
                aria-controls={`panel-${key}`}
                onClick={() => setActiveSector(i)}
                className={`min-h-[44px] flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  activeSector === i
                    ? 'bg-[#C9973A] text-white shadow-md'
                    : 'bg-white dark:bg-[#1A1510] border border-black/8 dark:border-white/8 text-[#1A1510]/70 dark:text-[#F5F0E8]/70 hover:border-[#C9973A]/40 hover:text-[#C9973A]'
                }`}
              >
                <i className={`ti ${icon} text-base`} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
          {SECTORS.map(({ key, headline, metric, metricLabel, example, useCase }, i) => (
            <div key={key} role="tabpanel" id={`panel-${key}`} aria-labelledby={`tab-${key}`} hidden={activeSector !== i}>
              <div className="sector-fade bg-white dark:bg-[#1A1510] rounded-2xl border border-black/8 dark:border-white/8 p-8 grid md:grid-cols-2 gap-8 items-center">
                <div>
                  <h3 className="font-display text-2xl font-bold mb-4">{headline}</h3>
                  <p className="text-sm text-[#1A1510]/60 dark:text-[#F5F0E8]/60 leading-relaxed mb-4">{example}</p>
                  <p className="text-xs text-[#1A1510]/40 dark:text-[#F5F0E8]/40">{useCase}</p>
                </div>
                <div className="text-center">
                  <p className="font-display text-6xl font-bold text-[#C9973A] tabular-nums">{metric}</p>
                  <p className="text-sm text-[#1A1510]/50 dark:text-[#F5F0E8]/50 mt-2">{metricLabel}</p>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Features */}
        <section id="features" aria-label="Funcionalidades" className="bg-white dark:bg-[#1A1510]/30">
          <div className="max-w-6xl mx-auto px-6 py-20">
            <div className="text-center mb-14">
              <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">Todo lo que necesitas para campañas con audio IA</h2>
              <p className="text-[#1A1510]/50 dark:text-[#F5F0E8]/50 max-w-xl mx-auto">Desde la generación del audio hasta el análisis de resultados. En una sola plataforma.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {FEATURES.map(({ icon, title, desc }) => (
                <div key={title} className="bg-[#FAF7F2] dark:bg-[#0F0C08] rounded-2xl p-6 border border-black/6 dark:border-white/6">
                  <div className="w-10 h-10 rounded-xl bg-[#C9973A]/10 flex items-center justify-center mb-4" aria-hidden="true">
                    <i className={`ti ${icon} text-lg text-[#C9973A]`} />
                  </div>
                  <h3 className="font-display text-base font-semibold mb-2">{title}</h3>
                  <p className="text-sm text-[#1A1510]/55 dark:text-[#F5F0E8]/55 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section aria-label="Cómo funciona" className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-14">
            <h2 className="font-display text-3xl font-bold mb-4">De brief a campaña en 4 pasos</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { step: '01', icon: 'ti-pencil', title: 'Define el brief', desc: 'Vertical, tono, objetivo, segmento. El builder te guía.' },
              { step: '02', icon: 'ti-sparkles', title: 'IA genera el audio', desc: 'KIE.ai o Suno crean una pieza musical única para tu campaña.' },
              { step: '03', icon: 'ti-send', title: 'Envío automático', desc: 'Mailerlite distribuye el email con el audio integrado a tu lista.' },
              { step: '04', icon: 'ti-chart-bar', title: 'Analiza resultados', desc: 'Open rate, CTOR y coste en tiempo real desde el dashboard.' },
            ].map(({ step, icon, title, desc }) => (
              <div key={step}>
                <div className="flex items-start gap-4">
                  <div className="shrink-0">
                    <div className="w-10 h-10 rounded-xl bg-[#C9973A]/10 border border-[#C9973A]/20 flex items-center justify-center" aria-hidden="true">
                      <i className={`ti ${icon} text-base text-[#C9973A]`} />
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[#C9973A]/60 uppercase tracking-widest">{step}</span>
                    <h3 className="font-display font-semibold mt-0.5 mb-1">{title}</h3>
                    <p className="text-sm text-[#1A1510]/50 dark:text-[#F5F0E8]/50 leading-relaxed">{desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" aria-label="Precios" className="bg-white dark:bg-[#1A1510]/30">
          <div className="max-w-6xl mx-auto px-6 py-20">
            <div className="text-center mb-10">
              <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">Precios claros, sin sorpresas</h2>
              <div role="group" aria-label="Periodo de facturación" className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#FAF7F2] dark:bg-[#0F0C08] border border-black/8 dark:border-white/8 mt-4">
                {(['monthly', 'annual'] as const).map((b) => (
                  <button
                    key={b}
                    role="radio"
                    aria-checked={billing === b}
                    onClick={() => setBilling(b)}
                    className={`min-h-[36px] px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      billing === b
                        ? 'bg-white dark:bg-[#1A1510] shadow-sm text-[#1A1510] dark:text-[#F5F0E8]'
                        : 'text-[#1A1510]/50 dark:text-[#F5F0E8]/50 hover:text-[#1A1510] dark:hover:text-[#F5F0E8]'
                    }`}
                  >
                    {b === 'monthly' ? 'Mensual' : (
                      <span className="flex items-center gap-1.5">
                        Anual
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#2BB5A0]/15 text-[#0D7A64] dark:text-[#2BB5A0]">−2 meses</span>
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto">
              {PLANS.map(({ key, name, desc, features, cta, highlighted }) => (
                <div key={name} className={`relative rounded-2xl border p-6 flex flex-col ${highlighted ? 'border-[#C9973A] bg-[#C9973A]/5' : 'border-black/8 dark:border-white/8 bg-[#FAF7F2] dark:bg-[#0F0C08]'}`}>
                  {highlighted && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-[#C9973A] text-white uppercase tracking-wide">Más popular</span>
                    </div>
                  )}
                  <div className="mb-5">
                    <p className="font-display font-bold text-lg">{name}</p>
                    <p className="text-sm text-[#1A1510]/50 dark:text-[#F5F0E8]/50 mt-1">{desc}</p>
                    <div className="flex items-baseline gap-1 mt-3">
                      <span className="font-display text-3xl font-bold tabular-nums">€{prices[key]}</span>
                      <span className="text-sm text-[#1A1510]/40 dark:text-[#F5F0E8]/40">/mes</span>
                    </div>
                    {billing === 'annual' && (
                      <p className="text-xs text-[#2BB5A0] mt-1 tabular-nums">
                        Ahorro €{(PRICING.monthly[key] - PRICING.annual[key]) * 12}/año
                      </p>
                    )}
                  </div>
                  <ul className="space-y-2 flex-1 mb-6">
                    {features.map(f => (
                      <li key={f} className="flex items-center gap-2 text-sm">
                        <i className="ti ti-check text-[#2BB5A0] text-sm shrink-0" aria-hidden="true" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link to="/signup" className={`min-h-[44px] text-center text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors flex items-center justify-center ${highlighted ? 'bg-[#C9973A] hover:bg-[#B8862E] text-white' : 'bg-[#1A1510] dark:bg-[#F5F0E8] text-white dark:text-[#1A1510] hover:opacity-90'}`}>
                    {cta}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section aria-label="Preguntas frecuentes" className="max-w-3xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl font-bold mb-3">Preguntas frecuentes</h2>
            <p className="text-[#1A1510]/50 dark:text-[#F5F0E8]/50">Todo lo que necesitas saber antes de empezar.</p>
          </div>
          <div className="space-y-2">
            {FAQ_ITEMS.map(({ q, a }, i) => {
              const isOpen = openFaq === i
              return (
                <div key={i} className="bg-white dark:bg-[#1A1510] rounded-xl border border-black/8 dark:border-white/8 overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${i}`}
                    id={`faq-btn-${i}`}
                    className="w-full min-h-[52px] flex items-center justify-between gap-4 px-5 py-4 text-left font-medium text-sm hover:bg-black/2 dark:hover:bg-white/2 transition-colors"
                  >
                    <span>{q}</span>
                    <i className={`ti ti-chevron-down text-base text-[#1A1510]/40 dark:text-[#F5F0E8]/40 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </button>
                  <div id={`faq-panel-${i}`} role="region" aria-labelledby={`faq-btn-${i}`} className={`faq-content${isOpen ? ' is-open' : ''}`}>
                    <div>
                      <p className="px-5 pb-4 text-sm text-[#1A1510]/60 dark:text-[#F5F0E8]/60 leading-relaxed">{a}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* CTA final */}
        <section aria-label="Llamada a la acción" className="max-w-6xl mx-auto px-6 py-24 text-center">
          <div className="bg-[#C9973A]/8 dark:bg-[#C9973A]/5 border border-[#C9973A]/20 rounded-3xl p-12">
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">Listo para transformar tus campañas</h2>
            <p className="text-[#1A1510]/55 dark:text-[#F5F0E8]/55 max-w-xl mx-auto mb-8">
              Únete a las empresas que ya generan conexiones emocionales con sus clientes mediante audio IA personalizado.
            </p>
            <Link to="/signup" className="inline-flex items-center gap-2 min-h-[48px] px-8 py-3.5 rounded-xl bg-[#C9973A] hover:bg-[#B8862E] text-white font-semibold transition-colors">
              <i className="ti ti-rocket text-base" aria-hidden="true" />
              Empezar gratis — 14 días
            </Link>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-black/6 dark:border-white/6">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-[#1A1510]/40 dark:text-[#F5F0E8]/40">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-[#C9973A] flex items-center justify-center" aria-hidden="true">
              <i className="ti ti-music text-[10px] text-white" />
            </div>
            <span className="font-medium">MusicDibs Enterprise</span>
            <span>· by iCommunity Labs</span>
          </div>
          <nav aria-label="Pie de página">
            <div className="flex items-center gap-6">
              <a href="#" className="hover:text-[#1A1510] dark:hover:text-[#F5F0E8] transition-colors">Privacidad</a>
              <a href="#" className="hover:text-[#1A1510] dark:hover:text-[#F5F0E8] transition-colors">Términos</a>
              <a href="mailto:enterprise@musicdibs.com" className="hover:text-[#1A1510] dark:hover:text-[#F5F0E8] transition-colors">Contacto</a>
            </div>
          </nav>
        </div>
      </footer>
    </div>
  )
}
