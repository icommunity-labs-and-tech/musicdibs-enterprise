import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export function Login() {
  const { session, signIn, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && session) return <Navigate to="/dashboard" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error: err } = await signIn(email, password)
    if (err) setError(err)
    setSubmitting(false)
  }

  async function handleDemo() {
    setError(null)
    setSubmitting(true)
    const { error: err } = await signIn('demo@musicdibs.com', 'MusicDibs2026!')
    if (err) setError(err)
    setSubmitting(false)
  }

  return (
    <div className="min-h-screen bg-[#F5EFE6] dark:bg-[#0C0A08] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#C9973A] mb-4">
            <i className="ti ti-wave-sine text-white text-2xl" />
          </div>
          <h1 className="font-display text-2xl font-semibold text-sand-900 dark:text-night-50">
            MusicDibs Enterprise
          </h1>
          <p className="text-sm text-sand-900/50 dark:text-night-50/50 mt-1">
            Campañas musicales con IA
          </p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-[#1A1510] rounded-2xl border border-black/8 dark:border-white/8 shadow-sm p-6 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-sand-900/60 dark:text-night-50/60 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="tu@empresa.com"
                className="w-full px-3 py-2.5 rounded-lg text-sm bg-[#F5EFE6] dark:bg-[#0C0A08] border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-[#C9973A]/30 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-sand-900/60 dark:text-night-50/60 mb-1.5">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-3 py-2.5 rounded-lg text-sm bg-[#F5EFE6] dark:bg-[#0C0A08] border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-[#C9973A]/30 transition-all"
              />
            </div>

            {error && (
              <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-xl bg-[#C9973A] text-white font-semibold text-sm hover:bg-[#b8832e] active:scale-98 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting ? <i className="ti ti-loader-2 animate-spin" /> : null}
              Iniciar sesión
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-black/8 dark:border-white/8" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white dark:bg-[#1A1510] px-3 text-xs text-sand-900/30 dark:text-night-50/30">
                o
              </span>
            </div>
          </div>

          <button
            onClick={handleDemo}
            disabled={submitting}
            className="w-full py-2.5 rounded-xl border border-black/10 dark:border-white/10 text-sm font-medium text-sand-900/70 dark:text-night-50/70 hover:bg-black/4 dark:hover:bg-white/4 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <i className="ti ti-player-play text-[#C9973A]" />
            Entrar con cuenta demo
          </button>
        </div>

        <div className="mt-6 flex flex-col items-center gap-2">
          <p className="text-center text-sm text-sand-900/50 dark:text-night-50/50">
            ¿No tienes cuenta?{' '}
            <Link to="/signup" className="font-medium text-[#C9973A] hover:underline">
              Regístrate gratis
            </Link>
          </p>
          <p className="text-center text-xs text-sand-900/30 dark:text-night-50/30">
            demo@musicdibs.com · MusicDibs2026!
          </p>
        </div>
      </div>
    </div>
  )
}
