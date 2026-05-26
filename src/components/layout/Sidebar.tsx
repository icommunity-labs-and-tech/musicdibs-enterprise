import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

const nav = [
  { to: '/dashboard', icon: 'ti-layout-dashboard', label: 'Dashboard' },
  { to: '/campaigns', icon: 'ti-speakerphone', label: 'Campañas' },
  { to: '/analytics', icon: 'ti-chart-bar', label: 'Analytics' },
  { to: '/settings', icon: 'ti-settings', label: 'Configuración' },
]

export function Sidebar() {
  return (
    <aside className="w-60 flex-shrink-0 flex flex-col bg-white dark:bg-night-800 border-r border-black/8 dark:border-white/8">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-black/8 dark:border-white/8">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#C9973A] to-[#8C5E0A] flex items-center justify-center">
            <i className="ti ti-wave-sine text-white text-base" />
          </div>
          <div>
            <div className="font-display font-semibold text-sm text-sand-900 dark:text-night-50">
              MusicDibs
            </div>
            <div className="text-[10px] font-sans font-medium tracking-widest uppercase text-[#C9973A]">
              Enterprise
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5">
        {nav.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-sans font-medium transition-all duration-150',
                isActive
                  ? 'bg-[#C9973A]/12 text-[#8C5E0A] dark:bg-[#C9973A]/15 dark:text-[#C9973A]'
                  : 'text-sand-900/60 dark:text-night-50/60 hover:bg-black/5 dark:hover:bg-white/5 hover:text-sand-900 dark:hover:text-night-50'
              )
            }
          >
            <i className={cn('ti text-base', icon)} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Org badge */}
      <div className="p-3 border-t border-black/8 dark:border-white/8">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-sand-50 dark:bg-night-900">
          <div className="w-7 h-7 rounded-full bg-[#C9973A]/20 flex items-center justify-center flex-shrink-0">
            <i className="ti ti-building text-[#C9973A] text-xs" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-sans font-semibold text-sand-900 dark:text-night-50 truncate">
              Seguros Demo SA
            </div>
            <div className="text-[10px] font-sans text-sand-900/40 dark:text-night-50/40">
              Enterprise plan
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
