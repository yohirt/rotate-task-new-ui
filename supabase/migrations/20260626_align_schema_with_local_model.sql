-- Align the first database shape with the current localStorage model.
-- This keeps the existing daily tables intact, but adds cycle-based state
-- and signed time corrections so the app can migrate gradually.

alter table public.cycles
add column if not exists started_at timestamptz not null default now(),
add column if not exists reset_at timestamptz;

alter table public.tasks
add column if not exists time_window_text text;

alter table public.tasks
drop constraint if exists tasks_target_minutes_check;

alter table public.tasks
add constraint tasks_target_minutes_check
check (target_minutes >= 0);

alter table public.subtasks
drop constraint if exists subtasks_target_minutes_check;

alter table public.subtasks
add constraint subtasks_target_minutes_check
check (target_minutes >= 0);

with ranked_active_cycles as (
  select
    id,
    row_number() over (
      partition by user_id
      order by sort_order desc, created_at desc, id desc
    ) as active_rank
  from public.cycles
  where is_active
)
update public.cycles c
set is_active = false
from ranked_active_cycles ranked
where c.id = ranked.id
  and ranked.active_rank > 1;

create unique index if not exists one_active_cycle_per_user
on public.cycles(user_id)
where is_active;

create table if not exists public.cycle_task_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  done boolean not null default false,
  reset_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, cycle_id, task_id)
);

create trigger cycle_task_states_set_updated_at
before update on public.cycle_task_states
for each row
execute function public.set_updated_at();

create table if not exists public.cycle_subtask_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  subtask_id uuid not null references public.subtasks(id) on delete cascade,
  done boolean not null default false,
  reset_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, cycle_id, subtask_id)
);

create trigger cycle_subtask_states_set_updated_at
before update on public.cycle_subtask_states
for each row
execute function public.set_updated_at();

create table if not exists public.time_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  subtask_id uuid references public.subtasks(id) on delete set null,
  adjusted_seconds int not null check (adjusted_seconds <> 0),
  local_date date not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger time_adjustments_set_updated_at
before update on public.time_adjustments
for each row
execute function public.set_updated_at();

create or replace function public.validate_cycle_task_state_owner()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.cycles c
    where c.id = new.cycle_id
      and c.user_id = new.user_id
  ) then
    raise exception 'cycle_id must belong to the same user as cycle task state';
  end if;

  if not exists (
    select 1
    from public.tasks t
    where t.id = new.task_id
      and t.user_id = new.user_id
      and (t.cycle_id is null or t.cycle_id = new.cycle_id)
  ) then
    raise exception 'task_id must belong to the same user and cycle as cycle task state';
  end if;

  return new;
end;
$$;

create trigger cycle_task_states_validate_owner
before insert or update on public.cycle_task_states
for each row
execute function public.validate_cycle_task_state_owner();

create or replace function public.validate_cycle_subtask_state_owner()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.cycles c
    where c.id = new.cycle_id
      and c.user_id = new.user_id
  ) then
    raise exception 'cycle_id must belong to the same user as cycle subtask state';
  end if;

  if not exists (
    select 1
    from public.subtasks st
    join public.tasks t on t.id = st.task_id
    where st.id = new.subtask_id
      and st.user_id = new.user_id
      and (t.cycle_id is null or t.cycle_id = new.cycle_id)
  ) then
    raise exception 'subtask_id must belong to the same user and cycle as cycle subtask state';
  end if;

  return new;
end;
$$;

create trigger cycle_subtask_states_validate_owner
before insert or update on public.cycle_subtask_states
for each row
execute function public.validate_cycle_subtask_state_owner();

create or replace function public.validate_time_adjustment_owner()
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
    raise exception 'task_id must belong to the same user as time adjustment';
  end if;

  if new.subtask_id is not null and not exists (
    select 1
    from public.subtasks st
    where st.id = new.subtask_id
      and st.task_id = new.task_id
      and st.user_id = new.user_id
  ) then
    raise exception 'subtask_id must belong to the same task and user as time adjustment';
  end if;

  return new;
end;
$$;

create trigger time_adjustments_validate_owner
before insert or update on public.time_adjustments
for each row
execute function public.validate_time_adjustment_owner();

create index if not exists cycle_task_states_user_cycle_idx
on public.cycle_task_states(user_id, cycle_id);

create index if not exists cycle_subtask_states_user_cycle_idx
on public.cycle_subtask_states(user_id, cycle_id);

create index if not exists time_adjustments_user_date_idx
on public.time_adjustments(user_id, local_date);

create index if not exists time_adjustments_task_date_idx
on public.time_adjustments(task_id, local_date);

create index if not exists time_adjustments_subtask_date_idx
on public.time_adjustments(subtask_id, local_date)
where subtask_id is not null;

create or replace view public.daily_task_stats
with (security_invoker = true) as
with task_time_totals as (
  select
    s.user_id,
    s.task_id,
    s.local_date,
    sum(s.duration_seconds)::int as spent_seconds
  from public.time_sessions s
  where s.ended_at is not null
  group by s.user_id, s.task_id, s.local_date

  union all

  select
    a.user_id,
    a.task_id,
    a.local_date,
    sum(a.adjusted_seconds)::int as spent_seconds
  from public.time_adjustments a
  group by a.user_id, a.task_id, a.local_date
),
task_daily_totals as (
  select
    user_id,
    task_id,
    local_date,
    greatest(0, sum(spent_seconds))::int as spent_seconds
  from task_time_totals
  group by user_id, task_id, local_date
)
select
  t.user_id,
  t.id as task_id,
  t.cycle_id,
  totals.local_date,
  t.title,
  t.icon,
  t.target_minutes,
  coalesce(totals.spent_seconds, 0)::int as spent_seconds,
  case
    when t.target_minutes <= 0 then 0
    else least(
      100,
      round(
        coalesce(totals.spent_seconds, 0)::numeric / (t.target_minutes * 60) * 100
      )
    )::int
  end as progress_percent
from public.tasks t
left join task_daily_totals totals
  on totals.task_id = t.id;

create or replace view public.daily_subtask_stats
with (security_invoker = true) as
with subtask_time_totals as (
  select
    s.user_id,
    s.task_id,
    s.subtask_id,
    s.local_date,
    sum(s.duration_seconds)::int as spent_seconds
  from public.time_sessions s
  where s.ended_at is not null
    and s.subtask_id is not null
  group by s.user_id, s.task_id, s.subtask_id, s.local_date

  union all

  select
    a.user_id,
    a.task_id,
    a.subtask_id,
    a.local_date,
    sum(a.adjusted_seconds)::int as spent_seconds
  from public.time_adjustments a
  where a.subtask_id is not null
  group by a.user_id, a.task_id, a.subtask_id, a.local_date
),
subtask_daily_totals as (
  select
    user_id,
    task_id,
    subtask_id,
    local_date,
    greatest(0, sum(spent_seconds))::int as spent_seconds
  from subtask_time_totals
  group by user_id, task_id, subtask_id, local_date
)
select
  st.user_id,
  st.task_id,
  st.id as subtask_id,
  totals.local_date,
  st.title,
  st.target_minutes,
  coalesce(totals.spent_seconds, 0)::int as spent_seconds,
  case
    when st.target_minutes <= 0 then 0
    else least(
      100,
      round(
        coalesce(totals.spent_seconds, 0)::numeric / (st.target_minutes * 60) * 100
      )
    )::int
  end as progress_percent
from public.subtasks st
left join subtask_daily_totals totals
  on totals.subtask_id = st.id;

alter table public.cycle_task_states enable row level security;
alter table public.cycle_subtask_states enable row level security;
alter table public.time_adjustments enable row level security;

create policy "cycle_task_states_manage_own"
on public.cycle_task_states for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "cycle_subtask_states_manage_own"
on public.cycle_subtask_states for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "time_adjustments_manage_own"
on public.time_adjustments for all
using (user_id = auth.uid())
with check (user_id = auth.uid());
