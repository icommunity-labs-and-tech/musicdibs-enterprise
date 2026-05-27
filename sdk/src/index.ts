/**
 * MusicDibs Enterprise SDK
 * Integrate AI-powered audio email campaigns into your platform.
 *
 * @example
 * import { MusicDibsClient } from '@musicdibs/enterprise-sdk'
 *
 * const client = new MusicDibsClient({ apiKey: 'sk_live_...' })
 * const campaign = await client.campaigns.create({ name: 'Renovación Q4', ... })
 */

export type CampaignStatus = 'draft' | 'queued' | 'generating' | 'ready' | 'sent' | 'archived'
export type ToneType = 'professional' | 'friendly' | 'urgent' | 'empathetic' | 'motivational'
export type DeliveryChannel = 'email' | 'whatsapp'
export type AIProvider = 'kie.ai' | 'suno'
export type Language = 'es' | 'en' | 'pt' | 'fr' | 'de' | 'it'

export interface Campaign {
  id: string
  tenant_id: string
  name: string
  subject: string | null
  goal: string | null
  status: CampaignStatus
  vertical: string | null
  language: Language
  tone: ToneType
  ai_prompt: string | null
  music_style: string | null
  duration_seconds: number
  delivery_channel: DeliveryChannel
  total_contacts: number
  cost_estimate: number
  sent_at: string | null
  mailerlite_campaign_id: string | null
  created_at: string
  updated_at: string
}

export interface CampaignStats {
  campaign_id: string
  emails_sent: number
  emails_opened: number
  emails_clicked: number
  unsubscribes: number
  bounces: number
  cost_actual: number | null
}

export interface CreateCampaignInput {
  name: string
  subject?: string
  goal?: string
  vertical?: string
  language?: Language
  tone?: ToneType
  ai_prompt?: string
  music_style?: string
  duration_seconds?: number
  delivery_channel?: DeliveryChannel
  total_contacts?: number
  ai_provider?: AIProvider
  type?: string
}

export interface UpdateCampaignInput extends Partial<CreateCampaignInput> {
  status?: CampaignStatus
}

export interface ListCampaignsOptions {
  page?: number
  limit?: number
  status?: CampaignStatus
}

export interface ListResponse<T> {
  data: T[]
  meta: { page: number; limit: number; total: number }
}

export interface MusicDibsClientOptions {
  apiKey: string
  baseUrl?: string
}

class MusicDibsError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message)
    this.name = 'MusicDibsError'
  }
}

class CampaignsResource {
  constructor(private client: MusicDibsClient) {}

  /** List campaigns with optional pagination and status filter */
  async list(options: ListCampaignsOptions = {}): Promise<ListResponse<Campaign>> {
    const params = new URLSearchParams()
    if (options.page)   params.set('page',   String(options.page))
    if (options.limit)  params.set('limit',  String(options.limit))
    if (options.status) params.set('status', options.status)
    return this.client.request<ListResponse<Campaign>>(`/campaigns?${params}`)
  }

  /** Create a new campaign (status: draft) */
  async create(input: CreateCampaignInput): Promise<Campaign> {
    const res = await this.client.request<{ data: Campaign }>('/campaigns', {
      method: 'POST',
      body: input,
    })
    return res.data
  }

  /** Get a single campaign by ID (includes stats if available) */
  async get(id: string): Promise<Campaign & { campaign_stats?: CampaignStats }> {
    const res = await this.client.request<{ data: Campaign & { campaign_stats?: CampaignStats } }>(`/campaigns/${id}`)
    return res.data
  }

  /** Update a campaign (only allowed when status is draft) */
  async update(id: string, input: UpdateCampaignInput): Promise<Campaign> {
    const res = await this.client.request<{ data: Campaign }>(`/campaigns/${id}`, {
      method: 'PATCH',
      body: input,
    })
    return res.data
  }

  /** Trigger immediate send via Mailerlite (campaign must be status: ready) */
  async send(id: string): Promise<{ success: boolean; mailerlite_campaign_id: string }> {
    return this.client.request(`/campaigns/${id}/send`, { method: 'POST' })
  }

  /** Get performance stats for a sent campaign */
  async stats(id: string): Promise<CampaignStats> {
    const res = await this.client.request<{ data: CampaignStats }>(`/campaigns/${id}/stats`)
    return res.data
  }
}

export class MusicDibsClient {
  readonly campaigns: CampaignsResource
  private readonly apiKey: string
  private readonly baseUrl: string

  constructor(options: MusicDibsClientOptions) {
    if (!options.apiKey) throw new MusicDibsError('apiKey is required', 0)
    this.apiKey  = options.apiKey
    this.baseUrl = (options.baseUrl ?? 'https://asolssebjyjyfbggraew.supabase.co/functions/v1/api').replace(/\/$/, '')
    this.campaigns = new CampaignsResource(this)
  }

  async request<T = unknown>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const res = await fetch(url, {
      method: options.method ?? 'GET',
      headers: {
        'X-API-Key':      this.apiKey,
        'Content-Type':   'application/json',
        'Accept':         'application/json',
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    })

    let data: unknown
    try { data = await res.json() } catch { data = {} }

    if (!res.ok) {
      const err = data as { error?: string }
      throw new MusicDibsError(err?.error ?? `HTTP ${res.status}`, res.status)
    }

    return data as T
  }
}

export { MusicDibsError }
export default MusicDibsClient
