import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export function Signup() {
  const { session, loading, signUp } = useAuth()
  const navigate = useNavigate()

  const [orgName, setOrgName]     = useState('')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [error, setError]         = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [needsVerification, setNeedsVerification] = useState(false)

  if (!loading && session) return <Navigate to="/dashboard" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }
    if (!orgName.trim()) {
      setError('El nombre de la organización es obligatorio.')
      return
    }

    setSubmitting(true)
    const { error: err, needsVerification: nv } = await signUp(email, password, orgName.trim())
    setSubmitting(false)

    if (err) {
      setError(err)
      return
    }
    if (nv) {
      setNeedsVerification(true)
      return
    }
    // Session created → AuthContext will load tenant → ProtectedRoute shows Onboarding
    navigate('/dashboard', { replace: true })
  }

  // ── Email verification pending screen ────────────────────────────────────
  if (needsVerification) {
    return (
      <div className="min-h-screen bg-[#F5EFE6] dark:bg-[#0C0A08] flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-500 mb-6">
            <i className="ti ti-mail-check text-white text-3xl" />
          </div>
          <h1 className="font-display text-2xl font-semibold text-sand-900 dark:text-night-50 mb-2">
            Revisa tu correo
          </h1>
          <p className="text-sm text-sand-900/60 dark:text-night-50/60 mb-6 leading-relaxed">
            Te hemos enviado un enlace de verificación a <strong>{email}</strong>.
            Haz clic en el enlace para activar tu cuenta.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm font-medium text-[#C9973A] hover:underline"
          >
            <i className="ti ti-arrow-left text-sm" />
            Volver al inicio de sesión
          </Link>
        </div>
      </div>
    )
  }

  // ── Signup form ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F5EFE6] dark:bg-[#0C0A08] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex flex-col items-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#C9973A] mb-4">
              <i className="ti ti-wave-sine text-white text-2xl" />
            </div>
          </Link>
          <h1 className="font-display text-2xl font-semibold text-sand-900 dark:text-night-50">
            Crear cuenta
          </h1>
          <p className="text-sm text-sand-900/50 dark:text-night-50/50 mt-1">
            Empieza tu prueba gratuita de 14 días
          </p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-[#1A1510] rounded-2xl border border-black/8 dark:border-white/8 shadow-sm p-6 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Org name */}
            <div>
              <label className="block text-xs font-medium text-sand-900/60 dark:text-night-50/60 mb-1.5">
                Nombre de la organización
              </label>
              <div className="relative">
                <i className="ti ti-building absolute left-3 top-1/2 -translate-y-1/2 text-sand-900/30 dark:text-night-50/30 text-base pointer-events-none" />
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  required
                  placeholder="Acme Seguros S.L."
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg text-sm bg-[#F5EFE6] dark:bg-[#0C0A08] border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-[#C9973A]/30 transition-all"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-sand-900/60 dark:text-night-50/60 mb-1.5">
                Email corporativo
              </label>
              <div className="relative">
                <i className="ti ti-at absolute left-3 top-1/2 -translate-y-1/2 text-sand-900/30 dark:text-night-50/30 text-base pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="tu@empresa.com"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg text-sm bg-[#F5EFE6] dark:bg-[#0C0A08] border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-[#C9973A]/30 transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-sand-900/60 dark:text-night-50/60 mb-1.5">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Mínimo 8 caracteres"
                className="w-full px-3 py-2.5 rounded-lg text-sm bg-[#F5EFE6] dark:bg-[#0C0A08] border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-[#C9973A]/30 transition-all"
              />
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-xs font-medium text-sand-900/60 dark:text-night-50/60 mb-1.5">
                Confirmar contraseña
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                placeholder="Repite la contraseña"
                className="w-full px-3 py-2.5 rounded-lg text-sm bg-[#F5EFE6] dark:bg-[#0C0A08] border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-[#C9973A]/30 transition-all"
              />
            </div>

            {error && (
              <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2 flex items-start gap-2">
                <i className="ti ti-alert-circle text-sm flex-shrink-0 mt-0.5" />
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-xl bg-[#C9973A] text-white font-semibold text-sm hover:bg-[#b8832e] active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting
                ? <><i className="ti ti-loader-2 animate-spin" /> Creando cuenta…</>
                : 'Crear cuenta gratis'
              }
            </button>
          </form>

          {/* Legal */}
          <p className="text-[11px] text-center text-sand-900/30 dark:text-night-50/30 leading-relaxed">
            Al registrarte aceptas nuestros{' '}
            <a href="#" className="underline hover:text-[#C9973A]">Términos de servicio</a>
            {' '}y{' '}
            <a href="#" className="underline hover:text-[#C9973A]">Política de privacidad</a>.
          </p>
        </div>

        {/* Login link */}
        <p className="text-center text-sm text-sand-900/50 dark:text-night-50/50 mt-6">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="font-medium text-[#C9973A] hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
