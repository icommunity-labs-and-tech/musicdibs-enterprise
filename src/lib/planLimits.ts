import type { TenantPlan } from './supabase'

// ── Limits ────────────────────────────────────────────────────────────────────
export interface PlanLimits {
  campaigns_per_month: number   // Infinity = unlimited
  contacts: number
  users: number
}

export const PLAN_LIMITS: Record<TenantPlan, PlanLimits> = {
  starter:      { campaigns_per_month: 5,        contacts: 10_000,   users: 1 },
  professional: { campaigns_per_month: 25,       contacts: 100_000,  users: 5 },
  enterprise:   { campaigns_per_month: Infinity, contacts: Infinity, users: Infinity },
}

export function getLimits(plan: TenantPlan | null | undefined): PlanLimits {
  return PLAN_LIMITS[plan ?? 'starter']
}

export function isUnlimited(value: number): boolean {
  return value === Infinity || value >= 999_999
}

/** Returns a formatted string like "5" or "Ilimitado" */
export function formatLimit(value: number): string {
  return isUnlimited(value) ? 'Ilimitado' : value.toLocaleString('es')
}

/** 0-100 usage percent, capped at 100 */
export function usagePercent(used: number, limit: number): number {
  if (isUnlimited(limit)) return 0
  return Math.min(100, Math.round((used / limit) * 100))
}

/** Returns 'ok' | 'warn' | 'exceeded' */
export function usageStatus(used: number, limit: number): 'ok' | 'warn' | 'exceeded' {
  if (isUnlimited(limit)) return 'ok'
  const pct = (used / limit) * 100
  if (pct >= 100) return 'exceeded'
  if (pct >= 80)  return 'warn'
  return 'ok'
}
