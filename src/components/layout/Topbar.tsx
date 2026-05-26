import { useThemeStore } from '@/store/themeStore'
import { useNavigate } from 'react-router-dom'

export function Topbar() {
  const { isDark, toggle } = useThemeStore()
  const navigate = useNavigate()

  return (
    <header className="h-14 flex-shrink-0 flex items-center justify-between px-6 bg-white dark:bg-night-800 border-b border-black/8 dark:border-white/8">
      <div className="flex items-center gap-2">
        {/* Breadcrumb filled by child pages via context in future */}
      </div>

      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-sand-900/50 dark:text-night-50/50 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          title={isDark ? 'Modo diurno' : 'Modo nocturno'}
        >
          <i className={`ti ${isDark ? 'ti-sun' : 'ti-moon'} text-base`} />
        </button>

        {/* New campaign CTA */}
        <button
          onClick={() => navigate('/campaigns/new')}
          className="btn-primary"
        >
          <i className="ti ti-plus text-sm" />
          Nueva campaña
        </button>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-[#C9973A]/20 flex items-center justify-center ml-1">
          <span className="text-xs font-sans font-semibold text-[#8C5E0A] dark:text-[#C9973A]">iC</span>
        </div>
      </div>
    </header>
  )
}
