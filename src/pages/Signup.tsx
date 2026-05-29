import { useState, useEffect, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

export function Signup() {
  const { session, loading, signUp } = useAuth()
  const navigate = useNavigate()

  const [searchParams] = useSearchParams()
  const inviteToken = searchParams.get('token')

  const [orgName, setOrgName]       = useState('')
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [confirm, setConfirm]       = useState('')
  const [error, setError]           = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [needsVerification, setNeedsVerification] = useState(false)
  const [inviteInfo, setInviteInfo]   = useState<{ tenant_name: string; role: string; invited_email: string } | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)

  // Pre-validate invitation token and pre-fill email
  useEffect(() => {
    if (!inviteToken) return
    supabase
      .from('tenant_invitations')
      .select('email, role, status, expires_at, tenants(name)')
      .eq('token', inviteToken)
      .eq('status', 'pending')
      .single()
      .then(({ data, error: e }) => {
        if (e || !data) {
          setInviteError('Esta invitación no es válida o ha expirado.')
          return
        }
        if (new Date(data.expires_at) < new Date()) {
          setInviteError('Esta invitación ha expirado.')
          return
        }
        const tenantName = (data.tenants as unknown as { name: string } | null)?.name ?? 'tu equipo'
        setInviteInfo({ tenant_name: tenantName, role: data.role, invited_email: data.email })
        setEmail(data.email)  // pre-fill email
      })
  }, [inviteToken])

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

    if (inviteToken && inviteInfo) {
      // Invited user flow: sign up then accept invitation
      const { data: authData, error: authErr } = await supabase.auth.signUp({ email, password })
      setSubmitting(false)
      if (authErr) { setError(authErr.message); return }

      const userId = authData.user?.id
      if (!userId) { setNeedsVerification(true); return }

      // Accept invitation — links user to tenant
      const { data: acceptData, error: acceptErr } = await supabase.functions.invoke('accept-invitation', {
        body: { token: inviteToken, user_id: userId },
      })
      if (acceptErr || acceptData?.error) {
        setError(acceptData?.error ?? 'Error al aceptar la invitación')
        return
      }

      if (authData.session) {
        navigate('/dashboard', { replace: true })
      } else {
        setNeedsVerification(true)
      }
      return
    }

    // Regular signup (create new org)
    if (!orgName.trim()) { setError('El nombre de la organización es obligatorio.'); setSubmitting(false); return }
    const { error: err, needsVerification: nv } = await signUp(email, password, orgName.trim())
    setSubmitting(false)

    if (err) { setError(err); return }
    if (nv)  { setNeedsVerification(true); return }
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
            {inviteInfo ? 'Aceptar invitación' : 'Crear cuenta'}
          </h1>
          <p className="text-sm text-sand-900/50 dark:text-night-50/50 mt-1">
            {inviteInfo
              ? <>Únete a <strong>{inviteInfo.tenant_name}</strong> como {inviteInfo.role}</>
              : 'Empieza tu prueba gratuita de 14 días'}
          </p>
        </div>

        {/* Invalid invite error */}
        {inviteError && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30">
            <i className="ti ti-alert-circle text-red-500 shrink-0" />
            <p className="text-sm text-red-600 dark:text-red-400">{inviteError}</p>
          </div>
        )}

        {/* Invite info banner */}
        {inviteInfo && !inviteError && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-teal-50 dark:bg-teal-900/10 border border-teal-200 dark:border-teal-800/30">
            <i className="ti ti-mail-check text-teal-500 shrink-0 text-lg" />
            <div>
              <p className="text-sm font-medium text-sand-900 dark:text-night-50">Invitación válida</p>
              <p className="text-xs text-sand-900/60 dark:text-night-50/60">Accederás a <strong>{inviteInfo.tenant_name}</strong> con rol de <strong>{inviteInfo.role}</strong></p>
            </div>
          </div>
        )}

        {/* Card */}
        <div className="bg-white dark:bg-[#1A1510] rounded-2xl border border-black/8 dark:border-white/8 shadow-sm p-6 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Org name — hidden for invited users */}
            {!inviteInfo && (
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
                  required={!inviteInfo}
                  placeholder="Acme Seguros S.L."
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg text-sm bg-[#F5EFE6] dark:bg-[#0C0A08] border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-[#C9973A]/30 transition-all"
                />
              </div>
            </div>
            )}

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
