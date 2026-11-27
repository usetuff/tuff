/*
 * Every definer function that is the sign-in role's — migrations 308 and
 * 311. 308 grants each to
 * `tracker_auth` by name; 311 takes each from `tracker_app`. `docs/api.md`
 * names the same list ("The sign-in role's definers"), and a function
 * added to either side fails `auth-role.test.ts` until it is named.
 * `auth_invite_delivered` is 313's, granted to the sign-in role
 * from the start.
 */
export const AUTH_DEFINERS = [
  /* 325: a session's workspace domain carried through a refresh, and the codes that sign in on a host. */
  'accept_invite',
  'agent_end_tokens',
  'agent_oauth_end',
  'auth_app_start_once',
  'auth_change_password',
  'auth_claim_email',
  'auth_confirm_email',
  'auth_confirm_if_invited',
  'auth_email_cancel',
  /* 316: a new address confirmed from the account's own session. */
  'auth_email_confirm',
  'auth_email_ticket',
  'auth_email_ticket_peek',
  /* 321: an account a server's own provider made on an address it did not vouch for, held weakly. */
  'auth_email_weak',
  'auth_end_session',
  /* 317: the account's hold for a password read, before a password is read. */
  'auth_hold_account',
  'auth_identity_forget',
  'auth_identity_link',
  'auth_identity_remove',
  /* 328: an invitation bound to the workspace's own domain before its letter goes. */
  'auth_invite_bind',
  'auth_invite_delivered',
  'auth_lookup_user',
  /* 315: Join or Leave a workspace joined before the proof. */
  'auth_membership_answer',
  /* 317: whether an account was put out since a provider's callback found it. */
  'auth_not_put_out_since',
  'auth_password_hash',
  'auth_recovery_replace',
  'auth_recovery_spend',
  /* 312: a refresh asked again. */
  'auth_refresh_again',
  'auth_revoke_others',
  'auth_revoke_session',
  'auth_session_host',
  'auth_set_password',
  'auth_spend_refresh',
  'auth_ticket_binding',
  'auth_ticket_make',
  'auth_ticket_make_bound',
  'auth_ticket_peek',
  'auth_ticket_recent',
  'auth_ticket_spend',
  'auth_ticket_start',
  'auth_ticket_started',
  'auth_totp_begin',
  'auth_totp_disable',
  'auth_totp_enable',
  'auth_totp_secret',
  'auth_totp_secret_for',
  'auth_totp_spend',
  'delete_my_account',
  'digest_off',
  'github_person_retoken',
  'github_person_token',
  /* 328: a code asked beside an invitation on a host. */
  'host_code_ask',
  'host_code_live',
  'host_code_make',
  'host_code_spend',
  'host_code_try',
  'instance_add_owner',
  'instance_mail_clear',
  'instance_mail_write',
  'instance_remove_owner',
  'instance_setup_owner',
  'nowhere_session_end',
  'oauth_agent_link',
  'oauth_code_make',
  'oauth_code_take',
  'oauth_refresh_take',
  'oauth_token_bind',
  'operator_delete_account',
  'register_owner',
]
