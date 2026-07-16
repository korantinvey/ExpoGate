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
      id, libelle, categorie, statut_conformite, commentaire, stand_id,
      stands ( numero, nom_exposant, evenement_id, evenements ( nom ) )
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
    const body = await req.json().catch(() => ({}))
    const commentairePrestataire = typeof body.commentaire === 'string' ? body.commentaire : null

    const { error: updErr } = await sbAdmin
      .from('prestations')
      .update({
        statut_conformite: 'a_verifier',
        date_retour_a_verifier: new Date().toISOString(),
        ...(commentairePrestataire ? { commentaire_prestataire: commentairePrestataire } : {}),
      })
      .eq('id', tok.prestation_id)

    if (updErr) return json({ error: 'erreur_mise_a_jour' }, 500)

    await sbAdmin
      .from('email_action_tokens')
      .update({ used: true })
      .eq('id', tok.id)

    // Notifie organisateurs et contrôleur du stand
    const stand = presta.stands as { numero: string; nom_exposant: string | null; evenement_id: string; evenements: { nom: string } | null } | null
    if (stand) {
      const msgTitle = `Correction signalée — ${presta.libelle}`
      const standInfo = `${stand.numero}${stand.nom_exposant ? ` — ${stand.nom_exposant}` : ''}`
      const msgBody = `Stand ${standInfo} · ${stand.evenements?.nom ?? ''}`

      const { data: orgas } = await sbAdmin
        .from('user_evenements')
        .select('user_id, users ( email, prenom, nom )')
        .eq('evenement_id', stand.evenement_id)
        .eq('role_local', 'organisateur')

      const { data: cs } = await sbAdmin
        .from('controleur_stands')
        .select('user_evenements ( user_id, users ( email, prenom, nom ) )')
        .eq('stand_id', (presta as { stand_id: string }).stand_id)

      type UserRow = { user_id: string; email: string; prenom: string; nom: string }

      const orgaUsers: UserRow[] = (orgas ?? [])
        .map((r: { user_id: string; users: { email: string; prenom: string; nom: string } | null }) =>
          r.users ? { user_id: r.user_id, ...r.users } : null)
        .filter(Boolean) as UserRow[]

      const controleurUsers: UserRow[] = (cs ?? [])
        .map((r: { user_evenements: { user_id: string; users: { email: string; prenom: string; nom: string } | null } | null }) =>
          r.user_evenements?.users ? { user_id: r.user_evenements.user_id, ...r.user_evenements.users } : null)
        .filter(Boolean) as UserRow[]

      const seen = new Set<string>()
      const toNotify = [...orgaUsers, ...controleurUsers].filter(u => {
        if (seen.has(u.user_id)) return false
        seen.add(u.user_id)
        return true
      })

      for (const u of toNotify) {
        await sbAdmin.from('messages').insert({ user_id: u.user_id, title: msgTitle, body: msgBody })
      }

      const userIds = toNotify.map(u => u.user_id)
      if (userIds.length > 0) {
        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'apikey': Deno.env.get('SUPABASE_ANON_KEY')!,
          },
          body: JSON.stringify({ user_ids: userIds, title: msgTitle, body: msgBody }),
        }).catch(() => {})
      }

      // Email via Resend
      const resendKey = Deno.env.get('RESEND_API_KEY')
      const destinatairesEmail = toNotify.filter(u => u.email)
      if (resendKey && destinatairesEmail.length > 0) {
        const categorie = (presta as { categorie: string | null }).categorie
        const categorieStr = categorie ? ` (${categorie})` : ''
        const nbPhotos = 0 // les photos sont déjà uploadées avant cette requête

        const emailHtml = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
        <tr><td style="background:#1e293b;padding:24px 32px;">
          <span style="color:#ffffff;font-size:20px;font-weight:700;">Expogate</span>
          <span style="color:#94a3b8;font-size:14px;margin-left:12px;">Correction signalée</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px;color:#64748b;font-size:14px;">Bonjour,</p>
          <p style="margin:0 0 24px;color:#0f172a;font-size:16px;">
            Le prestataire a signalé avoir <strong>corrigé la non-conformité</strong> sur la prestation suivante.
            Un passage de vérification est à planifier.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:24px;">
            <tr>
              <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;">
                <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.05em;">Événement</span><br>
                <strong style="color:#0f172a;">${stand.evenements?.nom ?? ''}</strong>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;">
                <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.05em;">Prestation</span><br>
                <strong style="color:#0f172a;">${presta.libelle}${categorieStr}</strong>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 16px;${presta.commentaire || commentairePrestataire ? 'border-bottom:1px solid #e2e8f0;' : ''}">
                <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.05em;">Stand</span><br>
                <strong style="color:#0f172a;">${standInfo}</strong>
              </td>
            </tr>
            ${presta.commentaire ? `
            <tr>
              <td style="padding:12px 16px;${commentairePrestataire ? 'border-bottom:1px solid #e2e8f0;' : ''}">
                <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.05em;">Commentaire du contrôleur</span><br>
                <span style="color:#374151;font-style:italic;">${presta.commentaire}</span>
              </td>
            </tr>` : ''}
            ${commentairePrestataire ? `
            <tr>
              <td style="padding:12px 16px;">
                <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.05em;">Commentaire du prestataire</span><br>
                <span style="color:#374151;font-style:italic;">${commentairePrestataire}</span>
              </td>
            </tr>` : ''}
          </table>
          <p style="margin:0;color:#64748b;font-size:13px;">
            La prestation est désormais en statut <strong>« À vérifier »</strong>.${nbPhotos > 0 ? ` Le prestataire a joint ${nbPhotos} photo(s) comme preuve de correction.` : ''}<br>
            Cet email est envoyé automatiquement par la plateforme Expogate.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: Deno.env.get('RESEND_FROM') ?? 'Expogate <no-reply@expogate.fr>',
            to: Deno.env.get('TEST_EMAIL_OVERRIDE')
              ? [Deno.env.get('TEST_EMAIL_OVERRIDE')!]
              : destinatairesEmail.map(u => u.email),
            subject: `[À vérifier] ${presta.libelle} — Stand ${standInfo}`,
            html: emailHtml,
          }),
        }).catch(() => {})
      }
    }

    return json({ success: true })
  }

  return json({ error: 'methode_non_supportee' }, 405)
})
