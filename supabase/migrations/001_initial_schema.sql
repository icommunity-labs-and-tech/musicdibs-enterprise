-- ============================================================
-- MusicDibs Enterprise — Initial Schema
-- Multi-tenant: organizations → org_members → campaigns → jobs
-- ============================================================

-- ─── Extensions ──────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─── Organizations ───────────────────────────────────────────
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique not null,
  vertical    text,               -- insurance, telecom, ecommerce, banking, retail
  plan        text not null default 'starter',  -- starter, growth, enterprise
  logo_url    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.organizations is 'Tenant organizations. One per enterprise client.';

-- ─── Org Members ─────────────────────────────────────────────
create table public.org_members (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'member',   -- owner, admin, member
  created_at  timestamptz not null default now(),
  unique (org_id, user_id)
);

comment on table public.org_members is 'Maps auth.users to organizations with role.';

-- ─── Campaigns ───────────────────────────────────────────────
create table public.campaigns (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id) on delete cascade,
  created_by       uuid references auth.users(id) on delete set null,

  -- Identity
  name             text not null,
  type             text not null,   -- birthday, anniversary, winback, seasonal, loyalty
  vertical         text not null,   -- insurance, telecom, ecommerce, banking, retail
  status           text not null default 'draft',  -- draft, generating, active, paused, completed
  goal             text,            -- engagement, retention, upsell, reactivation

  -- Audience
  crm_source       text default 'salesforce',
  total_contacts   integer not null default 0,
  generated_count  integer not null default 0,

  -- Metrics (updated after send)
  open_rate        numeric(5,2),
  play_rate        numeric(5,2),
  completion_rate  numeric(5,2),
  click_rate       numeric(5,2),
  cost             numeric(10,2) not null default 0,

  -- AI config
  ai_prompt        text,
  tone             text not null default 'warm',   -- warm, professional, fun, emotional
  language         text not null default 'es',
  ai_provider      text not null default 'kie.ai', -- kie.ai, suno
  music_style      text not null default 'orchestral',
  duration         integer not null default 60,    -- seconds

  -- Delivery
  delivery_channel text not null default 'email',  -- email, whatsapp
  subject          text,
  trigger_type     text not null default 'birthday', -- birthday, day_before, week_before
  trigger_time     text not null default '09:00',

  -- Timestamps
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  launched_at      timestamptz
);

comment on table public.campaigns is 'Email/WhatsApp AI music campaigns. One row per campaign.';

-- ─── Generation Jobs ─────────────────────────────────────────
create table public.generation_jobs (
  id                uuid primary key default gen_random_uuid(),
  campaign_id       uuid not null references public.campaigns(id) on delete cascade,
  org_id            uuid not null references public.organizations(id) on delete cascade,

  -- Contact data
  contact_name      text not null,
  contact_email     text,
  contact_metadata  jsonb not null default '{}',  -- CRM fields (birthday, policy, years, etc.)

  -- Job state
  status            text not null default 'queued', -- queued, processing, done, error
  duration_ms       integer,
  asset_url         text,       -- final song/visualizer URL
  error_msg         text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.generation_jobs is 'Per-contact AI generation jobs for a campaign.';

-- ─── Indexes ─────────────────────────────────────────────────
create index idx_campaigns_org_id       on public.campaigns(org_id);
create index idx_campaigns_status       on public.campaigns(status);
create index idx_generation_jobs_campaign on public.generation_jobs(campaign_id);
create index idx_generation_jobs_status  on public.generation_jobs(status);
create index idx_org_members_user_id    on public.org_members(user_id);

-- ─── updated_at triggers ─────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_organizations_updated_at
  before update on public.organizations
  for each row execute function public.handle_updated_at();

create trigger trg_campaigns_updated_at
  before update on public.campaigns
  for each row execute function public.handle_updated_at();

create trigger trg_generation_jobs_updated_at
  before update on public.generation_jobs
  for each row execute function public.handle_updated_at();

-- ─── Row Level Security ──────────────────────────────────────
alter table public.organizations    enable row level security;
alter table public.org_members      enable row level security;
alter table public.campaigns        enable row level security;
alter table public.generation_jobs  enable row level security;

-- Helper function: get all org_ids for the current user
create or replace function public.my_org_ids()
returns setof uuid language sql security definer stable as $$
  select org_id from public.org_members where user_id = auth.uid();
$$;

-- organizations: members can read their own orgs; owners/admins can update
create policy "org_select" on public.organizations
  for select using (id in (select public.my_org_ids()));

create policy "org_update" on public.organizations
  for update using (
    id in (
      select org_id from public.org_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- org_members: users see only their own memberships
create policy "org_members_select" on public.org_members
  for select using (user_id = auth.uid());

-- campaigns: all CRUD scoped to user's orgs
create policy "campaigns_select" on public.campaigns
  for select using (org_id in (select public.my_org_ids()));

create policy "campaigns_insert" on public.campaigns
  for insert with check (org_id in (select public.my_org_ids()));

create policy "campaigns_update" on public.campaigns
  for update using (org_id in (select public.my_org_ids()));

create policy "campaigns_delete" on public.campaigns
  for delete using (
    org_id in (
      select org_id from public.org_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- generation_jobs: scoped to user's orgs
create policy "jobs_select" on public.generation_jobs
  for select using (org_id in (select public.my_org_ids()));

create policy "jobs_insert" on public.generation_jobs
  for insert with check (org_id in (select public.my_org_ids()));

create policy "jobs_update" on public.generation_jobs
  for update using (org_id in (select public.my_org_ids()));

-- ─── Explicit Grants ─────────────────────────────────────────
-- Required from May 30, 2026: new Supabase projects no longer expose
-- public schema tables to the Data API automatically.
-- https://github.com/orgs/supabase/discussions/45329
--
-- anon: no access (all tables require authentication)
-- authenticated: scoped access controlled by RLS policies above
-- service_role: full access for backend/edge functions

grant select, insert, update, delete on public.organizations    to authenticated;
grant select, insert, update, delete on public.org_members      to authenticated;
grant select, insert, update, delete on public.campaigns        to authenticated;
grant select, insert, update, delete on public.generation_jobs  to authenticated;

grant all on public.organizations    to service_role;
grant all on public.org_members      to service_role;
grant all on public.campaigns        to service_role;
grant all on public.generation_jobs  to service_role;

-- ─── Realtime ────────────────────────────────────────────────
-- Enable realtime on generation_jobs so the queue page reacts live
alter publication supabase_realtime add table public.generation_jobs;
alter publication supabase_realtime add table public.campaigns;
