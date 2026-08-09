import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify the caller is a logged-in admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const { data: profile } = await userClient
      .from('profiles')
      .select('role, org_id')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return json({ error: 'Forbidden — admin access required.' }, 403)
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { email, org_id, resend } = await req.json()

    if (!email || !org_id) {
      return json({ error: 'Missing email or org_id' }, 400)
    }

    // Send the invite link back to whichever origin actually triggered it,
    // instead of relying on the project's Site URL — that default drifts
    // out of sync as soon as the dev port changes or the app moves to a
    // real domain. The origin still has to be allow-listed in Supabase's
    // Auth > URL Configuration > Redirect URLs for this to be honoured.
    const origin = req.headers.get('origin')
    const redirectTo = origin ? `${origin}/dashboard` : undefined
    const inviteOptions = { data: { org_id }, ...(redirectTo ? { redirectTo } : {}) }

    if (resend) {
      // GoTrue has no native "resend invite" call — inviteUserByEmail
      // always errors once a user row exists for that email, confirmed or
      // not. The documented workaround is to delete the stale, still-
      // unconfirmed user and re-invite from scratch. We only ever do this
      // for an unconfirmed user — an already-active account is never
      // deleted, even if a resend is explicitly requested.
      const { data: list, error: listErr } = await adminClient.auth.admin.listUsers({ perPage: 200 })
      if (listErr) return json({ error: listErr.message }, 500)

      const existing = list.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
      if (!existing) {
        return json({ error: 'No pending invite found for this email — try inviting them fresh instead.', code: 'no_pending_invite' }, 404)
      }
      if (existing.email_confirmed_at) {
        return json({
          error: 'This person already has an account and has signed in — they can\'t be re-invited. If they\'re locked out, they should use "Forgot password" on the sign-in screen instead.',
          code: 'already_member',
        }, 409)
      }

      const { error: deleteErr } = await adminClient.auth.admin.deleteUser(existing.id)
      if (deleteErr) return json({ error: deleteErr.message }, 500)

      const { error: reinviteErr } = await adminClient.auth.admin.inviteUserByEmail(email, inviteOptions)
      if (reinviteErr) return json({ error: reinviteErr.message }, 400)

      return json({ success: true })
    }

    const { error } = await adminClient.auth.admin.inviteUserByEmail(email, inviteOptions)

    if (error) {
      // email_exists fires for both a fully active account AND a pending,
      // unconfirmed invite — we can't tell which from this error alone, so
      // surface a single "already_invited" code and let the caller decide
      // (via the resend:true path above) whether that's actually safe.
      const alreadyExists = error.code === 'email_exists' || /already.*(registered|exists)/i.test(error.message || '')
      if (alreadyExists) {
        return json({
          error: 'Someone has already been invited (or has an account) with this email.',
          code: 'already_invited',
        }, 409)
      }
      return json({ error: error.message }, 400)
    }

    return json({ success: true })

  } catch (err) {
    return json({ error: err.message }, 500)
  }
})
