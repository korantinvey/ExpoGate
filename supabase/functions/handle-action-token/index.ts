import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const HTML = (title: string, message: string, color: string) => `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} — Expogate</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #f4f4f5; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
    .card { background: #fff; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,.1); max-width: 480px; width: 100%; overflow: hidden; }
    .card-header { background: #1e293b; padding: 20px 28px; }
    .card-header span { color: #fff; font-size: 18px; font-weight: 700; }
    .card-header small { color: #94a3b8; font-size: 13px; margin-left: 10px; }
    .card-body { padding: 32px 28px; }
    .icon { font-size: 48px; text-align: center; margin-bottom: 20px; }
    h1 { font-size: 20px; color: #0f172a; margin-bottom: 10px; }
    p { font-size: 15px; color: #64748b; line-height: 1.5; }
    .badge { display: inline-block; margin-top: 20px; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; background: ${color}20; color: ${color}; }
  </style>
</head>
<body>
  <div class="card">
    <div class="card-header">
      <span>Expogate</span><small>Confirmation</small>
    </div>
    <div class="card-body">
      <div class="icon">${color === '#22c55e' ? '✅' : color === '#f97316' ? '⚠️' : 'ℹ️'}</div>
      <h1>${title}</h1>
      <p>${message}</p>
      <span class="badge">${title}</span>
    </div>
  </div>
</body>
</html>`

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')

  if (!token) {
    return new Response(HTML('Lien invalide', 'Ce lien ne contient pas de jeton d\'action. Vérifiez le lien dans votre email.', '#ef4444'), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const sbAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: actionToken, error: tokenErr } = await sbAdmin
    .from('action_tokens')
    .select('id, prestation_id, action, expires_at, used_at')
    .eq('id', token)
    .single()

  if (tokenErr || !actionToken) {
    return new Response(HTML('Lien invalide', 'Ce lien d\'action est introuvable ou a expiré. Vérifiez le lien dans votre email.', '#ef4444'), {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  if (actionToken.used_at) {
    return new Response(HTML('Déjà traité', 'Cette action a déjà été effectuée. Votre prestation a été signalée comme étant en cours de correction.', '#f97316'), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  if (new Date(actionToken.expires_at) < new Date()) {
    return new Response(HTML('Lien expiré', 'Ce lien d\'action a expiré. Contactez l\'organisateur de l\'événement si vous souhaitez signaler une correction.', '#ef4444'), {
      status: 410,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const { data: presta, error: prestaErr } = await sbAdmin
    .from('prestations')
    .select('id, libelle, statut_conformite, date_retour_a_verifier')
    .eq('id', actionToken.prestation_id)
    .single()

  if (prestaErr || !presta) {
    return new Response(HTML('Prestation introuvable', 'La prestation associée à ce lien est introuvable. Elle a peut-être été supprimée.', '#ef4444'), {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  if (presta.statut_conformite !== 'non_conforme' && presta.statut_conformite !== 'absent') {
    await sbAdmin.from('action_tokens').update({ used_at: new Date().toISOString() }).eq('id', token)
    return new Response(HTML('Déjà traité', `La prestation "${presta.libelle}" n'est plus en anomalie. Aucune action supplémentaire n'est nécessaire.`, '#f97316'), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const now = new Date().toISOString()
  const { error: updateErr } = await sbAdmin
    .from('prestations')
    .update({
      statut_conformite: 'a_verifier',
      date_retour_a_verifier: presta.date_retour_a_verifier ?? now,
    })
    .eq('id', presta.id)

  if (updateErr) {
    return new Response(HTML('Erreur', 'Une erreur est survenue lors du traitement de votre demande. Veuillez réessayer ultérieurement.', '#ef4444'), {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  await sbAdmin.from('action_tokens').update({ used_at: now }).eq('id', token)

  return new Response(HTML(
    'Correction signalée',
    `Merci ! La prestation "${presta.libelle}" a bien été marquée comme corrigée et sera revérifiée par le contrôleur lors de son prochain passage.`,
    '#22c55e'
  ), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
})
