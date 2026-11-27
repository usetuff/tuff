/*
 * An invitation into a workspace with its own domain is taken there.
 *
 * 1. `invite.mailed_domain`: the domain an invitation's letter linked to,
 *    written by the sign-in role before the letter goes, beside `mailed_to`
 *    (`auth_invite_bind`; 313's `auth_invite_delivered` after it). The application
 *    role's insert and update grants name neither column, so SQL run as
 *    the application cannot bind an invitation or free one. Not a
 *    reference: a domain's row deleted must not free its invitations for
 *    usetuff.com, where an account would have a password. A binding only
 *    ever narrows where an invitation is taken.
 * 2. `invite_place(token_hash)`: an open invitation's workspace and binding,
 *    for a host deciding whether to answer it and for usetuff.com saying
 *    where it goes. The token's hash is the secret that opens it, as for
 *    `preview_invite`.
 * 3. `host_code.invite_hash`: a code asked beside an open invitation into
 *    the host's workspace, mailed to the address the invitation may be
 *    taken with whether or not it has an account, and good only beside that
 *    invitation. A code asked to sign in is good for nothing beside one,
 *    and this one for nothing else.
 * 4. `accept_invite` asked through a domain (`p_domain`): only for that
 *    domain's workspace while it answers, with no password ever, and only
 *    with the inbox proved here — the host's code for this address, this
 *    browser and this invitation, spent in this statement — for a new
 *    account and an existing one alike: on a host the token travels in a
 *    URL on a name somebody else's DNS decides, and mail scanners and chat
 *    previews fetch it with nobody there, so it is never a proof there by
 *    itself (the independent review's S1). One whose address nobody proved
 *    is refused (`email_unverified`): the route sends it the letter that
 *    confirms it. An invitation bound to a domain is refused through
 *    anything else — usetuff.com included.
 * 5. `invite.mailed_domain` readable by the application, so the owner's list
 *    of invitations says which must be sent again once their domain stopped
 *    answering (the review's S2).
 */

/* ------------------------------------------------ 1. bound where it went */

alter table invite add column mailed_domain uuid;

/*
 * Bound before its letter goes, so no token reaches a host unbound: the
 * route binds, then mails, then marks it delivered (313's, unchanged). Once,
 * while it is open and unbound, and never one handed over by hand. Whether
 * it was bound — a request that could not bind it sends nothing.
 */
create function auth_invite_bind(p_token_hash text, p_domain uuid) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_token_hash is null or p_domain is null then
    return false;
  end if;
  update invite i set mailed_domain = p_domain
  where i.token_hash = p_token_hash
    and i.used_at is null and i.deleted_at is null and i.expires_at > now()
    and i.mailed_domain is null and i.mailed_to is null and not i.by_hand
    and exists (select 1 from workspace_domain d
                where d.id = p_domain and d.workspace_id = i.workspace_id and d.status = 'connected');
  return found;
end $$;
revoke all on function auth_invite_bind(text, uuid) from public;
grant execute on function auth_invite_bind(text, uuid) to tracker_auth;

/* ------------------------------------------------ 2. where it is taken */

create function invite_place(p_token_hash text)
returns table (workspace_id uuid, mailed_domain uuid)
language sql stable security definer set search_path = public, pg_temp as $$
  select i.workspace_id, i.mailed_domain from invite i
  where i.token_hash = p_token_hash
    and i.used_at is null and i.deleted_at is null and i.expires_at > now()
$$;
revoke all on function invite_place(text) from public;
grant execute on function invite_place(text) to tracker_app;

/* ------------------------------------------------ 3. a code beside an invitation */

alter table host_code add column invite_hash text;

/*
 * A new name beside 326's `host_code_make`, which keeps its signature and
 * answer — a server still running the code before this one calls it — and
 * now asks this with no invitation.
 */
create function host_code_ask(p_id uuid, p_domain uuid, p_email citext, p_browser text, p_code_hash text,
                              p_invite_hash text)
returns table (actor_id uuid, mail boolean, for_invite boolean)
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_workspace uuid;
  v_actor uuid;
  v_for text;
  v_mail boolean := false;
begin
  select h.workspace_id into v_workspace from host_domain(p_domain) h;
  if v_workspace is null then
    return;
  end if;
  /*
   * Beside an open invitation into this workspace — taken through this
   * domain, and with this address where it names one: mailed to the
   * address whoever it is, so the answer says nothing about who has an
   * account. The account, where there is one, is any at that address; the
   * invitation decides whether it may join.
   */
  if p_invite_hash is not null then
    perform 1 from invite i
    where i.token_hash = p_invite_hash and i.workspace_id = v_workspace
      and i.used_at is null and i.deleted_at is null and i.expires_at > now()
      and (i.mailed_domain is null or i.mailed_domain = p_domain)
      and (i.email is null or lower(i.email::text collate "C") = lower(p_email::text collate "C"));
    if found then
      v_for := p_invite_hash;
      v_mail := true;
      select u.actor_id into v_actor from app_user u where u.email = p_email;
    end if;
  end if;
  /* Otherwise to sign in, as 326's: somebody joined to the workspace. */
  if v_for is null then
    select u.actor_id into v_actor from app_user u
    join membership m on m.actor_id = u.actor_id
    where u.email = p_email and u.email_verified_at is not null and m.workspace_id = v_workspace
      and m.deleted_at is null and m.joined_at is not null and m.role in ('owner', 'member')
    limit 1;
    v_mail := v_actor is not null;
  end if;
  /* This browser's earlier code for this address, and nobody else's. */
  delete from host_code c where c.domain_id = p_domain and c.email = p_email and c.browser = p_browser;
  insert into host_code (id, domain_id, email, browser, code_hash, actor_id, expires_at, invite_hash)
  values (p_id, p_domain, p_email, p_browser, p_code_hash, v_actor, now() + interval '10 minutes', v_for)
  on conflict on constraint host_code_one_browser do update
    set id = excluded.id, code_hash = excluded.code_hash, actor_id = excluded.actor_id,
        tries = 0, spent_at = null, expires_at = excluded.expires_at, created_at = now(),
        invite_hash = excluded.invite_hash;
  /* Whether the code is the invitation's, so the letter says so only then. */
  return query select v_actor, v_mail, v_for is not null;
end $$;
revoke execute on function host_code_ask(uuid, uuid, citext, text, text, text) from public;
grant execute on function host_code_ask(uuid, uuid, citext, text, text, text) to tracker_auth;

/* 326's, as a sign-in's code: it clears an invitation's code it replaces. */
create or replace function host_code_make(p_id uuid, p_domain uuid, p_email citext, p_browser text, p_code_hash text)
returns uuid
language sql volatile security definer set search_path = public, pg_temp as $$
  select a.actor_id from host_code_ask(p_id, p_domain, p_email, p_browser, p_code_hash, null) a
$$;

/*
 * A code typed. Right: the account (none, for a new address beside an
 * invitation), the code still good — the second factor may be asked next.
 * Wrong: one try counted, the fifth spends it. A code asked beside an
 * invitation answers only beside the same one, and a code asked to sign in
 * only to signing in.
 */
drop function host_code_try(uuid, citext, text, text);
create function host_code_try(p_domain uuid, p_email citext, p_browser text, p_code_hash text, p_invite_hash text default null)
returns table (actor_id uuid, ok boolean)
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_row host_code;
begin
  select * into v_row from host_code c
  where c.domain_id = p_domain and c.email = p_email and c.browser = p_browser
    and c.spent_at is null and c.expires_at > now()
  for update;
  if v_row.id is null or v_row.invite_hash is distinct from p_invite_hash then
    return;
  end if;
  if v_row.code_hash = p_code_hash and (v_row.actor_id is not null or v_row.invite_hash is not null) then
    return query select v_row.actor_id, true;
    return;
  end if;
  update host_code c set tries = c.tries + 1,
         spent_at = case when c.tries + 1 >= 5 then now() else null end
  where c.id = v_row.id;
  return query select null::uuid, false;
end $$;
revoke execute on function host_code_try(uuid, citext, text, text, text) from public;
grant execute on function host_code_try(uuid, citext, text, text, text) to tracker_auth;

/* 326's, and never a code asked beside an invitation: that one is spent by `accept_invite`. */
create or replace function host_code_spend(p_domain uuid, p_email citext, p_browser text, p_code_hash text) returns boolean
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  n int;
begin
  update host_code c set spent_at = now()
  where c.domain_id = p_domain and c.email = p_email and c.browser = p_browser and c.code_hash = p_code_hash
    and c.invite_hash is null and c.spent_at is null and c.expires_at > now();
  get diagnostics n = row_count;
  return n > 0;
end $$;

/* ------------------------------------------------ 4. taken through a domain */

drop function accept_invite(text, uuid, text, citext, text, boolean, boolean);
create function accept_invite(
  p_token_hash text,
  p_actor_id uuid,
  p_name text,
  p_email citext,
  p_password_hash text,
  p_must_be_new boolean default false,
  p_pressed boolean default false,
  /* The domain the request came through, read from the Worker's signed
     pair; null at usetuff.com. With it, the host's code: its browser's
     hash and the code's. */
  p_domain uuid default null,
  p_browser text default null,
  p_code_hash text default null
) returns table (workspace_id uuid, actor_id uuid, created_account boolean)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  inv     record;
  v_actor uuid;
  v_new   boolean := false;
  p       uuid;
  v_cap   integer;
  v_coded boolean := false;
begin
  update invite set used_at = now()
  where token_hash = p_token_hash
    and used_at is null
    and deleted_at is null
    and expires_at > now()
  returning * into inv;

  if inv is null then
    return;
  end if;

  /*
   * Every refusal below is raised, and a raise undoes this statement's claim
   * on the invitation with everything else it did: the invitation stays as
   * it was, for whoever may still take it. Only the one refusal that
   * returns (somebody removed since) gives it back by hand.
   */

  /* Taken where it was sent (328): an invitation mailed to a host only through that host. */
  if inv.mailed_domain is not null and p_domain is distinct from inv.mailed_domain then
    raise exception 'invite_on_host' using errcode = 'check_violation';
  end if;

  /* Through a domain: only its own workspace's, while it answers, and never with a password. */
  if p_domain is not null then
    if not exists (select 1 from host_domain(p_domain) h where h.workspace_id = inv.workspace_id) then
      raise exception 'invite_not_here' using errcode = 'check_violation';
    end if;
    if p_password_hash is not null then
      raise exception 'password_not_here' using errcode = 'check_violation';
    end if;
  end if;

  /*
   * A link handed over by hand is for its address and nobody else's
   * (migration 210). Raised, so the person it was for can still use it.
   */
  if inv.by_hand and lower(inv.email::text collate "C") is distinct from lower(p_email::text collate "C") then
    raise exception 'invite_for_another_address' using errcode = 'check_violation';
  end if;

  select u.actor_id into v_actor from app_user u where u.email = p_email;

  /*
   * Asked for a new account, and the address has one by now — a sign-up
   * that landed between the caller's look and this statement. Joining it here would hand a session to an account whose
   * password nobody checked. Raised; the caller says so.
   */
  if p_must_be_new and v_actor is not null then
    raise exception 'account_exists' using errcode = 'unique_violation';
  end if;

  /*
   * Through a domain, the inbox is proved here, by nothing the route says
   * (328): the host's code asked beside this invitation, for this address
   * in this browser, spent now — for a new account and an existing one
   * alike. Never the token: on a host it is a URL that scanners and
   * previews fetch on a name whose DNS somebody else may hold.
   */
  if p_domain is not null then
    if p_code_hash is not null and p_browser is not null then
      update host_code c set spent_at = now()
      where c.domain_id = p_domain and c.browser = p_browser and c.code_hash = p_code_hash
        and lower(c.email::text collate "C") = lower(p_email::text collate "C")
        and c.invite_hash = p_token_hash and c.spent_at is null and c.expires_at > now();
      v_coded := found;
    end if;
    if not v_coded then
      raise exception 'inbox_unproved' using errcode = 'check_violation';
    end if;
    /* An account whose address nobody proved is confirmed first, by its own letter. */
    if v_actor is not null and exists (
      select 1 from app_user u where u.actor_id = v_actor and (u.email_verified_at is null or u.email_by_hand)
    ) then
      raise exception 'email_unverified' using errcode = 'check_violation';
    end if;
  end if;

  /*
   * Waiting for the person's own word since the address was proved (315):
   * only a press on this invitation's page is that word. Raised otherwise
   * — the person may still press it.
   */
  if not p_pressed and v_actor is not null and exists (
    select 1 from membership m
    where m.workspace_id = inv.workspace_id and m.actor_id = v_actor
      and m.deleted_at is null and m.unconfirmed_at is not null
  ) then
    raise exception 'membership_waiting' using errcode = 'check_violation';
  end if;

  /*
   * Somebody removed after this invitation was made does not come back on
   * it — `docs/specs/removing-someone.md`. Returned, not raised, so given
   * back here by hand: it may be meant for somebody else.
   */
  if v_actor is not null and exists (
    select 1 from membership m
    where m.workspace_id = inv.workspace_id and m.actor_id = v_actor
      and m.deleted_at is not null and m.deleted_at > inv.created_at
  ) and not exists (
    select 1 from membership m
    where m.workspace_id = inv.workspace_id and m.actor_id = v_actor and m.deleted_at is null
  ) then
    update invite set used_at = null where id = inv.id;
    return;
  end if;

  /* The ceiling, only for somebody who is not already in — 315's. */
  select plan_people(w.plan) into v_cap from workspace w where w.id = inv.workspace_id;
  if v_cap is not null
     and not exists (select 1 from membership m
                     where m.workspace_id = inv.workspace_id
                       and m.actor_id = v_actor and m.deleted_at is null)
     and workspace_people(inv.workspace_id) >= v_cap then
    raise exception 'workspace_full' using errcode = 'check_violation';
  end if;

  if v_actor is null then
    v_actor := p_actor_id;
    v_new := true;
    insert into actor (id, name) values (v_actor, p_name);
    /*
     * Confirmed by what proved the address (313): with no password, the
     * provider the caller asked vouched for it — or, through a domain, the
     * host's code spent above; the server's letter to this
     * address; or, weakly, the link handed over for it.
     */
    insert into app_user (actor_id, email, password_hash, email_verified_at, email_by_hand)
      values (
        v_actor, p_email, p_password_hash,
        case
          when p_password_hash is null then now()
          when lower(inv.email::text collate "C") = lower(p_email::text collate "C")
               and (lower(inv.mailed_to::text collate "C") = lower(p_email::text collate "C") or inv.by_hand)
            then now()
        end,
        coalesce(p_password_hash is not null
                 and lower(inv.email::text collate "C") = lower(p_email::text collate "C")
                 and inv.by_hand and inv.mailed_to is null, false));
  end if;

  insert into membership (id, workspace_id, actor_id, role, invited_by, joined_at)
  values (gen_random_uuid(), inv.workspace_id, v_actor, inv.role, inv.created_by, now())
  on conflict do nothing;

  /* Waiting since the address was proved (315), and the person pressed Join. */
  if p_pressed then
    update membership set joined_at = now(), unconfirmed_at = null, updated_at = now()
    where membership.workspace_id = inv.workspace_id and membership.actor_id = v_actor
      and membership.deleted_at is null and membership.unconfirmed_at is not null;
  end if;

  foreach p in array inv.project_ids
  loop
    insert into project_member (id, workspace_id, project_id, actor_id, added_by, rights)
    values (gen_random_uuid(), inv.workspace_id, p, v_actor, inv.created_by, inv.rights)
    on conflict do nothing;
  end loop;

  update invite set used_by = v_actor where id = inv.id;

  insert into security_event (id, workspace_id, actor_id, kind, meta)
  values (gen_random_uuid(), inv.workspace_id, v_actor, 'invite_accepted',
          jsonb_build_object('role', inv.role, 'rights', inv.rights)
            || case when p_domain is not null then jsonb_build_object('domain_id', p_domain) else '{}'::jsonb end);

  return query select inv.workspace_id, v_actor, v_new;
end $$;
revoke all on function accept_invite(text, uuid, text, citext, text, boolean, boolean, uuid, text, text) from public;
grant execute on function accept_invite(text, uuid, text, citext, text, boolean, boolean, uuid, text, text) to tracker_auth;

/* ------------------------------------------------ 5. what must be sent again */

grant select (mailed_domain) on invite to tracker_app;
