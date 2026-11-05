-- Personal planning workspaces. Teams are owner-managed rosters, not shared accounts.
create table public.timesync_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 cities jsonb not null default '[]' check (jsonb_typeof(cities)='array' and jsonb_array_length(cities) between 1 and 100),
 work_start time not null default '09:00', work_end time not null default '18:00',
 work_days smallint[] not null default '{1,2,3,4,5}' check (cardinality(work_days) between 1 and 7 and work_days <@ array[0,1,2,3,4,5,6]::smallint[]),
 revision integer not null default 1,
 updated_at timestamptz not null default now(), check (work_start <> work_end)
);
create table public.timesync_teams (
 id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (length(trim(name)) between 1 and 80), position integer not null default 0
);
create index timesync_teams_owner_idx on public.timesync_teams(owner_id);
create table public.timesync_team_members (
 id uuid primary key, team_id uuid not null references public.timesync_teams(id) on delete cascade,
 name text not null check (length(trim(name)) between 1 and 80),
 email text not null default '' check (length(email)<=254), timezone text not null check (length(timezone) between 1 and 100),
 work_start time not null default '09:00', work_end time not null default '18:00',
 work_days smallint[] not null default '{1,2,3,4,5}' check (cardinality(work_days) between 1 and 7 and work_days <@ array[0,1,2,3,4,5,6]::smallint[]),
 position integer not null default 0, check (work_start <> work_end)
);
create index timesync_team_members_team_idx on public.timesync_team_members(team_id);
alter table public.timesync_preferences enable row level security;
alter table public.timesync_teams enable row level security;
alter table public.timesync_team_members enable row level security;
revoke all on public.timesync_preferences, public.timesync_teams, public.timesync_team_members from anon, authenticated;
grant select, insert, update, delete on public.timesync_preferences, public.timesync_teams, public.timesync_team_members to authenticated;
create policy "Own preferences" on public.timesync_preferences to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy "Own teams" on public.timesync_teams to authenticated using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));
create policy "Own roster members" on public.timesync_team_members to authenticated
 using (team_id in (select id from public.timesync_teams where owner_id=(select auth.uid())))
 with check (team_id in (select id from public.timesync_teams where owner_id=(select auth.uid())));
create function public.save_timesync_workspace(p_state jsonb, p_expected_revision integer default 0)
returns integer language plpgsql security invoker set search_path='' as $$
declare v_uid uuid := auth.uid(); v_revision integer; v_team jsonb; v_member jsonb; v_position integer := 0; v_member_position integer;
begin
 if v_uid is null then raise exception '請先使用 Google 帳號登入'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::text,0));
 if jsonb_typeof(p_state->'teams') is distinct from 'array' or jsonb_array_length(p_state->'teams')>30 then raise exception '團隊資料格式錯誤'; end if;
 select revision into v_revision from public.timesync_preferences where user_id=v_uid for update;
 if coalesce(v_revision,0) <> p_expected_revision then raise exception '設定已由其他裝置更新，請重新載入雲端設定。'; end if;
 v_revision := coalesce(v_revision,0)+1;
 insert into public.timesync_preferences(user_id,cities,work_start,work_end,work_days,revision)
 values(v_uid,p_state->'cities',(p_state->'schedule'->>'start')::time,(p_state->'schedule'->>'end')::time,
 array(select jsonb_array_elements_text(p_state->'schedule'->'days'))::smallint[],v_revision)
 on conflict(user_id) do update set cities=excluded.cities,work_start=excluded.work_start,work_end=excluded.work_end,work_days=excluded.work_days,revision=excluded.revision,updated_at=now();
 delete from public.timesync_teams where owner_id=v_uid and id not in (select (t->>'id')::uuid from jsonb_array_elements(p_state->'teams') t);
 for v_team in select * from jsonb_array_elements(p_state->'teams') loop
  if jsonb_typeof(v_team->'members') is distinct from 'array' or jsonb_array_length(v_team->'members')>100 then raise exception '成員資料格式錯誤'; end if;
  insert into public.timesync_teams(id,owner_id,name,position) values((v_team->>'id')::uuid,v_uid,v_team->>'name',v_position)
  on conflict(id) do update set name=excluded.name,position=excluded.position;
  v_position:=v_position+1;
  delete from public.timesync_team_members where team_id=(v_team->>'id')::uuid;
  v_member_position:=0;
  for v_member in select * from jsonb_array_elements(v_team->'members') loop
   insert into public.timesync_team_members(id,team_id,name,email,timezone,work_start,work_end,work_days,position)
   values((v_member->>'id')::uuid,(v_team->>'id')::uuid,v_member->>'name',coalesce(v_member->>'email',''),v_member->>'zone',
   (v_member->'schedule'->>'start')::time,(v_member->'schedule'->>'end')::time,array(select jsonb_array_elements_text(v_member->'schedule'->'days'))::smallint[],v_member_position);
   v_member_position:=v_member_position+1;
  end loop;
 end loop;
 return v_revision;
end $$;
revoke all on function public.save_timesync_workspace(jsonb,integer) from public, anon;
grant execute on function public.save_timesync_workspace(jsonb,integer) to authenticated;
