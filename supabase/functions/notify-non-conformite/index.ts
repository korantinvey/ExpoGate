import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const STATUT_LABELS: Record<string, string> = {
  non_conforme: 'Non conforme',
  absent: 'Absent',
  conforme: 'Conforme',
}

const STATUT_COLORS: Record<string, string> = {
  non_conforme: '#f97316',
  absent: '#ef4444',
  conforme: '#22c55e',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const sbCaller = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user }, error: authError } = await sbCaller.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Non authentifié.' }), { status: 401, headers: corsHeaders })
    }

    const sbAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { prestation_id } = await req.json()
    if (!prestation_id) {
      return new Response(JSON.stringify({ error: 'prestation_id manquant.' }), { status: 400, headers: corsHeaders })
    }

    // Récupère la prestation avec ses jointures
    const { data: presta, error: prestErr } = await sbAdmin
      .from('prestations')
      .select(`
        id, libelle, categorie, statut_conformite, commentaire,
        stand_id,
        stands ( id, numero, nom_exposant, evenement_id,
          evenements ( id, nom, lieu )
        ),
        prestataire_id,
        prestataires ( id, raison_sociale, email_contact )
      `)
      .eq('id', prestation_id)
      .single()

    if (prestErr || !presta) {
      return new Response(JSON.stringify({ error: 'Prestation introuvable.' }), { status: 404, headers: corsHeaders })
    }

    const prestataire = presta.prestataires as { id: string; raison_sociale: string } | null
    const stand = presta.stands as { numero: string; nom_exposant: string | null; evenement_id: string; evenements: { nom: string; lieu: string | null } | null } | null

    if (!prestataire || !stand) {
      return new Response(JSON.stringify({ skipped: true, reason: 'Prestataire ou stand introuvable.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Récupère les utilisateurs rattachés à ce prestataire sur cet événement
    const { data: membres } = await sbAdmin
      .from('user_evenements')
      .select('users ( email, prenom, nom )')
      .eq('evenement_id', stand.evenement_id)
      .eq('prestataire_id', prestataire.id)

    const destinataires = (membres ?? [])
      .map((m: { users: { email: string; prenom: string; nom: string } | null }) => m.users)
      .filter((u): u is { email: string; prenom: string; nom: string } => !!u?.email)

    if (destinataires.length === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: 'Aucun utilisateur avec email rattaché à ce prestataire.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY non configurée.' }), { status: 500, headers: corsHeaders })
    }

    const statut = presta.statut_conformite as string
    const statutLabel = STATUT_LABELS[statut] ?? statut
    const statutColor = STATUT_COLORS[statut] ?? '#6b7280'
    const evenementNom = stand?.evenements?.nom ?? 'Événement'
    const standInfo = stand ? `${stand.numero}${stand.nom_exposant ? ` — ${stand.nom_exposant}` : ''}` : '—'
    const categorie = presta.categorie ? ` (${presta.categorie})` : ''

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
        <tr><td style="background:#1e293b;padding:24px 32px;">
          <span style="color:#ffffff;font-size:20px;font-weight:700;">Expogate</span>
          <span style="color:#94a3b8;font-size:14px;margin-left:12px;">Alerte de conformité</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px;color:#64748b;font-size:14px;">Bonjour,</p>
          <p style="margin:0 0 24px;color:#0f172a;font-size:16px;">
            Une prestation vous concernant vient d'être marquée
            <strong style="color:${statutColor};">${statutLabel}</strong>
            lors du contrôle de l'événement <strong>${evenementNom}</strong>.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:24px;">
            <tr>
              <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;">
                <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.05em;">Prestation</span><br>
                <strong style="color:#0f172a;">${presta.libelle}${categorie}</strong>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;">
                <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.05em;">Stand</span><br>
                <strong style="color:#0f172a;">${standInfo}</strong>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;">
                <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.05em;">Statut</span><br>
                <span style="display:inline-block;padding:4px 10px;border-radius:4px;background:${statutColor}20;color:${statutColor};font-weight:600;">${statutLabel}</span>
              </td>
            </tr>
            ${presta.commentaire ? `
            <tr>
              <td style="padding:12px 16px;">
                <span style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.05em;">Commentaire du contrôleur</span><br>
                <span style="color:#374151;font-style:italic;">${presta.commentaire}</span>
              </td>
            </tr>` : ''}
          </table>
          <p style="margin:0;color:#64748b;font-size:13px;">
            Veuillez prendre les mesures correctives nécessaires et contacter l'organisateur de l'événement.<br>
            Cet email est envoyé automatiquement par la plateforme Expogate.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: Deno.env.get('RESEND_FROM') ?? 'Expogate <no-reply@expogate.fr>',
        to: Deno.env.get('TEST_EMAIL_OVERRIDE') ? [Deno.env.get('TEST_EMAIL_OVERRIDE')!] : destinataires.map(u => u.email),
        subject: `[${statutLabel}] Prestation "${presta.libelle}" — ${evenementNom}`,
        html,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      return new Response(JSON.stringify({ error: `Resend: ${body}` }), { status: 500, headers: corsHeaders })
    }

    return new Response(JSON.stringify({ sent: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders })
  }
})
