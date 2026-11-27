/*
 * After the re-review of.
 *
 * 330 took on a host only an invitation with `mailed_to`. But a letter to a
 * host is bound first, mailed, and only then marked delivered — and the mark
 * can fail (it is logged, never thrown) or not have landed yet when the
 * person clicks. Such an invitation has `mailed_domain` and no `mailed_to`:
 * the host sent it to usetuff.com, usetuff.com's preview named the host, and
 * the page went back and forth for ever, the invitation taken nowhere.
 *
 * Binding asks an address (330), so a bound invitation is always one on its
 * way to its address: it counts as mailed. The host's code still goes only
 * to the invitation's own address, so a link with no address — never bound —
 * is still taken on no host.
 */

create or replace function invite_place(p_token_hash text)
returns table (workspace_id uuid, mailed_domain uuid, mailed boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  select i.workspace_id, i.mailed_domain, (i.mailed_to is not null or i.mailed_domain is not null) from invite i
  where i.token_hash = p_token_hash
    and i.used_at is null and i.deleted_at is null and i.expires_at > now()
$$;

create or replace function host_code_ask(p_id uuid, p_domain uuid, p_email citext, p_browser text, p_code_hash text,
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
      /* Mailed to its address by this server (330): a link with no address
         is taken at usetuff.com and never on a host, so nobody is mailed a
         code beside one here — the taker would choose the address. */
      and (i.mailed_to is not null or i.mailed_domain is not null)
      and lower(i.email::text collate "C") = lower(p_email::text collate "C");
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

create or replace function accept_invite(
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
    /*
     * Only an invitation this server mailed to its address (330). A link
     * with no address lets its taker choose the address, so on a host it
     * would make a verified account at an address of the taker's — whoever
     * holds the domain's DNS reads the link there — with a membership that
     * outlives the host: a reset or a provider at usetuff.com, and the seat
     * is a full session's. Raised, so it stays open for usetuff.com.
     */
    if inv.mailed_to is null and inv.mailed_domain is null then
      raise exception 'invite_not_here' using errcode = 'check_violation';
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
