import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/store/toastStore'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────
type Role = 'admin' | 'member' | 'viewer'

interface Member {
  id: string
  full_name: string | null
  role: Role
  created_at: string
  email?: string
}

interface Invitation {
  id: string
  email: string
  role: Role
  status: string
  created_at: string
  expires_at: string
  token: string
  invited_by_name?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const ROLE_CONFIG: Record<Role, { label: string; desc: string; cls: string }> = {
  admin:  { label: 'Admin',    desc: 'Acceso total, puede invitar y gestionar el equipo', cls: 'bg-gold-50 text-gold-700 dark:bg-gold-900/20 dark:text-gold-400' },
  member: { label: 'Miembro',  desc: 'Puede crear y gestionar campañas y contactos',      cls: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' },
  viewer: { label: 'Lector',   desc: 'Solo puede ver campañas y analytics',               cls: 'bg-sand-100 text-sand-900/60 dark:bg-night-700 dark:text-night-50/60' },
}

function avatarInitials(m: Member) {
  if (m.full_name) {
    const parts = m.full_name.trim().split(' ')
    return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : parts[0].slice(0, 2).toUpperCase()
  }
  return m.email?.[0]?.toUpperCase() ?? '?'
}

const AVATAR_GRADIENTS = [
  'from-violet-400 to-purple-600',
  'from-blue-400 to-cyan-600',
  'from-emerald-400 to-teal-600',
  'from-gold-300 to-gold-500',
  'from-rose-400 to-pink-600',
]

// ── Role selector ────────────────────────────────────────────────────────────
function RoleSelect({ value, onChange, disabled }: { value: Role; onChange: (r: Role) => void; disabled?: boolean }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as Role)}
      disabled={disabled}
      className="text-xs px-2 py-1 rounded-lg border border-sand-200 dark:border-night-600 bg-white dark:bg-night-700 text-sand-900 dark:text-night-50 focus:outline-none focus:ring-2 focus:ring-gold-400/50 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {(Object.keys(ROLE_CONFIG) as Role[]).map(r => (
        <option key={r} value={r}>{ROLE_CONFIG[r].label}</option>
      ))}
    </select>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function Team() {
  const { tenant, profile } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()

  const isAdmin = profile?.role === 'admin'

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole]   = useState<Role>('member')
  const [inviteLink, setInviteLink]   = useState<string | null>(null)
  const [copiedToken, setCopiedToken] = useState(false)

  // ── Members query ──────────────────────────────────────────────────────────
  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ['team_members', tenant?.id],
    enabled: !!tenant?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, created_at')
        .eq('tenant_id', tenant!.id)
        .order('created_at')
      if (error) throw error

      // Fetch emails from auth (only works for admins via service role — fallback to id)
      return (data ?? []) as Member[]
    },
  })

  // ── Invitations query ──────────────────────────────────────────────────────
  const { data: invitations = [] } = useQuery<Invitation[]>({
    queryKey: ['team_invitations', tenant?.id],
    enabled: !!tenant?.id && isAdmin,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_invitations')
        .select('id, email, role, status, created_at, expires_at, token')
        .eq('tenant_id', tenant!.id)
        .in('status', ['pending', 'revoked'])
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return (data ?? []) as Invitation[]
    },
  })

  const pendingInvites = invitations.filter(i => i.status === 'pending')

  // ── Mutations ──────────────────────────────────────────────────────────────
  const updateRole = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: Role }) => {
      const { error } = await supabase.from('profiles').update({ role }).eq('id', memberId)
      if (error) throw error
    },
    onSuccess: (_, { role }) => {
      qc.invalidateQueries({ queryKey: ['team_members'] })
      toast.success('Rol actualizado', ROLE_CONFIG[role].label)
    },
    onError: (e: Error) => toast.error('Error al cambiar rol', e.message),
  })

  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      // Remove from tenant by nulling tenant_id (keeps auth account)
      const { error } = await supabase.from('profiles').update({ tenant_id: null as unknown as string }).eq('id', memberId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team_members'] })
      toast.success('Miembro eliminado del equipo')
    },
    onError: (e: Error) => toast.error('Error', e.message),
  })

  const revokeInvite = useMutation({
    mutationFn: async (invId: string) => {
      const { error } = await supabase.from('tenant_invitations').update({ status: 'revoked' }).eq('id', invId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team_invitations'] })
      toast.success('Invitación revocada')
    },
    onError: (e: Error) => toast.error('Error', e.message),
  })

  const sendInvite = useMutation({
    mutationFn: async () => {
      if (!inviteEmail.trim() || !inviteEmail.includes('@')) throw new Error('Email inválido')
      const { data, error } = await supabase.functions.invoke('invite-member', {
        body: { email: inviteEmail.toLowerCase().trim(), role: inviteRole },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return data as { invite_url: string; token: string; email_sent: boolean }
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['team_invitations'] })
      setInviteLink(data.invite_url)
      setInviteEmail('')
      toast.success(
        data.email_sent ? 'Invitación enviada por email' : 'Enlace de invitación generado',
        data.email_sent ? `Se notificó a ${inviteEmail}` : 'Copia el enlace y compártelo'
      )
    },
    onError: (e: Error) => toast.error('Error al invitar', e.message),
  })

  async function copyLink(url: string) {
    await navigator.clipboard.writeText(url)
    setCopiedToken(true)
    setTimeout(() => setCopiedToken(false), 2000)
    toast.success('Enlace copiado', 'Compártelo con el invitado')
  }

  if (!tenant || !profile) return null

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-sand-900 dark:text-night-50">Equipo</h1>
        <p className="text-sm text-sand-900/50 dark:text-night-50/50 mt-1">
          Gestiona los miembros de <span className="font-medium">{tenant.name}</span>
        </p>
      </div>

      {/* Invite section — admins only */}
      {isAdmin && (
        <div className="bg-white dark:bg-night-800 rounded-2xl border border-sand-200 dark:border-night-700 p-6">
          <h2 className="font-display text-base font-semibold text-sand-900 dark:text-night-50 mb-4 flex items-center gap-2">
            <i className="ti ti-user-plus text-gold-500" />
            Invitar nuevo miembro
          </h2>

          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-sand-900/60 dark:text-night-50/60 mb-1.5">Email</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendInvite.mutate()}
                placeholder="colega@empresa.es"
                className="w-full px-3 py-2 text-sm rounded-xl border border-sand-200 dark:border-night-600 bg-white dark:bg-night-700 text-sand-900 dark:text-night-50 focus:outline-none focus:ring-2 focus:ring-gold-400/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-sand-900/60 dark:text-night-50/60 mb-1.5">Rol</label>
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as Role)}
                className="px-3 py-2 text-sm rounded-xl border border-sand-200 dark:border-night-600 bg-white dark:bg-night-700 text-sand-900 dark:text-night-50 focus:outline-none focus:ring-2 focus:ring-gold-400/50"
              >
                {(Object.keys(ROLE_CONFIG) as Role[]).map(r => (
                  <option key={r} value={r}>{ROLE_CONFIG[r].label}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => sendInvite.mutate()}
              disabled={!inviteEmail.trim() || sendInvite.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm bg-sand-900 dark:bg-night-50 text-white dark:text-night-900 hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {sendInvite.isPending
                ? <div className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />
                : <i className="ti ti-send text-sm" />}
              Invitar
            </button>
          </div>

          {/* Role descriptions */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            {(Object.keys(ROLE_CONFIG) as Role[]).map(r => (
              <div key={r} className={cn('rounded-xl px-3 py-2 text-xs', inviteRole === r ? 'ring-2 ring-gold-400/60' : 'opacity-60')}>
                <span className={cn('inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full mb-1', ROLE_CONFIG[r].cls)}>
                  {ROLE_CONFIG[r].label}
                </span>
                <p className="text-sand-900/60 dark:text-night-50/60 leading-tight">{ROLE_CONFIG[r].desc}</p>
              </div>
            ))}
          </div>

          {/* Invite link banner */}
          {inviteLink && (
            <div className="mt-4 flex items-center gap-3 p-3 bg-gold-50 dark:bg-gold-900/10 rounded-xl border border-gold-200 dark:border-gold-800/30">
              <i className="ti ti-link text-gold-600 dark:text-gold-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-sand-900 dark:text-night-50 mb-0.5">Enlace de invitación</p>
                <p className="text-[11px] text-sand-900/50 dark:text-night-50/50 truncate font-mono">{inviteLink}</p>
              </div>
              <button
                onClick={() => copyLink(inviteLink)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-gold-400 hover:bg-gold-500 text-night-900 font-medium shrink-0 transition-colors"
              >
                <i className={cn('ti text-sm', copiedToken ? 'ti-check' : 'ti-copy')} />
                {copiedToken ? 'Copiado' : 'Copiar'}
              </button>
              <button onClick={() => setInviteLink(null)} className="text-sand-900/30 hover:text-sand-900/60 dark:text-night-50/30 dark:hover:text-night-50/60">
                <i className="ti ti-x text-sm" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Team members */}
      <div className="bg-white dark:bg-night-800 rounded-2xl border border-sand-200 dark:border-night-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-sand-100 dark:border-night-700 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-sand-900 dark:text-night-50">
            Miembros <span className="text-sm font-normal text-sand-900/40 dark:text-night-50/40 ml-1">({members.length})</span>
          </h2>
        </div>

        <div className="divide-y divide-sand-100 dark:divide-night-700">
          {members.map((member, idx) => {
            const isSelf    = member.id === profile.id
            const canEdit   = isAdmin && !isSelf
            const gradient  = AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length]

            return (
              <div key={member.id} className="flex items-center gap-4 px-6 py-4 hover:bg-sand-50/50 dark:hover:bg-night-700/30 transition-colors">
                {/* Avatar */}
                <div className={cn('w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center shrink-0', gradient)}>
                  <span className="text-sm font-bold text-white">{avatarInitials(member)}</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-sand-900 dark:text-night-50 truncate">
                      {member.full_name ?? 'Usuario'}
                    </p>
                    {isSelf && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-sand-100 dark:bg-night-700 text-sand-900/50 dark:text-night-50/50">
                        Tú
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-sand-900/40 dark:text-night-50/40">
                    Desde {new Date(member.created_at).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}
                  </p>
                </div>

                {/* Role */}
                <div className="flex items-center gap-3">
                  {canEdit ? (
                    <RoleSelect
                      value={member.role}
                      onChange={role => updateRole.mutate({ memberId: member.id, role })}
                    />
                  ) : (
                    <span className={cn('text-[11px] font-semibold px-2 py-1 rounded-full', ROLE_CONFIG[member.role].cls)}>
                      {ROLE_CONFIG[member.role].label}
                    </span>
                  )}

                  {canEdit && (
                    <button
                      onClick={() => {
                        if (confirm(`¿Eliminar a ${member.full_name ?? 'este usuario'} del equipo?`))
                          removeMember.mutate(member.id)
                      }}
                      className="w-8 h-8 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center text-sand-900/20 dark:text-night-50/20 hover:text-red-500 transition-colors"
                    >
                      <i className="ti ti-user-minus text-sm" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Pending invitations — admins only */}
      {isAdmin && pendingInvites.length > 0 && (
        <div className="bg-white dark:bg-night-800 rounded-2xl border border-sand-200 dark:border-night-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-sand-100 dark:border-night-700">
            <h2 className="font-display text-base font-semibold text-sand-900 dark:text-night-50">
              Invitaciones pendientes
              <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400">
                {pendingInvites.length}
              </span>
            </h2>
          </div>

          <div className="divide-y divide-sand-100 dark:divide-night-700">
            {pendingInvites.map(inv => {
              const expired = new Date(inv.expires_at) < new Date()
              const daysLeft = Math.max(0, Math.ceil((new Date(inv.expires_at).getTime() - Date.now()) / 86_400_000))

              return (
                <div key={inv.id} className="flex items-center gap-4 px-6 py-4">
                  <div className="w-10 h-10 rounded-full bg-sand-100 dark:bg-night-700 flex items-center justify-center shrink-0">
                    <i className="ti ti-mail text-sand-900/30 dark:text-night-50/30" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-sand-900 dark:text-night-50 truncate">{inv.email}</p>
                    <p className="text-xs text-sand-900/40 dark:text-night-50/40">
                      {expired
                        ? <span className="text-red-500">Expirada</span>
                        : `Expira en ${daysLeft} día${daysLeft !== 1 ? 's' : ''}`
                      }
                    </p>
                  </div>

                  <span className={cn('text-[11px] font-semibold px-2 py-1 rounded-full', ROLE_CONFIG[inv.role].cls)}>
                    {ROLE_CONFIG[inv.role].label}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => copyLink(`${window.location.origin}/signup?token=${inv.token}`)}
                      title="Copiar enlace"
                      className="w-8 h-8 rounded-lg hover:bg-sand-100 dark:hover:bg-night-700 flex items-center justify-center text-sand-900/40 dark:text-night-50/40 hover:text-sand-900 dark:hover:text-night-50 transition-colors"
                    >
                      <i className="ti ti-link text-sm" />
                    </button>
                    <button
                      onClick={() => revokeInvite.mutate(inv.id)}
                      title="Revocar invitación"
                      className="w-8 h-8 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center text-sand-900/20 dark:text-night-50/20 hover:text-red-500 transition-colors"
                    >
                      <i className="ti ti-x text-sm" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Role legend */}
      <div className="bg-sand-50/50 dark:bg-night-800/50 rounded-2xl border border-sand-200 dark:border-night-700 p-5">
        <h3 className="text-xs font-semibold text-sand-900/50 dark:text-night-50/50 uppercase tracking-wide mb-3">Permisos por rol</h3>
        <div className="grid grid-cols-3 gap-4 text-xs">
          {[
            { feature: 'Ver campañas y analytics', admin: true, member: true, viewer: true },
            { feature: 'Crear y editar campañas',  admin: true, member: true, viewer: false },
            { feature: 'Enviar campañas',           admin: true, member: true, viewer: false },
            { feature: 'Gestionar contactos',       admin: true, member: true, viewer: false },
            { feature: 'Configuración de cuenta',   admin: true, member: false,viewer: false },
            { feature: 'Invitar miembros',          admin: true, member: false,viewer: false },
            { feature: 'Gestionar facturación',     admin: true, member: false,viewer: false },
            { feature: 'Acceso a APIs y webhooks',  admin: true, member: false,viewer: false },
          ].map(row => (
            <div key={row.feature} className="contents">
              {/* Feature name shown only in first column equivalent — use grid spanning */}
            </div>
          ))}
          {/* Header */}
          <div />
          {(['Admin', 'Miembro', 'Lector'] as const).map(label => (
            <div key={label} className={cn('text-center font-semibold', label === 'Admin' ? 'text-gold-600 dark:text-gold-400' : label === 'Miembro' ? 'text-blue-600 dark:text-blue-400' : 'text-sand-900/50 dark:text-night-50/50')}>
              {label}
            </div>
          ))}
          {[
            { feature: 'Ver campañas y analytics', admin: true, member: true, viewer: true },
            { feature: 'Crear / editar campañas',  admin: true, member: true, viewer: false },
            { feature: 'Enviar campañas',           admin: true, member: true, viewer: false },
            { feature: 'Gestionar contactos',       admin: true, member: true, viewer: false },
            { feature: 'Configuración + facturación', admin: true, member: false, viewer: false },
            { feature: 'Invitar miembros',          admin: true, member: false, viewer: false },
            { feature: 'APIs y webhooks',           admin: true, member: false, viewer: false },
          ].map(row => (
            <>
              <div key={`f-${row.feature}`} className="text-sand-900/60 dark:text-night-50/60 py-1">{row.feature}</div>
              {[row.admin, row.member, row.viewer].map((has, i) => (
                <div key={i} className="flex justify-center items-center py-1">
                  <i className={cn('ti text-base', has ? 'ti-check text-teal-500' : 'ti-minus text-sand-300 dark:text-night-600')} />
                </div>
              ))}
            </>
          ))}
        </div>
      </div>
    </div>
  )
}
