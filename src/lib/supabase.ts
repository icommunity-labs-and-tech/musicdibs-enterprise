import { createClient } from '@supabase/supabase-js'

// ─── Database types ────────────────────────────────────────────────────────
export type TenantPlan = 'starter' | 'professional' | 'enterprise'
export type CampaignStatus = 'draft' | 'queued' | 'generating' | 'ready' | 'sent' | 'archived'
export type JobStatus = 'queued' | 'processing' | 'done' | 'failed'
export type DeliveryChannel = 'email' | 'whatsapp'
export type AIProvider = 'kie.ai' | 'suno'

export interface Tenant {
  id: string
  name: string
  slug: string
  vertical: string | null
  plan: TenantPlan
  logo_url: string | null
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  tenant_id: string
  full_name: string | null
  role: 'admin' | 'manager' | 'analyst'
  avatar_url: string | null
  created_at: string
}

export interface Campaign {
  id: string
  tenant_id: string
  created_by: string | null
  name: string
  type: string
  vertical: string
  goal: string | null
  status: CampaignStatus
  total_contacts: number
  ai_prompt: string | null
  tone: string | null
  language: string
  ai_provider: AIProvider
  music_style: string | null
  duration_seconds: number
  delivery_channel: DeliveryChannel
  subject: string | null
  trigger_type: string | null
  trigger_time: string | null
  cost_estimate: number | null
  sent_at: string | null
  created_at: string
  updated_at: string
}

export interface GenerationJob {
  id: string
  campaign_id: string
  tenant_id: string
  status: JobStatus
  provider: AIProvider
  prompt: string | null
  style: string | null
  duration_seconds: number
  output_url: string | null
  output_metadata: Record<string, unknown> | null
  error_message: string | null
  attempts: number
  queued_at: string
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface CampaignStats {
  id: string
  campaign_id: string
  tenant_id: string
  emails_sent: number
  emails_opened: number
  emails_clicked: number
  unsubscribes: number
  cost_actual: number
  updated_at: string
}

export interface Database {
  public: {
    Tables: {
      tenants:         { Row: Tenant;         Insert: Omit<Tenant, 'id' | 'created_at' | 'updated_at'> }
      profiles:        { Row: Profile;        Insert: Omit<Profile, 'created_at'> }
      campaigns:       { Row: Campaign;       Insert: Omit<Campaign, 'id' | 'created_at' | 'updated_at'> }
      generation_jobs: { Row: GenerationJob;  Insert: Omit<GenerationJob, 'id' | 'created_at' | 'queued_at'> }
      campaign_stats:  { Row: CampaignStats;  Insert: Omit<CampaignStats, 'id'> }
    }
  }
}

// ─── Client ────────────────────────────────────────────────────────────────
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[supabase] env vars not set — running in demo mode')
}

export const supabase = createClient<Database>(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder'
)
