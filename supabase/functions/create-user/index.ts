import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Client avec la clé anon + JWT de l'appelant pour vérifier son identité
    const sbCaller = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Vérifie que l'appelant est bien un admin
    const { data: { user }, error: authError } = await sbCaller.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Non authentifié.' }), { status: 401, headers: corsHeaders })
    }

    const { data: profile } = await sbCaller.from('users').select('is_admin').eq('id', user.id).single()
    if (!profile?.is_admin) {
      return new Response(JSON.stringify({ error: 'Accès réservé aux administrateurs.' }), { status: 403, headers: corsHeaders })
    }

    // Client admin avec service_role — uniquement côté serveur, jamais exposé
    const sbAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { email, password, prenom, nom, is_admin } = await req.json()

    if (!email || !password || !prenom || !nom) {
      return new Response(JSON.stringify({ error: 'Champs manquants.' }), { status: 400, headers: corsHeaders })
    }

    const { data, error: createError } = await sbAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { prenom, nom },
    })

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), { status: 400, headers: corsHeaders })
    }

    await sbAdmin.from('users').update({ prenom, nom, is_admin: !!is_admin }).eq('id', data.user.id)

    return new Response(JSON.stringify({ id: data.user.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders })
  }
})
