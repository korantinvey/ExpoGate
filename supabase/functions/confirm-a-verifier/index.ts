import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const sbAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const url = new URL(req.url)
  const token = url.searchParams.get('token')

  if (!token) return json({ error: 'token_manquant' }, 400)

  const { data: tok, error: tokErr } = await sbAdmin
    .from('email_action_tokens')
    .select('id, prestation_id, action, used, expires_at')
    .eq('id', token)
    .single()

  if (tokErr || !tok) return json({ error: 'token_invalide' }, 404)
  if (tok.used) return json({ error: 'deja_utilise' }, 200)
  if (new Date(tok.expires_at) < new Date()) return json({ error: 'token_expire' }, 200)

  const { data: presta } = await sbAdmin
    .from('prestations')
    .select(`
      id, libelle, categorie, statut_conformite, commentaire,
      stands ( numero, nom_exposant, evenements ( nom ) )
    `)
    .eq('id', tok.prestation_id)
    .single()

  if (!presta) return json({ error: 'prestation_introuvable' }, 404)

  // GET → renvoie les détails pour affichage
  if (req.method === 'GET') {
    const stand = presta.stands as { numero: string; nom_exposant: string | null; evenements: { nom: string } | null } | null
    return json({
      prestation: {
        id: presta.id,
        libelle: presta.libelle,
        categorie: presta.categorie,
        statut_conformite: presta.statut_conformite,
        commentaire: presta.commentaire,
      },
      stand: stand ? {
        numero: stand.numero,
        nom_exposant: stand.nom_exposant,
        evenement_nom: stand.evenements?.nom ?? null,
      } : null,
    })
  }

  if (req.method === 'POST') {
    const upload = url.searchParams.get('upload') === 'true'

    // POST ?upload=true → upload une photo
    if (upload) {
      const contentType = req.headers.get('content-type') ?? ''
      if (!contentType.includes('multipart/form-data')) {
        return json({ error: 'multipart_requis' }, 400)
      }

      const form = await req.formData()
      const file = form.get('photo') as File | null
      if (!file) return json({ error: 'fichier_manquant' }, 400)

      const ext = file.type === 'image/png' ? 'png' : 'jpg'
      const path = `${tok.prestation_id}/prestataire_${crypto.randomUUID()}.${ext}`

      const { error: uploadErr } = await sbAdmin.storage
        .from('Photos')
        .upload(path, file, { contentType: file.type, upsert: false })

      if (uploadErr) return json({ error: `upload_failed: ${uploadErr.message}` }, 500)

      const { data: urlData } = sbAdmin.storage.from('Photos').getPublicUrl(path)

      const { data: photoRow, error: insertErr } = await sbAdmin
        .from('photos')
        .insert({ prestation_id: tok.prestation_id, url: urlData.publicUrl, synced: true })
        .select('id')
        .single()

      if (insertErr) return json({ error: `insert_failed: ${insertErr.message}` }, 500)

      return json({ photo_id: photoRow.id, url: urlData.publicUrl })
    }

    // POST → confirme la correction
    const { error: updErr } = await sbAdmin
      .from('prestations')
      .update({
        statut_conformite: 'a_verifier',
        date_retour_a_verifier: new Date().toISOString(),
      })
      .eq('id', tok.prestation_id)

    if (updErr) return json({ error: 'erreur_mise_a_jour' }, 500)

    await sbAdmin
      .from('email_action_tokens')
      .update({ used: true })
      .eq('id', tok.id)

    return json({ success: true })
  }

  return json({ error: 'methode_non_supportee' }, 405)
})
