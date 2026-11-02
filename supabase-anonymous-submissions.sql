-- Allow direct form submissions without visitor accounts.
alter table public.timesync_meetings alter column user_id drop not null;
grant usage on schema public to anon;
revoke all on public.timesync_meetings from anon;
grant insert (title, starts_at, duration_minutes, location, notes, zones) on public.timesync_meetings to anon;
grant usage on sequence public.timesync_meetings_id_seq to anon;
create policy "Visitors can submit meetings" on public.timesync_meetings
 for insert to anon with check (user_id is null);
