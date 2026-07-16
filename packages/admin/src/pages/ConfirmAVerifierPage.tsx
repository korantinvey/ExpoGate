import { useEffect, useState } from 'react'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

const STATUT_LABELS: Record<string, string> = {
  non_conforme: 'Non conforme',
  absent: 'Absent',
  conforme: 'Conforme',
  a_verifier: 'À vérifier',
}

const STATUT_COLORS: Record<string, string> = {
  non_conforme: '#f97316',
  absent: '#ef4444',
  conforme: '#22c55e',
  a_verifier: '#6b7280',
}

type State =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'deja_utilise' }
  | { phase: 'confirm'; prestation: { libelle: string; categorie: string | null; statut_conformite: string | null; commentaire: string | null }; stand: { numero: string; nom_exposant: string | null; evenement_nom: string | null } | null }
  | { phase: 'success'; libelle: string; stand: string }

export function ConfirmAVerifierPage() {
  const token = new URLSearchParams(window.location.search).get('token')
  const [state, setState] = useState<State>({ phase: 'loading' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) { setState({ phase: 'error', message: 'Lien invalide ou incomplet.' }); return }

    fetch(`${SUPABASE_URL}/functions/v1/confirm-a-verifier?token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error === 'deja_utilise') { setState({ phase: 'deja_utilise' }); return }
        if (data.error === 'token_expire') { setState({ phase: 'error', message: 'Ce lien a expiré (délai de 7 jours dépassé). Contactez l\'organisateur.' }); return }
        if (data.error || !data.prestation) { setState({ phase: 'error', message: 'Lien introuvable ou invalide.' }); return }
        setState({ phase: 'confirm', prestation: data.prestation, stand: data.stand })
      })
      .catch(() => setState({ phase: 'error', message: 'Impossible de contacter le serveur.' }))
  }, [token])

  async function handleConfirm() {
    if (!token) return
    setSubmitting(true)
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/confirm-a-verifier?token=${token}`, { method: 'POST' })
      const data = await r.json()
      if (data.success) {
        const s = state as Extract<State, { phase: 'confirm' }>
        const standStr = s.stand ? `${s.stand.numero}${s.stand.nom_exposant ? ` — ${s.stand.nom_exposant}` : ''}` : ''
        setState({ phase: 'success', libelle: s.prestation.libelle, stand: standStr })
      } else {
        setState({ phase: 'error', message: 'Une erreur est survenue. Veuillez réessayer.' })
      }
    } catch {
      setState({ phase: 'error', message: 'Impossible de contacter le serveur.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f4f4f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,.10)', maxWidth: 480, width: '100%', overflow: 'hidden' }}>
        <div style={{ background: '#1e293b', padding: '20px 28px', display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>Expogate</span>
          <span style={{ color: '#94a3b8', fontSize: 13 }}>Confirmation de correction</span>
        </div>

        {state.phase === 'loading' && (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Chargement…</div>
        )}

        {state.phase === 'error' && (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Lien invalide</div>
            <div style={{ color: '#64748b', fontSize: 14, lineHeight: 1.6 }}>{state.message}</div>
          </div>
        )}

        {state.phase === 'deja_utilise' && (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Déjà enregistré</div>
            <div style={{ color: '#64748b', fontSize: 14, lineHeight: 1.6 }}>
              Cette correction a déjà été signalée. Un contrôleur passera vérifier votre installation prochainement.
            </div>
          </div>
        )}

        {state.phase === 'confirm' && (() => {
          const { prestation, stand } = state
          const statut = prestation.statut_conformite ?? ''
          const standInfo = stand ? `${stand.numero}${stand.nom_exposant ? ` — ${stand.nom_exposant}` : ''}` : '—'
          const categorie = prestation.categorie ? ` (${prestation.categorie})` : ''
          return (
            <>
              <div style={{ padding: 28 }}>
                <p style={{ margin: '0 0 20px', color: '#0f172a', fontSize: 15, lineHeight: 1.5 }}>
                  Vous êtes sur le point de signaler que la non-conformité ci-dessous a été <strong>corrigée</strong>.
                  Un contrôleur passera ensuite vérifier l'installation.
                </p>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: 16, marginBottom: 24 }}>
                  {stand?.evenement_nom && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: '#64748b', marginBottom: 2 }}>Événement</div>
                      <div style={{ fontSize: 15, color: '#0f172a', fontWeight: 600 }}>{stand.evenement_nom}</div>
                    </div>
                  )}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: '#64748b', marginBottom: 2 }}>Prestation</div>
                    <div style={{ fontSize: 15, color: '#0f172a', fontWeight: 600 }}>{prestation.libelle}{categorie}</div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: '#64748b', marginBottom: 2 }}>Stand</div>
                    <div style={{ fontSize: 15, color: '#0f172a', fontWeight: 600 }}>{standInfo}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: '#64748b', marginBottom: 4 }}>Statut actuel</div>
                    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 4, fontSize: 13, fontWeight: 600, background: `${STATUT_COLORS[statut] ?? '#6b7280'}20`, color: STATUT_COLORS[statut] ?? '#6b7280' }}>
                      {STATUT_LABELS[statut] ?? statut}
                    </span>
                    {prestation.commentaire && (
                      <div style={{ marginTop: 8, color: '#374151', fontSize: 13, fontStyle: 'italic' }}>"{prestation.commentaire}"</div>
                    )}
                  </div>
                </div>
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '12px 16px', color: '#1d4ed8', fontSize: 13, lineHeight: 1.5 }}>
                  En confirmant, la prestation passera en statut <strong>« À vérifier »</strong> et
                  l'organisateur sera informé que vous avez apporté les corrections nécessaires.
                </div>
              </div>
              <div style={{ padding: '0 28px 28px' }}>
                <button
                  onClick={handleConfirm}
                  disabled={submitting}
                  style={{ display: 'block', width: '100%', padding: 12, border: 'none', borderRadius: 6, fontSize: 15, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', background: '#1e293b', color: '#fff', opacity: submitting ? 0.7 : 1 }}
                >
                  {submitting ? 'Envoi en cours…' : 'Confirmer — ma correction est faite'}
                </button>
              </div>
            </>
          )
        })()}

        {state.phase === 'success' && (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Correction signalée !</div>
            <div style={{ color: '#64748b', fontSize: 14, lineHeight: 1.6 }}>
              Votre correction pour la prestation <strong>{state.libelle}</strong>
              {state.stand && <> (stand {state.stand})</>} a bien été enregistrée.<br /><br />
              Un contrôleur passera vérifier votre installation prochainement.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
