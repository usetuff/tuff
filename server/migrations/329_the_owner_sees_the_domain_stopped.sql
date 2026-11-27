/*
 * The owner sees in the app that the workspace's own domain stopped.
 *
 * Until now only a letter said so. A paused row said it in Settings too,
 * but a domain dropped after its misses or taken by another workspace's
 * record was deleted, and Your domain showed an empty field as if there had
 * never been one.
 *
 * 1. `domain_stopped`: one row a workspace — the name, why, when. Read under
 *    the workspace's policies; written only here, by what stops a domain:
 *    - a trigger, when a connected row turns `paused` (the worker's check,
 *      on a downgrade);
 *    - `domain_take`, for each workspace whose connected, issuing or paused
 *      row it deletes (`taken`) — a released row was the owner's own
 *      removal and says nothing;
 *    - `domain_lost`, which the worker calls just before it deletes a row
 *      after three misses (`dropped`).
 *    Not a notification: it is a state, true until somebody fixes it, and
 *    no entity the inbox points at.
 * 2. Gone when any row of the workspace becomes `connected` (the same
 *    trigger), and on the owner's Remove (`domain_release`), whether or not
 *    there is a row left to release.
 */

/* ------------------------------------------------------------ 1. the record */

create table domain_stopped (
  workspace_id uuid primary key references workspace(id) on delete cascade,
  hostname     text not null check (hostname ~ '^[a-z0-9.-]{4,253}$'),
  why          text not null check (why in ('paused', 'dropped', 'taken')),
  at           timestamptz not null default now()
);
alter table domain_stopped enable row level security;
/* As `workspace_domain`'s own: the workspace's people, in the workspace the
   session is for. The routes answer it to the owner only. */
create policy ds_read on domain_stopped for select to tracker_app
  using (workspace_id in (select staff_workspaces())
         and (current_workspace() is null or workspace_id = current_workspace()));
grant select on domain_stopped to tracker_app;

/* Paused by a downgrade, or connected again. */
create function domain_stopped_mark() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status = 'connected' and old.status is distinct from 'connected' then
    delete from domain_stopped s where s.workspace_id = new.workspace_id;
  elsif new.status = 'paused' and old.status = 'connected' then
    insert into domain_stopped (workspace_id, hostname, why, at)
    values (new.workspace_id, new.hostname, 'paused', now())
    on conflict (workspace_id) do update set hostname = excluded.hostname, why = excluded.why, at = excluded.at;
  end if;
  return new;
end $$;
revoke execute on function domain_stopped_mark() from public;
create trigger workspace_domain_stopped
  after update of status on workspace_domain
  for each row execute function domain_stopped_mark();

/*
 * Dropped after its misses: written by whoever is about to delete the row —
 * its owner pressing Check, or the worker — just before it does. Only for a
 * row that was answering (connected or paused); a waiting or released one
 * going is nothing the owner needs telling.
 */
create function domain_lost(p_id uuid) returns void
language plpgsql volatile security definer set search_path = public, pg_temp as $$
begin
  insert into domain_stopped (workspace_id, hostname, why, at)
  select d.workspace_id, d.hostname, 'dropped', now() from workspace_domain d
  where d.id = p_id and d.status in ('connected', 'paused') and domain_mine(d.workspace_id)
  on conflict (workspace_id) do update set hostname = excluded.hostname, why = excluded.why, at = excluded.at;
end $$;
revoke execute on function domain_lost(uuid) from public;
grant execute on function domain_lost(uuid) to tracker_app, tracker_worker;

/* 327's, with the record written for each workspace that lost the name. */
create or replace function domain_take(p_id uuid)
returns table (cloudflare_id text, workspace_id uuid, workspace_name text, actor_id uuid, email text)
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_row workspace_domain;
  v_cf text;
begin
  select * into v_row from workspace_domain d where d.id = p_id and domain_mine(d.workspace_id);
  if v_row.id is null then
    return;
  end if;
  perform pg_advisory_xact_lock(hashtext('workspace_domain:' || v_row.hostname));
  select max(d.cloudflare_id) into v_cf from workspace_domain d
  where d.hostname = v_row.hostname and d.id <> p_id and d.status <> 'waiting';
  if v_cf is not null then
    perform pg_advisory_xact_lock(hashtext('domain_cf:' || v_cf));
    update workspace_domain d set cloudflare_id = v_cf where d.id = p_id;
  end if;
  return query
    with lost as (
      select d.workspace_id as ws from workspace_domain d
      where d.hostname = v_row.hostname and d.id <> p_id and d.status <> 'waiting'
    )
    select v_cf, w.id, w.name, m.actor_id, u.email::text
    from lost l join workspace w on w.id = l.ws
    join membership m on m.workspace_id = w.id and m.role = 'owner' and m.deleted_at is null and m.joined_at is not null
    join app_user u on u.actor_id = m.actor_id;
  /* What each of them sees in Your domain until it connects a name again
     or removes it (329). Never this claim's own workspace. */
  insert into domain_stopped (workspace_id, hostname, why, at)
  select d.workspace_id, d.hostname, 'taken', now() from workspace_domain d
  where d.hostname = v_row.hostname and d.id <> p_id and d.workspace_id <> v_row.workspace_id
    and d.status in ('connected', 'issuing', 'paused')
  on conflict on constraint domain_stopped_pkey do update set hostname = excluded.hostname, why = excluded.why, at = excluded.at;
  delete from workspace_domain d
  where d.hostname = v_row.hostname and d.id <> p_id and d.status <> 'waiting';
  update workspace_domain d set problem = 'taken', checked_at = now()
  where d.hostname = v_row.hostname and d.id <> p_id and d.status = 'waiting';
end $$;

/* ---------------------------------------------------- 2. the owner's Remove */

/* 325's, and the record cleared whether or not a row is left to release. */
create or replace function domain_release(p_workspace uuid)
returns table (released boolean, cloudflare_id text)
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_row workspace_domain;
begin
  if not (p_workspace in (select owned_workspaces())) then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  delete from domain_stopped s where s.workspace_id = p_workspace;
  select * into v_row from workspace_domain d where d.workspace_id = p_workspace and d.status <> 'released';
  if v_row.id is null then
    return;
  end if;
  if v_row.status in ('connected', 'paused') then
    update workspace_domain d set status = 'released', status_at = now(), misses = 0 where d.id = v_row.id;
    return query select true, null::text;
  else
    return query select false, domain_drop(v_row.id);
  end if;
end $$;
