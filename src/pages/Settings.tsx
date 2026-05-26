export function Settings() {
  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <h1 className="font-display text-2xl text-sand-900 dark:text-night-50 font-semibold">
        Configuración
      </h1>
      <div className="bg-white dark:bg-[#1A1510] rounded-xl border border-black/8 dark:border-white/8 shadow-sm p-5 space-y-4">
        <h2 className="font-display text-base font-semibold text-sand-900 dark:text-night-50">Integraciones</h2>
        {[
          { name: 'Salesforce CRM', status: 'Conectado', icon: 'ti-database', connected: true },
          { name: 'Mailerlite', status: 'Conectado', icon: 'ti-mail', connected: true },
          { name: 'KIE.ai', status: 'API key configurada', icon: 'ti-sparkles', connected: true },
          { name: 'Suno API', status: 'No configurado', icon: 'ti-wave-sine', connected: false },
          { name: 'WhatsApp Business', status: 'Próximamente', icon: 'ti-brand-whatsapp', connected: false },
        ].map(({ name, status, icon, connected }) => (
          <div key={name} className="flex items-center gap-4 py-3 border-b border-black/5 dark:border-white/5">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${connected ? 'bg-[#2BB5A0]/12' : 'bg-black/5 dark:bg-white/5'}`}>
              <i className={`ti ${icon} text-base ${connected ? 'text-[#2BB5A0]' : 'text-sand-900/30 dark:text-night-50/30'}`} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-sans font-medium text-sand-900 dark:text-night-50">{name}</p>
              <p className="text-xs text-sand-900/40 dark:text-night-50/40">{status}</p>
            </div>
            <button className={`text-xs font-sans font-medium px-3 py-1.5 rounded-lg transition-colors ${connected ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20' : 'btn-primary py-1.5 text-xs'}`}>
              {connected ? 'Desconectar' : 'Conectar'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
