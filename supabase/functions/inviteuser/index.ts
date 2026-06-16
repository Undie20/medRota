import { serve } from 'https://deno.land/x/sift@0.6.0/mod.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    })
  }

  try {
    // Verify the caller is a logged-in admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401 })

    // Create a client with the caller's token to check their role
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return new Response('Unauthorized', { status: 401 })

    const { data: profile } = await userClient
      .from('profiles')
      .select('role, org_id')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return new Response('Forbidden', { status: 403 })
    }

    // Now use the service role key to send the invite
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { email, org_id } = await req.json()

    if (!email || !org_id) {
      return new Response('Missing email or org_id', { status: 400 })
    }

    const { error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { org_id }
    })

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
})