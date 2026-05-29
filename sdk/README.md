# @musicdibs/enterprise-sdk

Official SDK for MusicDibs Enterprise — programmatically create and send AI-powered audio email campaigns.

## Installation

```bash
npm install @musicdibs/enterprise-sdk
# or
yarn add @musicdibs/enterprise-sdk
```

## Quick start

```typescript
import MusicDibsClient from '@musicdibs/enterprise-sdk'

const client = new MusicDibsClient({ apiKey: 'sk_live_...' })

// Create a campaign
const campaign = await client.campaigns.create({
  name: 'Renovación de póliza Q4',
  subject: 'Tu renovación está lista',
  goal: 'Incrementar renovaciones automaticas un 20%',
  vertical: 'insurance',
  language: 'es',
  tone: 'professional',
  ai_prompt: 'Crea un mensaje cálido recordando la renovación',
  total_contacts: 1500,
})

// Send it (must be status: ready after generation)
await client.campaigns.send(campaign.id)

// Get stats after sending
const stats = await client.campaigns.stats(campaign.id)
console.log(`Open rate: ${(stats.emails_opened / stats.emails_sent * 100).toFixed(1)}%`)
```

## API Reference

### `client.campaigns.list(options?)`
List campaigns with pagination. Options: `page`, `limit`, `status`.

### `client.campaigns.create(input)`
Create a new campaign (status: `draft`). See `CreateCampaignInput` for all fields.

### `client.campaigns.get(id)`
Get a single campaign including stats.

### `client.campaigns.update(id, input)`
Update a draft campaign.

### `client.campaigns.send(id)`
Trigger immediate send via Mailerlite. Campaign must be `status: ready`.

### `client.campaigns.stats(id)`
Get performance stats for a sent campaign.
