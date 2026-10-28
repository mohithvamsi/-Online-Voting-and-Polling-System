-- Run once in a NEW Supabase project's SQL Editor. No seeded users or votes.
begin;
create table public.polls (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 5 and 160),
  description text not null default '' check (char_length(description) <= 1000),
  created_at timestamptz not null default now(),
  ends_at timestamptz not null,
  closed_at timestamptz,
  check (ends_at > created_at)
);
create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 100),
  position integer not null check (position between 1 and 6),
  unique (poll_id, position),
  unique (poll_id, id)
);
create unique index option_labels_unique on public.poll_options(poll_id, lower(btrim(label)));
create table public.votes (
  poll_id uuid not null references public.polls(id) on delete cascade,
  voter_id uuid not null references auth.users(id) on delete restrict,
  option_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (poll_id, voter_id),
  foreign key (poll_id, option_id) references public.poll_options(poll_id, id) on delete restrict
);
create index polls_creator_date on public.polls(creator_id, created_at desc);
create index polls_date on public.polls(created_at desc, id);
create index polls_deadline on public.polls(ends_at);
create index votes_option on public.votes(poll_id, option_id);
create index votes_voter on public.votes(voter_id);

-- Backend-only data model: no direct browser table or RPC access.
alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.votes enable row level security;
revoke all on public.polls, public.poll_options, public.votes from public, anon, authenticated;
grant select, insert, update, delete on public.polls, public.poll_options, public.votes to service_role;

create function public.create_poll(p_actor uuid, p_title text, p_description text,
  p_options text[], p_ends_at timestamptz) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare new_id uuid; choice text; n integer := 0;
begin
  if p_actor is null or p_title is null or p_description is null or p_ends_at is null
    or p_options is null or cardinality(p_options) not between 2 and 6
    or p_ends_at <= clock_timestamp() or p_ends_at > clock_timestamp() + interval '30 days'
  then raise exception using errcode = '22023', message = 'Invalid poll'; end if;
  insert into public.polls(creator_id, title, description, ends_at)
    values(p_actor, btrim(p_title), p_description, p_ends_at) returning id into new_id;
  foreach choice in array p_options loop
    n := n + 1;
    insert into public.poll_options(poll_id, label, position) values(new_id, btrim(choice), n);
  end loop;
  return new_id;
end; $$;

create function public.cast_vote(p_poll uuid, p_option uuid, p_actor uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare poll public.polls%rowtype;
begin
  -- Serialize votes with close/delete. Check the clock AFTER acquiring the lock.
  select * into poll from public.polls where id = p_poll for update;
  if not found then raise exception using errcode = 'P0002', message = 'Missing poll'; end if;
  if poll.closed_at is not null or poll.ends_at <= clock_timestamp() then
    raise exception using errcode = 'P0001', message = 'Closed poll'; end if;
  if p_actor is null or not exists(select 1 from public.poll_options where id=p_option and poll_id=p_poll) then
    raise exception using errcode = '22023', message = 'Invalid choice'; end if;
  insert into public.votes(poll_id, option_id, voter_id) values(p_poll, p_option, p_actor);
end; $$;

create function public.manage_poll(p_poll uuid, p_actor uuid, p_action text) returns void
language plpgsql security invoker set search_path = '' as $$
declare poll public.polls%rowtype;
begin
  select * into poll from public.polls where id = p_poll for update;
  if not found then raise exception using errcode = 'P0002', message = 'Missing poll'; end if;
  if p_actor is distinct from poll.creator_id then
    raise exception using errcode = '42501', message = 'Not owner'; end if;
  if p_action = 'close' then
    update public.polls set closed_at = coalesce(closed_at, clock_timestamp()) where id = p_poll;
  elsif p_action = 'delete' then
    if exists(select 1 from public.votes where poll_id = p_poll) then
      raise exception using errcode = 'P0001', message = 'Poll has votes'; end if;
    delete from public.polls where id = p_poll;
  else raise exception using errcode = '22023', message = 'Invalid action'; end if;
end; $$;

create function public.list_polls(p_actor uuid, p_search text, p_status text,
  p_mine boolean, p_page integer) returns jsonb
language sql stable security invoker set search_path = '' as $$
  with matching as (
    select p.id, p.title, p.description, p.ends_at, p.created_at,
      (p.closed_at is not null or p.ends_at <= now()) as closed,
      (p.creator_id = p_actor) as is_owner,
      exists(select 1 from public.votes v where v.poll_id=p.id and v.voter_id=p_actor) as has_voted
    from public.polls p
    where (not p_mine or p.creator_id=p_actor)
      and position(lower(p_search) in lower(p.title)) > 0
      and (p_status='all' or (p_status='closed') = (p.closed_at is not null or p.ends_at<=now()))
  ), page_rows as (
    select * from matching order by created_at desc, id limit 12 offset (p_page-1)*12
  ) select jsonb_build_object('items', coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id)
    from page_rows r), '[]'::jsonb), 'total', (select count(*) from matching), 'page',p_page,'page_size',12);
$$;

create function public.poll_detail(p_poll uuid, p_actor uuid) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare poll public.polls%rowtype; is_closed boolean; choices jsonb; total bigint;
begin
  select * into poll from public.polls where id=p_poll;
  if not found then raise exception using errcode='P0002', message='Missing poll'; end if;
  is_closed := poll.closed_at is not null or poll.ends_at <= now();
  -- Counts never leave this function while voting is open, even for the creator.
  select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label,
    'votes', case when is_closed then (select count(*) from public.votes v where v.option_id=o.id) else null end)
    order by o.position), '[]'::jsonb) into choices from public.poll_options o where o.poll_id=p_poll;
  select count(*) into total from public.votes where poll_id=p_poll;
  return jsonb_build_object('id',poll.id,'title',poll.title,'description',poll.description,
    'ends_at',poll.ends_at,'closed',is_closed,'is_owner',poll.creator_id=p_actor,
    'has_voted',exists(select 1 from public.votes where poll_id=p_poll and voter_id=p_actor),
    'can_delete',poll.creator_id=p_actor and total=0,
    'total_votes',case when is_closed then total else null end,'options',choices);
end; $$;

-- PostgreSQL grants EXECUTE to PUBLIC by default: explicitly remove it.
revoke all on function public.create_poll(uuid,text,text,text[],timestamptz) from public, anon, authenticated;
revoke all on function public.cast_vote(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.manage_poll(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.list_polls(uuid,text,text,boolean,integer) from public, anon, authenticated;
revoke all on function public.poll_detail(uuid,uuid) from public, anon, authenticated;
grant execute on function public.create_poll(uuid,text,text,text[],timestamptz) to service_role;
grant execute on function public.cast_vote(uuid,uuid,uuid) to service_role;
grant execute on function public.manage_poll(uuid,uuid,text) to service_role;
grant execute on function public.list_polls(uuid,text,text,boolean,integer) to service_role;
grant execute on function public.poll_detail(uuid,uuid) to service_role;
commit;
