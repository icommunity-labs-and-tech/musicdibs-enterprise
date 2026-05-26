import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, type Profile, type Tenant } from '@/lib/supabase'

interface AuthContextType {
  session: Session | null
  user: User | null
  profile: Profile | null
  tenant: Tenant | null
  loading: boolean
  refreshTenant: () => Promise<void>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, orgName: string) => Promise<{ error: string | null; needsVerification: boolean }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

async function loadProfileAndTenant(
  userId: string,
  setProfile: (p: Profile | null) => void,
  setTenant: (t: Tenant | null) => void,
) {
  const { data: prof } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  setProfile(prof ?? null)

  if (prof) {
    const { data: ten } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', prof.tenant_id)
      .single()
    setTenant(ten ?? null)
  } else {
    setTenant(null)
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [loading, setLoading] = useState(true)

  // ── Refresh tenant from DB (called after Stripe checkout) ──────────────────
  const refreshTenant = useCallback(async () => {
    if (!profile?.tenant_id) return
    const { data } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', profile.tenant_id)
      .single()
    if (data) setTenant(data as Tenant)
  }, [profile?.tenant_id])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) {
        loadProfileAndTenant(s.user.id, setProfile, setTenant).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) {
        loadProfileAndTenant(s.user.id, setProfile, setTenant)
      } else {
        setProfile(null)
        setTenant(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // ── Realtime: listen for tenant plan/status changes (e.g. Stripe webhook) ──
  useEffect(() => {
    if (!profile?.tenant_id) return

    const channel = supabase
      .channel(`tenant-${profile.tenant_id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tenants',
          filter: `id=eq.${profile.tenant_id}`,
        },
        (payload) => {
          setTenant(payload.new as Tenant)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.tenant_id])

  // ── Refresh tenant on window focus (catches Stripe redirect) ───────────────
  useEffect(() => {
    const onFocus = () => { if (profile?.tenant_id) refreshTenant() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [profile?.tenant_id, refreshTenant])

  async function signUp(email: string, password: string, orgName: string) {
    const slug = orgName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
      + '-' + Math.random().toString(36).slice(2, 7)

    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return { error: error.message, needsVerification: false }

    const user = data.user
    if (!user) return { error: 'No user returned', needsVerification: false }

    // If session returned immediately (email confirmation disabled), create tenant + profile
    if (data.session) {
      const { data: tenant, error: tErr } = await supabase
        .from('tenants')
        .insert({ name: orgName || email.split('@')[0], slug, plan: 'starter', setup_complete: false })
        .select()
        .single()

      if (tErr) return { error: tErr.message, needsVerification: false }

      const { error: pErr } = await supabase
        .from('profiles')
        .insert({ id: user.id, tenant_id: tenant.id, full_name: null, role: 'admin' })

      if (pErr) return { error: pErr.message, needsVerification: false }
    }

    // If no session, email confirmation is required
    return { error: null, needsVerification: !data.session }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, user, profile, tenant, loading, refreshTenant, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
