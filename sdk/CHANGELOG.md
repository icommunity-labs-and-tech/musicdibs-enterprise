# Changelog

All notable changes to `@musicdibs/enterprise-sdk` will be documented here.

## [0.1.0] — 2026-05-27

### Added
- `MusicDibsClient` — main SDK class with configurable `apiKey` and `baseUrl`
- `client.campaigns.list(options?)` — paginated list with status filter
- `client.campaigns.create(input)` — create campaign (status: draft)
- `client.campaigns.get(id)` — fetch campaign + stats
- `client.campaigns.update(id, input)` — update draft campaign
- `client.campaigns.send(id)` — trigger immediate Mailerlite send
- `client.campaigns.stats(id)` — get performance stats
- `MusicDibsError` — typed error with HTTP status code
- Full TypeScript types: `Campaign`, `CampaignStats`, `CreateCampaignInput`, `UpdateCampaignInput`
- ESM + CJS dual build via tsup
