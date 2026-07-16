import { useEffect, useRef, useState } from 'react'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const API = `${SUPABASE_URL}/functions/v1/confirm-a-verifier`

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

type Photo = { id: string; url: string; preview: string; uploading?: boolean; error?: boolean }

type State =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'deja_utilise' }
  | { phase: 'confirm'; prestation: { libelle: string; categorie: string | null; statut_conformite: string | null; commentaire: string | null }; stand: { numero: string; nom_exposant: string | null; evenement_nom: string | null } | null }
  | { phase: 'success'; libelle: string; stand: string }

export function ConfirmAVerifierPage() {
  const token = new URLSearchParams(window.location.search).get('token')
  const [state, setState] = useState<State>({ phase: 'loading' })
  const [photos, setPhotos] = useState<Photo[]>([])
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [showPhotoMenu, setShowPhotoMenu] = useState(false)

  useEffect(() => {
    if (!token) { setState({ phase: 'error', message: 'Lien invalide ou incomplet.' }); return }

    fetch(`${API}?token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error === 'deja_utilise') { setState({ phase: 'deja_utilise' }); return }
        if (data.error === 'token_expire') { setState({ phase: 'error', message: 'Ce lien a expiré (délai de 7 jours dépassé). Contactez l\'organisateur.' }); return }
        if (data.error || !data.prestation) { setState({ phase: 'error', message: 'Lien introuvable ou invalide.' }); return }
        setState({ phase: 'confirm', prestation: data.prestation, stand: data.stand })
      })
      .catch(() => setState({ phase: 'error', message: 'Impossible de contacter le serveur.' }))
  }, [token])

  async function handleFiles(files: FileList) {
    const newPhotos: Photo[] = Array.from(files).map(f => ({
      id: crypto.randomUUID(),
      url: '',
      preview: URL.createObjectURL(f),
      uploading: true,
    }))
    setPhotos(prev => [...prev, ...newPhotos])

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const localId = newPhotos[i].id
      const form = new FormData()
      form.append('photo', file)

      try {
        const r = await fetch(`${API}?token=${token}&upload=true`, { method: 'POST', body: form })
        const data = await r.json()
        if (data.url) {
          setPhotos(prev => prev.map(p => p.id === localId ? { ...p, url: data.url, uploading: false } : p))
        } else {
          setPhotos(prev => prev.map(p => p.id === localId ? { ...p, uploading: false, error: true } : p))
        }
      } catch {
        setPhotos(prev => prev.map(p => p.id === localId ? { ...p, uploading: false, error: true } : p))
      }
    }
  }

  function removePhoto(id: string) {
    setPhotos(prev => {
      const p = prev.find(p => p.id === id)
      if (p) URL.revokeObjectURL(p.preview)
      return prev.filter(p => p.id !== id)
    })
  }

  async function handleConfirm() {
    if (!token) return
    if (photos.some(p => p.uploading)) return
    setSubmitting(true)
    try {
      const r = await fetch(`${API}?token=${token}`, { method: 'POST' })
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

  const uploading = photos.some(p => p.uploading)

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

                {/* Détails prestation */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: 16, marginBottom: 20 }}>
                  {stand?.evenement_nom && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={labelStyle}>Événement</div>
                      <div style={valueStyle}>{stand.evenement_nom}</div>
                    </div>
                  )}
                  <div style={{ marginBottom: 12 }}>
                    <div style={labelStyle}>Prestation</div>
                    <div style={valueStyle}>{prestation.libelle}{categorie}</div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={labelStyle}>Stand</div>
                    <div style={valueStyle}>{standInfo}</div>
                  </div>
                  <div>
                    <div style={labelStyle}>Statut actuel</div>
                    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 4, fontSize: 13, fontWeight: 600, background: `${STATUT_COLORS[statut] ?? '#6b7280'}20`, color: STATUT_COLORS[statut] ?? '#6b7280' }}>
                      {STATUT_LABELS[statut] ?? statut}
                    </span>
                    {prestation.commentaire && (
                      <div style={{ marginTop: 8, color: '#374151', fontSize: 13, fontStyle: 'italic' }}>"{prestation.commentaire}"</div>
                    )}
                  </div>
                </div>

                {/* Section photos */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 8 }}>
                    Photos de preuve <span style={{ fontWeight: 400, color: '#64748b' }}>(optionnel)</span>
                  </div>

                  {photos.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                      {photos.map(p => (
                        <div key={p.id} style={{ position: 'relative', width: 80, height: 80, borderRadius: 6, overflow: 'hidden', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                          <img src={p.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: p.uploading ? 0.5 : p.error ? 0.4 : 1 }} />
                          {p.uploading && (
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>⏳</div>
                          )}
                          {p.error && (
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>❌</div>
                          )}
                          {!p.uploading && (
                            <button
                              onClick={() => removePhoto(p.id)}
                              style={{ position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                            >✕</button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* input galerie */}
                  <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = '' }} />
                  {/* input caméra */}
                  <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                    onChange={e => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = '' }} />

                  <button
                    onClick={() => setShowPhotoMenu(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', border: '1px dashed #cbd5e1', borderRadius: 6, background: '#f8fafc', color: '#475569', fontSize: 13, cursor: 'pointer', width: '100%', justifyContent: 'center' }}
                  >
                    📷 Ajouter des photos
                  </button>

                  {/* Menu de choix */}
                  {showPhotoMenu && (
                    <div
                      onClick={() => setShowPhotoMenu(false)}
                      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
                    >
                      <div
                        onClick={e => e.stopPropagation()}
                        style={{ background: '#fff', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 480, padding: '8px 16px 32px' }}
                      >
                        <div style={{ width: 36, height: 4, background: '#e2e8f0', borderRadius: 2, margin: '10px auto 20px' }} />
                        <button
                          onClick={() => { setShowPhotoMenu(false); cameraInputRef.current?.click() }}
                          style={menuBtnStyle}
                        >
                          <span style={{ fontSize: 22 }}>📷</span> Prendre une photo
                        </button>
                        <button
                          onClick={() => { setShowPhotoMenu(false); fileInputRef.current?.click() }}
                          style={menuBtnStyle}
                        >
                          <span style={{ fontSize: 22 }}>🖼️</span> Choisir dans la galerie
                        </button>
                        <button
                          onClick={() => setShowPhotoMenu(false)}
                          style={{ ...menuBtnStyle, color: '#94a3b8', marginTop: 8 }}
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '12px 16px', color: '#1d4ed8', fontSize: 13, lineHeight: 1.5 }}>
                  En confirmant, la prestation passera en statut <strong>« À vérifier »</strong> et
                  l'organisateur sera informé que vous avez apporté les corrections nécessaires.
                </div>
              </div>

              <div style={{ padding: '0 28px 28px' }}>
                <button
                  onClick={handleConfirm}
                  disabled={submitting || uploading}
                  style={{ display: 'block', width: '100%', padding: 12, border: 'none', borderRadius: 6, fontSize: 15, fontWeight: 600, cursor: (submitting || uploading) ? 'not-allowed' : 'pointer', background: '#1e293b', color: '#fff', opacity: (submitting || uploading) ? 0.7 : 1 }}
                >
                  {uploading ? 'Upload en cours…' : submitting ? 'Envoi en cours…' : 'Confirmer — ma correction est faite'}
                </button>
                {uploading && (
                  <p style={{ margin: '8px 0 0', textAlign: 'center', fontSize: 12, color: '#64748b' }}>
                    Veuillez attendre la fin de l'envoi des photos.
                  </p>
                )}
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
              {state.stand && <> (stand {state.stand})</>} a bien été enregistrée.
              {photos.filter(p => p.url).length > 0 && <> {photos.filter(p => p.url).length} photo{photos.filter(p => p.url).length > 1 ? 's' : ''} jointe{photos.filter(p => p.url).length > 1 ? 's' : ''}.</>}
              <br /><br />
              Un contrôleur passera vérifier votre installation prochainement.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = { fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: '#64748b', marginBottom: 2 }
const valueStyle: React.CSSProperties = { fontSize: 15, color: '#0f172a', fontWeight: 600 }
const menuBtnStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 12px', border: 'none', borderRadius: 10, background: '#f8fafc', color: '#0f172a', fontSize: 16, fontWeight: 500, cursor: 'pointer', marginBottom: 8 }
