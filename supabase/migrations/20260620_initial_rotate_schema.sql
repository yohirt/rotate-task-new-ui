-- Rotate database schema for Supabase.
-- Run this in Supabase SQL Editor or with `supabase db push`.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'Europe/Warsaw',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'name')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

create table public.cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger cycles_set_updated_at
before update on public.cycles
for each row
execute function public.set_updated_at();

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cycle_id uuid references public.cycles(id) on delete cascade,
  title text not null,
  description text,
  icon text,
  target_minutes int not null default 30 check (target_minutes > 0),
  hidden boolean not null default false,
  archived boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger tasks_set_updated_at
before update on public.tasks
for each row
execute function public.set_updated_at();

create table public.subtasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null,
  target_minutes int not null default 10 check (target_minutes > 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger subtasks_set_updated_at
before update on public.subtasks
for each row
execute function public.set_updated_at();

create table public.time_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  subtask_id uuid references public.subtasks(id) on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_seconds int,
  local_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_session_time check (ended_at is null or ended_at >= started_at),
  constraint valid_session_duration check (
    duration_seconds is null or duration_seconds >= 0
  ),
  constraint completed_session_has_duration check (
    ended_at is null or duration_seconds is not null
  )
);

create trigger time_sessions_set_updated_at
before update on public.time_sessions
for each row
execute function public.set_updated_at();

create unique index one_active_session_per_user
on public.time_sessions(user_id)
where ended_at is null;

create table public.daily_task_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  local_date date not null,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, task_id, local_date)
);

create trigger daily_task_states_set_updated_at
before update on public.daily_task_states
for each row
execute function public.set_updated_at();

create table public.daily_subtask_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subtask_id uuid not null references public.subtasks(id) on delete cascade,
  local_date date not null,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, subtask_id, local_date)
);

create trigger daily_subtask_states_set_updated_at
before update on public.daily_subtask_states
for each row
execute function public.set_updated_at();

create or replace function public.validate_task_owner()
returns trigger
language plpgsql
as $$
begin
  if new.cycle_id is not null and not exists (
    select 1
    from public.cycles c
    where c.id = new.cycle_id
      and c.user_id = new.user_id
  ) then
    raise exception 'cycle_id must belong to the same user as task';
  end if;

  return new;
end;
$$;

create trigger tasks_validate_owner
before insert or update on public.tasks
for each row
execute function public.validate_task_owner();

create or replace function public.validate_subtask_owner()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.tasks t
    where t.id = new.task_id
      and t.user_id = new.user_id
  ) then
    raise exception 'task_id must belong to the same user as subtask';
  end if;

  return new;
end;
$$;

create trigger subtasks_validate_owner
before insert or update on public.subtasks
for each row
execute function public.validate_subtask_owner();

create or replace function public.validate_time_session_owner()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.tasks t
    where t.id = new.task_id
      and t.user_id = new.user_id
  ) then
    raise exception 'task_id must belong to the same user as time session';
  end if;

  if new.subtask_id is not null and not exists (
    select 1
    from public.subtasks st
    where st.id = new.subtask_id
      and st.task_id = new.task_id
      and st.user_id = new.user_id
  ) then
    raise exception 'subtask_id must belong to the same task and user as time session';
  end if;

  return new;
end;
$$;

create trigger time_sessions_validate_owner
before insert or update on public.time_sessions
for each row
execute function public.validate_time_session_owner();

create or replace function public.validate_daily_task_state_owner()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.tasks t
    where t.id = new.task_id
      and t.user_id = new.user_id
  ) then
    raise exception 'task_id must belong to the same user as daily task state';
  end if;

  return new;
end;
$$;

create trigger daily_task_states_validate_owner
before insert or update on public.daily_task_states
for each row
execute function public.validate_daily_task_state_owner();

create or replace function public.validate_daily_subtask_state_owner()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.subtasks st
    where st.id = new.subtask_id
      and st.user_id = new.user_id
  ) then
    raise exception 'subtask_id must belong to the same user as daily subtask state';
  end if;

  return new;
end;
$$;

create trigger daily_subtask_states_validate_owner
before insert or update on public.daily_subtask_states
for each row
execute function public.validate_daily_subtask_state_owner();

create index cycles_user_sort_idx
on public.cycles(user_id, sort_order);

create index tasks_user_cycle_sort_idx
on public.tasks(user_id, cycle_id, sort_order);

create index tasks_user_visible_idx
on public.tasks(user_id, hidden, archived, sort_order);

create index subtasks_task_sort_idx
on public.subtasks(task_id, sort_order);

create index time_sessions_user_date_idx
on public.time_sessions(user_id, local_date);

create index time_sessions_task_date_idx
on public.time_sessions(task_id, local_date);

create index time_sessions_subtask_date_idx
on public.time_sessions(subtask_id, local_date)
where subtask_id is not null;

create index daily_task_states_user_date_idx
on public.daily_task_states(user_id, local_date);

create index daily_subtask_states_user_date_idx
on public.daily_subtask_states(user_id, local_date);

create or replace view public.daily_task_stats
with (security_invoker = true) as
select
  t.user_id,
  t.id as task_id,
  t.cycle_id,
  s.local_date,
  t.title,
  t.icon,
  t.target_minutes,
  coalesce(sum(s.duration_seconds), 0)::int as spent_seconds,
  least(
    100,
    round(
      coalesce(sum(s.duration_seconds), 0)::numeric / nullif(t.target_minutes * 60, 0) * 100
    )
  )::int as progress_percent
from public.tasks t
left join public.time_sessions s
  on s.task_id = t.id
  and s.ended_at is not null
group by
  t.user_id,
  t.id,
  t.cycle_id,
  s.local_date,
  t.title,
  t.icon,
  t.target_minutes;

create or replace view public.daily_subtask_stats
with (security_invoker = true) as
select
  st.user_id,
  st.task_id,
  st.id as subtask_id,
  s.local_date,
  st.title,
  st.target_minutes,
  coalesce(sum(s.duration_seconds), 0)::int as spent_seconds,
  least(
    100,
    round(
      coalesce(sum(s.duration_seconds), 0)::numeric / nullif(st.target_minutes * 60, 0) * 100
    )
  )::int as progress_percent
from public.subtasks st
left join public.time_sessions s
  on s.subtask_id = st.id
  and s.ended_at is not null
group by
  st.user_id,
  st.task_id,
  st.id,
  s.local_date,
  st.title,
  st.target_minutes;

alter table public.profiles enable row level security;
alter table public.cycles enable row level security;
alter table public.tasks enable row level security;
alter table public.subtasks enable row level security;
alter table public.time_sessions enable row level security;
alter table public.daily_task_states enable row level security;
alter table public.daily_subtask_states enable row level security;

create policy "profiles_select_own"
on public.profiles for select
using (id = auth.uid());

create policy "profiles_update_own"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "cycles_manage_own"
on public.cycles for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "tasks_manage_own"
on public.tasks for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "subtasks_manage_own"
on public.subtasks for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "time_sessions_manage_own"
on public.time_sessions for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "daily_task_states_manage_own"
on public.daily_task_states for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "daily_subtask_states_manage_own"
on public.daily_subtask_states for all
using (user_id = auth.uid())
with check (user_id = auth.uid());
