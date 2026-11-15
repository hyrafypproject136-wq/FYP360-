// FYP360 · admin-accounts Edge Function
// Creates logins, resets passwords and deletes logins. Only the coordinator may call it.
// Needs the service-role key, which is why this cannot run in the browser.
//
// Deploy:  supabase functions deploy admin-accounts
// Optional e-mail (password-change notices) through Resend:
//          supabase secrets set RESEND_API_KEY=... EMAIL_FROM="FYP360 <fyp@your-domain>"

import { createClient } from 'npm:@supabase/supabase-js@2';

const LOGIN_EMAIL_DOMAIN = 'login.fyp360.app';
const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;
const STAFF_ROLES = ['coordinator', 'supervisor', 'jury'];

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const url = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

function checkPassword(password: unknown): string {
  if (typeof password !== 'string' || password.length < 8) {
    throw new HttpError(400, 'Password must be at least 8 characters.');
  }
  return password;
}

function checkUsername(username: unknown): string {
  const u = typeof username === 'string' ? username.trim().toLowerCase() : '';
  if (!USERNAME_RE.test(u)) {
    throw new HttpError(400, 'Username must be 3–32 characters: lowercase letters, numbers, dot, dash or underscore.');
  }
  return u;
}

async function audit(actorId: string, action: string, target: string | null, details: Record<string, unknown> = {}) {
  await admin.from('audit_log').insert({ actor_id: actorId, action, target, details });
}

async function createLogin(username: string, password: string, profile: Record<string, unknown>) {
  const { data: taken } = await admin.from('profiles').select('id').eq('username', username).maybeSingle();
  if (taken) throw new HttpError(409, `Username "${username}" is already in use.`);

  const { data, error } = await admin.auth.admin.createUser({
    email: `${username}@${LOGIN_EMAIL_DOMAIN}`,
    password,
    email_confirm: true,
    app_metadata: { fyp360_role: profile.role },
  });
  if (error || !data.user) throw new HttpError(400, error?.message ?? 'Could not create the login.');

  const { error: profileError } = await admin.from('profiles').insert({ id: data.user.id, username, ...profile });
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    throw new HttpError(400, profileError.message);
  }
  return data.user.id;
}

async function notifyGroup(groupId: string, kind: string, subject: string, message: string) {
  await admin.from('notifications').insert({ group_id: groupId, kind, message });

  const resendKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('EMAIL_FROM');
  if (!resendKey || !from) return { emailed: 0, emailConfigured: false };

  const { data: members } = await admin.from('group_members').select('email').eq('group_id', groupId);
  const to = (members ?? []).map((m) => m.email);
  if (to.length === 0) return { emailed: 0, emailConfigured: true };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, text: message }),
  });
  return { emailed: res.ok ? to.length : 0, emailConfigured: true, emailError: res.ok ? undefined : await res.text() };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    // 1. Who is calling? Must be the coordinator.
    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
      auth: { persistSession: false },
    });
    const { data: me } = await caller.rpc('whoami').maybeSingle<{ role: string; profile_id: string }>();
    if (!me || me.role !== 'coordinator') throw new HttpError(403, 'Only the FYP coordinator can manage accounts.');
    const actorId = me.profile_id;

    const body = await req.json();

    switch (body.action) {
      // ---- one shared login for a whole group
      case 'create_group_login': {
        const username = checkUsername(body.username);
        const password = checkPassword(body.password);
        const { data: group } = await admin.from('groups').select('id, code, name, account_id, status').eq('id', body.group_id).maybeSingle();
        if (!group) throw new HttpError(404, 'Group not found.');
        if (group.account_id) throw new HttpError(409, 'This group already has a login. Reset its password instead.');
        if (group.status !== 'active') throw new HttpError(400, `Group ${group.code} is ${group.status}.`);

        const id = await createLogin(username, password, { role: 'group', display_name: group.name });
        await admin.from('groups').update({ account_id: id }).eq('id', group.id);
        await audit(actorId, 'account.create', group.code, { username, role: 'group' });
        const notice = await notifyGroup(
          group.id,
          'account_created',
          'Your FYP360 group portal is ready',
          `Your FYP360 group portal for ${group.code} (${group.name}) is ready. ` +
            `Your group lead has the username and password from the FYP coordinator. ` +
            `You can also use "Sign in with Google" with the e-mail you gave the department.`,
        );
        return json({ ok: true, profile_id: id, ...notice });
      }

      // ---- supervisor / jury / coordinator logins
      case 'create_staff_login': {
        const username = checkUsername(body.username);
        const password = checkPassword(body.password);
        if (!STAFF_ROLES.includes(body.role)) throw new HttpError(400, 'Role must be coordinator, supervisor or jury.');
        const displayName = String(body.display_name ?? '').trim();
        if (!displayName) throw new HttpError(400, 'Name is required.');
        const contactEmail = body.contact_email ? String(body.contact_email).trim().toLowerCase() : null;

        const id = await createLogin(username, password, { role: body.role, display_name: displayName, contact_email: contactEmail });
        await audit(actorId, 'account.create', username, { role: body.role, display_name: displayName });
        return json({ ok: true, profile_id: id });
      }

      // ---- reset (the old password is never shown, only replaced)
      case 'reset_password': {
        const password = checkPassword(body.password);
        const { data: profile } = await admin.from('profiles').select('id, role, username').eq('id', body.profile_id).maybeSingle();
        if (!profile) throw new HttpError(404, 'Account not found.');

        const { error } = await admin.auth.admin.updateUserById(profile.id, { password });
        if (error) throw new HttpError(400, error.message);
        await audit(actorId, 'account.reset_password', profile.username, { role: profile.role });

        if (body.request_id) {
          await admin.from('password_reset_requests')
            .update({ status: 'done', resolved_by: actorId, resolved_at: new Date().toISOString() })
            .eq('id', body.request_id);
        }

        let notice = {};
        if (profile.role === 'group') {
          const { data: group } = await admin.from('groups').select('id, code, name').eq('account_id', profile.id).maybeSingle();
          if (group) {
            notice = await notifyGroup(
              group.id,
              'password_changed',
              'Your FYP360 group portal password has been changed',
              `The FYP coordinator has changed the password of your FYP360 group portal (${group.code} · ${group.name}). ` +
                `Get the new password from your group lead. You can sign in to the portal right now.`,
            );
          }
        }
        return json({ ok: true, ...notice });
      }

      case 'delete_login': {
        const { data: profile } = await admin.from('profiles').select('id, role, username').eq('id', body.profile_id).maybeSingle();
        if (!profile) throw new HttpError(404, 'Account not found.');
        if (profile.id === actorId) throw new HttpError(400, 'You cannot delete your own login.');
        const { error } = await admin.auth.admin.deleteUser(profile.id);
        if (error) throw new HttpError(400, error.message);
        await audit(actorId, 'account.delete', profile.username, { role: profile.role });
        return json({ ok: true });
      }

      default:
        throw new HttpError(400, 'Unknown action.');
    }
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return json({ error: e instanceof Error ? e.message : 'Unexpected error' }, status);
  }
});
