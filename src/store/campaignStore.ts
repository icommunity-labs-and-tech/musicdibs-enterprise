import { create } from 'zustand'

export type CampaignStatus = 'draft' | 'generating' | 'active' | 'paused' | 'completed'
export type CampaignType = 'birthday' | 'anniversary' | 'winback' | 'seasonal' | 'loyalty'
export type Vertical = 'insurance' | 'telecom' | 'ecommerce' | 'banking' | 'retail'

export interface Campaign {
  id: string
  name: string
  type: CampaignType
  vertical: Vertical
  status: CampaignStatus
  totalContacts: number
  generatedCount: number
  openRate?: number
  playRate?: number
  cost: number
  createdAt: string
  launchedAt?: string
}

export interface CampaignDraft {
  step: number
  name: string
  type: CampaignType | ''
  vertical: Vertical | ''
  goal: string
  crmSource: string
  totalContacts: number
  aiPrompt: string
  tone: string
  language: string
  aiProvider: 'kie.ai' | 'suno'
  musicStyle: string
  duration: number
  deliveryChannel: 'email' | 'whatsapp'
  subject: string
  triggerType: string
  triggerTime: string
}

interface CampaignStore {
  campaigns: Campaign[]
  draft: CampaignDraft
  setCampaigns: (c: Campaign[]) => void
  updateDraft: (patch: Partial<CampaignDraft>) => void
  resetDraft: () => void
  nextStep: () => void
  prevStep: () => void
}

const defaultDraft: CampaignDraft = {
  step: 0,
  name: '',
  type: '',
  vertical: '',
  goal: '',
  crmSource: 'salesforce',
  totalContacts: 0,
  aiPrompt: '',
  tone: 'warm',
  language: 'es',
  aiProvider: 'kie.ai',
  musicStyle: 'orchestral',
  duration: 60,
  deliveryChannel: 'email',
  subject: '',
  triggerType: 'birthday',
  triggerTime: '09:00',
}

// Seed data
const seedCampaigns: Campaign[] = [
  {
    id: 'c1',
    name: 'Feliz Cumpleaños Premium — Asegurados 2026',
    type: 'birthday',
    vertical: 'insurance',
    status: 'active',
    totalContacts: 1247,
    generatedCount: 1247,
    openRate: 68.4,
    playRate: 41.2,
    cost: 236.93,
    createdAt: '2026-05-20',
    launchedAt: '2026-05-22',
  },
  {
    id: 'c2',
    name: 'Renovación Aniversario — Clientes 5 años',
    type: 'anniversary',
    vertical: 'insurance',
    status: 'generating',
    totalContacts: 389,
    generatedCount: 231,
    cost: 73.91,
    createdAt: '2026-05-24',
  },
  {
    id: 'c3',
    name: 'Win-back Q2 — Churned Telecom',
    type: 'winback',
    vertical: 'telecom',
    status: 'draft',
    totalContacts: 2800,
    generatedCount: 0,
    cost: 0,
    createdAt: '2026-05-25',
  },
]

export const useCampaignStore = create<CampaignStore>((set) => ({
  campaigns: seedCampaigns,
  draft: defaultDraft,
  setCampaigns: (campaigns) => set({ campaigns }),
  updateDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
  resetDraft: () => set({ draft: defaultDraft }),
  nextStep: () => set((s) => ({ draft: { ...s.draft, step: Math.min(s.draft.step + 1, 5) } })),
  prevStep: () => set((s) => ({ draft: { ...s.draft, step: Math.max(s.draft.step - 1, 0) } })),
}))
