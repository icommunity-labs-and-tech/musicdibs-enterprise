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
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  stripe_price_id: string | null
  stripe_status: 'inactive' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | null
  setup_complete: boolean
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  tenant_id: string
  full_name: string | null
  role: 'admin' | 'manager' | 'analyst'
  avatar_url: string | null
  is_superadmin: boolean
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
  contact_list_id: string | null
  cost_estimate: number | null
  mailerlite_campaign_id: string | null
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

export interface Contact {
  id: string
  tenant_id: string
  email: string
  first_name: string | null
  last_name: string | null
  company: string | null
  phone: string | null
  status: 'active' | 'unsubscribed' | 'bounced' | 'spam' | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface ContactList {
  id: string
  tenant_id: string
  name: string
  description: string | null
  color: string | null
  contact_count: number
  mailerlite_group_id: string | null
  created_at: string
  updated_at: string
}

export interface ContactListMember {
  id: string
  contact_id: string
  list_id: string
  added_at: string
}

export interface AuditLog {
  id: string
  tenant_id: string
  actor_id: string | null
  actor_email: string | null
  action: string
  resource_type: string
  resource_id: string | null
  resource_name: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface Notification {
  id: string
  tenant_id: string
  user_id: string | null
  type: string
  title: string
  body: string | null
  read: boolean
  href: string | null
  created_at: string
}

export interface TenantSetting {
  id: string
  tenant_id: string
  key: string
  value: string | null
  updated_at: string
}

export interface Database {
  public: {
    Tables: {
      tenants:              { Row: Tenant;              Insert: Omit<Tenant, 'id' | 'created_at' | 'updated_at'> }
      profiles:             { Row: Profile;             Insert: Omit<Profile, 'created_at'> }
      campaigns:            { Row: Campaign;            Insert: Omit<Campaign, 'id' | 'created_at' | 'updated_at'> }
      generation_jobs:      { Row: GenerationJob;       Insert: Omit<GenerationJob, 'id' | 'created_at' | 'queued_at'> }
      campaign_stats:       { Row: CampaignStats;       Insert: Omit<CampaignStats, 'id'> }
      contacts:             { Row: Contact;             Insert: Omit<Contact, 'id' | 'created_at' | 'updated_at'> }
      contact_lists:        { Row: ContactList;         Insert: Omit<ContactList, 'id' | 'created_at' | 'updated_at'> }
      contact_list_members: { Row: ContactListMember;   Insert: Omit<ContactListMember, 'id' | 'added_at'> }
      audit_log:            { Row: AuditLog;            Insert: Omit<AuditLog, 'id' | 'created_at'> }
      notifications:        { Row: Notification;        Insert: Omit<Notification, 'id' | 'created_at'> }
      tenant_settings:      { Row: TenantSetting;       Insert: Omit<TenantSetting, 'id' | 'updated_at'> }
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
