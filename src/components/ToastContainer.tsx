import { useEffect, useRef } from 'react'
import { useToastStore, Toast, ToastType } from '@/store/toastStore'

const ICONS: Record<ToastType, string> = {
  success: 'ti ti-circle-check',
  error: 'ti ti-alert-circle',
  info: 'ti ti-info-circle',
  warning: 'ti ti-alert-triangle',
}

const COLORS: Record<ToastType, { bg: string; border: string; icon: string; progress: string }> = {
  success: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    border: 'border-emerald-200 dark:border-emerald-700',
    icon: 'text-emerald-500',
    progress: 'bg-emerald-500',
  },
  error: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-700',
    icon: 'text-red-500',
    progress: 'bg-red-500',
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-700',
    icon: 'text-blue-500',
    progress: 'bg-blue-500',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-700',
    icon: 'text-amber-500',
    progress: 'bg-amber-500',
  },
}

function ToastItem({ toast }: { toast: Toast }) {
  const remove = useToastStore((s) => s.remove)
  const colors = COLORS[toast.type]
  const duration = toast.duration ?? 4000
  const progressRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (duration === 0) return

    const timer = setTimeout(() => remove(toast.id), duration)

    // Animate progress bar
    if (progressRef.current) {
      progressRef.current.style.transition = `width ${duration}ms linear`
      // Start animation after paint
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (progressRef.current) progressRef.current.style.width = '0%'
        })
      })
    }

    return () => clearTimeout(timer)
  }, [toast.id, duration, remove])

  return (
    <div
      className={`
        flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-sm
        ${colors.bg} ${colors.border}
        animate-slide-in-right
        min-w-[300px] max-w-[420px] w-full
      `}
      role="alert"
    >
      {/* Icon */}
      <i className={`${ICONS[toast.type]} text-xl flex-shrink-0 mt-0.5 ${colors.icon}`} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">
          {toast.title}
        </p>
        {toast.message && (
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 leading-relaxed">
            {toast.message}
          </p>
        )}
      </div>

      {/* Close */}
      <button
        onClick={() => remove(toast.id)}
        className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        aria-label="Cerrar"
      >
        <i className="ti ti-x text-base" />
      </button>

      {/* Progress bar */}
      {duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-xl overflow-hidden bg-black/5">
          <div
            ref={progressRef}
            className={`h-full ${colors.progress} opacity-60`}
            style={{ width: '100%' }}
          />
        </div>
      )}
    </div>
  )
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto relative">
          <ToastItem toast={toast} />
        </div>
      ))}
    </div>
  )
}
