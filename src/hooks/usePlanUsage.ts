import { useQuery } from '@tanstack/react-query'
import { startOfMonth, endOfMonth } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { getLimits, usageStatus, type PlanLimits } from '@/lib/planLimits'
import type { TenantPlan } from '@/lib/supabase'

export interface PlanUsage {
  limits: PlanLimits
  used: { campaigns_this_month: number; contacts: number; users: number }
  status: { campaigns: 'ok' | 'warn' | 'exceeded'; contacts: 'ok' | 'warn' | 'exceeded'; users: 'ok' | 'warn' | 'exceeded' }
  canCreateCampaign: boolean
  canImportContacts: (toAdd: number) => boolean
  canInviteUser: boolean
  isLoading: boolean
}

export function usePlanUsage(tenantId: string | undefined, plan: TenantPlan | null | undefined): PlanUsage {
  const limits = getLimits(plan)

  const { data, isLoading } = useQuery({
    queryKey: ['plan_usage', tenantId],
    enabled: !!tenantId,
    staleTime: 30_000,
    queryFn: async () => {
      const now = new Date()
      const monthStart = startOfMonth(now).toISOString()
      const monthEnd   = endOfMonth(now).toISOString()

      const [campsRes, contactsRes, usersRes] = await Promise.all([
        supabase
          .from('campaigns')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId!)
          .gte('created_at', monthStart)
          .lte('created_at', monthEnd),
        supabase
          .from('contacts')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId!),
        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId!),
      ])

      return {
        campaigns_this_month: campsRes.count ?? 0,
        contacts:             contactsRes.count ?? 0,
        users:                usersRes.count ?? 0,
      }
    },
  })

  const used = data ?? { campaigns_this_month: 0, contacts: 0, users: 0 }

  const campStatus     = usageStatus(used.campaigns_this_month, limits.campaigns_per_month)
  const contactStatus  = usageStatus(used.contacts, limits.contacts)
  const userStatus     = usageStatus(used.users, limits.users)

  return {
    limits,
    used,
    status: { campaigns: campStatus, contacts: contactStatus, users: userStatus },
    canCreateCampaign:  campStatus !== 'exceeded',
    canImportContacts:  (toAdd: number) => usageStatus(used.contacts + toAdd, limits.contacts) !== 'exceeded',
    canInviteUser:      userStatus !== 'exceeded',
    isLoading,
  }
}
