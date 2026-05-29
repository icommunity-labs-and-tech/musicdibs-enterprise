# MusicDibs Enterprise

> AI-powered emotional marketing campaigns at scale. Subdomain: `enterprise.musicdibs.com`

## Stack

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS
- **Backend**: Supabase (auth + DB + storage)
- **AI**: KIE.ai (primary) + Suno API (fallback)
- **Email delivery**: Mailerlite
- **State**: Zustand + TanStack Query
- **Fonts**: Fraunces (display) · Syne (UI) · JetBrains Mono (code)

## Getting started

```bash
npm install
cp .env.example .env   # Fill in your keys
npm run dev            # http://localhost:5173
```

## Structure

```
src/
  pages/          # Route-level components
    Dashboard.tsx
    Campaigns.tsx
    CampaignBuilder.tsx   # 6-step wizard
    GenerationQueue.tsx   # Real-time asset progress
    Analytics.tsx         # Open rate, play rate, ROI
    Settings.tsx
  components/
    layout/       # AppShell, Sidebar, Topbar
  store/
    campaignStore.ts
    themeStore.ts
  lib/
    supabase.ts
    utils.ts
```

## Pricing model

€0.19 / contact for AI asset generation (song + visualizer)

## Deployment

Targets `enterprise.musicdibs.com` — separate Vercel project from `musicdibs.com`.
