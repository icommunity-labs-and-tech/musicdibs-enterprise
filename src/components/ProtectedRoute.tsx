import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Onboarding } from '@/components/Onboarding'

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5EFE6] dark:bg-[#0C0A08]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-[#C9973A]/15 flex items-center justify-center">
          <i className="ti ti-loader-2 animate-spin text-[#C9973A] text-xl" />
        </div>
        <p className="text-xs text-sand-900/40 dark:text-night-50/40">Cargando…</p>
      </div>
    </div>
  )
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, tenant } = useAuth()
  if (loading) return <Spinner />
  if (!session) return <Navigate to="/login" replace />
  // New tenants that haven't completed setup see the onboarding wizard
  if (tenant && tenant.setup_complete === false) return <Onboarding />
  return <>{children}</>
}
