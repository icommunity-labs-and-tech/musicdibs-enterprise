import { NotificationCenter } from '@/components/NotificationCenter'
import { useThemeStore } from '@/store/themeStore'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'

export function Topbar() {
  const { isDark, toggle } = useThemeStore()
  const { tenant, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    await signOut()
    navigate('/login')
  }

  return (
    <header className="h-14 border-b border-black/8 dark:border-white/8 bg-white dark:bg-[#1A1510] flex items-center px-5 gap-4 flex-shrink-0">
      {/* Tenant name */}
      <div className="flex-1">
        {tenant && (
          <p className="text-sm font-sans font-medium text-sand-900/60 dark:text-night-50/60">
            {tenant.name}
            <span className="ml-2 px-1.5 py-0.5 rounded text-xs bg-[#C9973A]/10 text-[#8C5E0A] dark:text-[#C9973A] capitalize">
              {tenant.plan}
            </span>
          </p>
        )}
      </div>

      {/* Dark mode toggle */}
      <button
        onClick={toggle}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-sand-900/40 dark:text-night-50/40 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        title={isDark ? 'Modo claro' : 'Modo oscuro'}
      >
        <i className={`ti ${isDark ? 'ti-sun' : 'ti-moon'} text-sm`} />
      </button>

      {/* User avatar + signout */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-[#C9973A]/20 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-semibold text-[#8C5E0A] dark:text-[#C9973A]">
            {profile?.full_name?.[0] ?? '?'}
          </span>
        </div>
        <span className="text-sm text-sand-900/60 dark:text-night-50/60 hidden md:block">
          {profile?.full_name ?? 'Usuario'}
        </span>
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-sand-900/30 dark:text-night-50/30 hover:text-sand-900 dark:hover:text-night-50 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          title="Cerrar sesión"
        >
          <i className="ti ti-logout text-sm" />
        </button>
      </div>
    </header>
  )
}
