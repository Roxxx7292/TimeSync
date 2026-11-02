-- Run in the SQL Editor of the intended Supabase project.
create table if not exists public.timesync_meetings (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200),
  starts_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes in (30, 60, 90, 120)),
  location text not null default '' check (length(location) <= 500),
  notes text not null default '' check (length(notes) <= 10000),
  zones jsonb not null default '[]'::jsonb check (jsonb_typeof(zones) = 'array'),
  created_at timestamptz not null default now()
);
alter table public.timesync_meetings enable row level security;
create index if not exists timesync_meetings_user_starts_idx on public.timesync_meetings (user_id, starts_at desc);
revoke all on public.timesync_meetings from anon, authenticated;
grant usage on schema public to authenticated;
grant select, insert on public.timesync_meetings to authenticated;
grant usage, select on sequence public.timesync_meetings_id_seq to authenticated;
create policy "Users can read their own meetings" on public.timesync_meetings for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can create their own meetings" on public.timesync_meetings for insert to authenticated with check ((select auth.uid()) = user_id);

-- Visitors may only submit form fields, never read or change existing records.
grant usage on schema public to anon;
grant insert (title, starts_at, duration_minutes, location, notes, zones) on public.timesync_meetings to anon;
grant usage on sequence public.timesync_meetings_id_seq to anon;
create policy "Visitors can submit meetings" on public.timesync_meetings for insert to anon with check (user_id is null);
