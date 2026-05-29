# MusicDibs Enterprise — Lovable Master Prompt

---

## Context

You are working on **MusicDibs Enterprise**, a production B2B SaaS application that allows companies to create email marketing campaigns with AI-generated songs. The product is live and used by real tenants.

**Core concept:** Brief → AI Song Generation (KIE.ai V5) → Email Campaign (MailerLite/Brevo) → Analytics. Everything in one platform, turnkey.

**Repository:** React 18 + Vite + TypeScript + Tailwind CSS frontend, connected to Supabase (PostgreSQL, Edge Functions, Auth, Storage).

---

## Tech Stack (do not change)

```
Frontend:     React 18 + Vite + TypeScript
Styling:      Tailwind CSS (custom config, no component library)
Routing:      React Router v6
State:        Zustand + TanStack Query v5
Backend:      Supabase (PostgreSQL + RLS + Edge Functions + Auth + Storage)
Payments:     Stripe (via Supabase Edge Functions)
AI:           KIE.ai V5 (music generation, platform-managed API key)
Mailing:      MailerLite / Brevo (multi-provider adapter)
Icons:        Tabler Icons (class prefix: ti ti-*)
Fonts:        Fraunces (display/headings), Syne (body), JetBrains Mono (code/mono)
```

---

## Design System (extend, never replace)

```
Primary Gold:   #C9973A (main), #8C5E0A (dark), #f3d98a (light)
Primary Teal:   #2BB5A0 (main), #0D7A64 (dark), #5ee0cc (light)
Neutral Sand:   #F5EFE6 (50), #EDE5D8 (200), #9E8B72 (500)
Neutral Night:  #1A1510 (800), #0C0A08 (900) — dark mode surfaces
Dark mode:      Native via `dark` class on <html>
Radius:         rounded-xl (cards small), rounded-2xl (cards large), rounded-lg (inputs/buttons)
Borders:        border-black/6 dark:border-white/6 (subtle), border-black/10 (stronger)
Shadows:        Minimal — avoid heavy shadows, prefer borders + backgrounds
```

**Rules:**
- Do NOT introduce a third-party component library (no shadcn, no Radix, no MUI)
- Do NOT change color tokens — extend the Tailwind config if new values are needed
- Do NOT change the font stack
- DO maintain the existing dark mode behavior
- DO keep all existing Tabler icon usage consistent

---

## Existing Screens (ALL must be preserved with full functionality)

### Public
| Route | Component | Status |
|-------|-----------|--------|
| `/` | Landing.tsx | ✅ Complete |
| `/login` | Login.tsx | ✅ Complete |
| `/signup` | Signup.tsx | ✅ Complete |

### Tenant App
| Route | Component | Status |
|-------|-----------|--------|
| `/dashboard` | Dashboard.tsx | ✅ Complete |
| `/campaigns` | Campaigns.tsx | ✅ Complete |
| `/campaigns/new` | CampaignBuilder.tsx | ✅ Complete (5-step wizard) |
| `/campaigns/:id` | CampaignDetail.tsx | ✅ Complete |
| `/campaigns/:id/queue` | GenerationQueue.tsx | ✅ Complete |
| `/analytics` | Analytics.tsx | ✅ Complete |
| `/contacts` | Contacts.tsx | ✅ Complete |
| `/settings` | Settings.tsx | ✅ Complete |
| `/team` | Team.tsx | ✅ Complete |
| `/developers` | Developers.tsx | ✅ Complete |
| `/audit` | AuditLog.tsx | ✅ Complete |

### Superadmin
| Route | Component | Status |
|-------|-----------|--------|
| `/admin` | Admin.tsx | ✅ Complete (4 tabs) |
| `/admin/tenants/:id` | AdminTenantDetail.tsx | ✅ Complete (360 view) |

---

## Supabase Edge Functions (DO NOT TOUCH — backend only)

```
generate-campaign       KIE.ai music generation + Storage upload
send-campaign           MailerLite/Brevo multi-provider email send
sync-campaign-stats     Campaign metrics polling
mailerlite-webhook      Unsubscribe/spam webhook handler
impersonate-tenant      Superadmin magic link generation
create-billing-session  Stripe customer portal
stripe-webhook          Stripe event handler
```

---

## Environment Variables (values are secret — never hardcode)

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

---

## BEFORE YOU MODIFY ANYTHING — Audit First

**Step 1: Full application audit.** Before touching a single line of code:

1. Document every screen with a brief UX assessment (clarity, hierarchy, consistency)
2. Identify all components that are reused across screens
3. Map the user flows: Onboarding → First Campaign → Send → Analytics
4. List all empty states (are they helpful or just blank?)
5. Identify mobile breakpoint issues (which screens break below 768px?)
6. Flag any design inconsistencies (different button styles, spacing, modal patterns)
7. Note TypeScript errors or warnings if any
8. List all `TODO` or `FIXME` comments in the codebase

**Step 2: Produce a prioritized improvement plan** before implementing anything. Show it to me for approval.

**Step 3: Implement in phases**, smallest-risk changes first.

---

## Objectives (in priority order)

### P0 — Mobile-First Fixes (critical, affects all users)
- Sidebar: collapsible on mobile with hamburger trigger, overlay mode below 768px
- Tables (Campaigns, Contacts, Admin): horizontal scroll with fade-out indicator on edges, sticky first column
- CampaignBuilder wizard: each step full-width on mobile, step indicator as dots not text
- Touch targets minimum 44×44px on all interactive elements
- Modals: full-screen on mobile (no corner radius, no backdrop padding)

### P1 — CampaignBuilder UX (highest-impact screen)
- Add a right-side live preview panel on desktop: shows campaign name, selected list, AI prompt preview, estimated cost, and audio duration indicator
- Add autosave draft to localStorage — restore on revisit with a banner "Tienes un borrador guardado"
- Step validation inline (not just on Next click) — highlight empty required fields as user types
- Progress indicator: show which fields are complete across all 5 steps (e.g., "3/5 steps complete")
- Final review step before launch: summary card with all config, estimated cost, "Lanzar campaña" CTA

### P2 — Real-time Generation Feedback
- `CampaignDetail.tsx`: when status is `generating`, poll every 5s and show animated waveform placeholder where the audio player will appear
- Add a toast notification (already have toast system via `useToast`) when job status changes to `done` — "¡Tu canción está lista! Escúchala →"
- `GenerationQueue.tsx`: replace static table with live-updating progress bars per job

### P3 — Onboarding Completion Flow
- After signup, show a persistent setup checklist widget in the sidebar/dashboard until all critical steps are done:
  1. ✓ Configura tu proveedor de mailing (→ Settings)
  2. ✓ Importa tu primera lista de contactos (→ Contacts)
  3. ✓ Crea tu primera campaña (→ CampaignBuilder)
- Each step links directly to the relevant screen
- Progress ring showing X/3 complete
- Dismiss only when all steps are done

### P4 — Empty States & Error States
Every list screen needs a proper empty state with:
- Descriptive illustration or icon (use Tabler icons, large, muted)
- Clear headline explaining what's missing
- CTA button to create/add the first item
- Screens to fix: Campaigns (empty), Contacts (empty lists), Analytics (no data), GenerationQueue (no jobs)

### P5 — Form Validation & Feedback
- Inline validation on blur for all inputs (email format, required fields, API key format hints)
- Settings page: "Test connection" button for API keys that calls a lightweight validation
- Contact import: show row-level errors inline in the CSV preview table

### P6 — Design Consistency Pass
- Standardize all modal patterns: same header structure, same action button placement, same close behavior
- Standardize all table patterns: same header style, same empty state, same loading skeleton
- Standardize all form field patterns: same label style, same error message style, same helper text
- Audit and fix any hardcoded colors that should use the design token system

---

## Rules for Implementation

### DO
- Improve visual hierarchy and whitespace
- Add micro-animations for state changes (status badges, loading states)
- Improve keyboard navigation and accessibility (ARIA labels, focus rings)
- Add loading skeletons where data is being fetched
- Improve error messages to be actionable, not just "Error occurred"
- Use the existing toast system (`useToast`) for all notifications
- Keep all existing React Query keys and mutations intact
- Extend Tailwind config for new values, never use arbitrary values for design tokens

### DO NOT
- Remove any existing route or screen
- Change Supabase table names, column names, or Edge Function signatures
- Replace the existing auth flow
- Add new npm packages without justification (prefer native browser APIs and existing deps)
- Change the multitenancy model (tenant_id scoping on all queries)
- Modify `.env` files or expose secrets
- Change the Stripe integration
- Break the superadmin guard (`profile.is_superadmin` check)
- Alter the campaign status machine (`draft → queued → generating → ready → sent → archived`)

---

## Migration Strategy

1. **No big-bang rewrites.** Each screen is improved independently.
2. **Feature flags if needed.** If a UX change is significant, wrap it in a simple boolean flag.
3. **Mobile-first for new/changed components.** Write mobile styles first, then `md:` breakpoints.
4. **Test on dark mode.** Every change must work in both light and dark mode.
5. **Keep git history clean.** One logical change per commit.

---

## Deliverables Expected from Lovable

After the audit phase:
1. UX audit report (screen by screen)
2. Component inventory (reused vs. one-off)
3. Mobile issues list with screenshots or descriptions
4. Prioritized implementation plan with estimated effort per item
5. Approval checkpoint before any code changes

After approval:
- Incremental PRs per priority level (P0 first, then P1, etc.)
- Each PR includes before/after description
- No PR should break an existing feature

---

*MusicDibs Enterprise — built by iCommunity Labs*
*Production URL: managed via Vercel (auto-deploy from `main` branch)*
