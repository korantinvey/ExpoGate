import { useEffect, useRef, useState } from 'react'
import { sb, sbAdmin } from '../../lib/supabase'
import { db } from '../../lib/db'
import { Modal } from '../../components/ui/Modal'
import { Alert } from '../../components/ui/Alert'
import { compressImage } from '../../lib/compressImage'
import { useToast } from '../../components/ui/Toast'
import type { Prestation, Stand, Prestataire, ControleStatut } from '../../types'
import { STATUT_LABELS } from './helpers'

function standLabel(s: { numero: string; nom_exposant?: string | null }) {
  return `${s.numero}${s.nom_exposant ? ` — ${s.nom_exposant}` : ''}`
}

export function PrestationForm({ prest, evenementId, onSaved, onGoToStands, initialStand, readOnly = false, canDelete = false, controleurMode = false }: {
  prest: Prestation | null
  evenementId: string
  onSaved: () => void
  onGoToStands: () => void
  initialStand?: Stand
  readOnly?: boolean
  canDelete?: boolean
  controleurMode?: boolean
}) {
  const [stands, setStands] = useState<Stand[]>([])
  const [prestataires, setPrestataires] = useState<Prestataire[]>([])
  const [standsLoading, setStandsLoading] = useState(true)
  const userEditedStand = useRef(false)
  const [standId, setStandId] = useState(prest?.stand_id ?? initialStand?.id ?? '')
  const [libelle, setLibelle] = useState(prest?.libelle ?? '')
  const [categorie, setCategorie] = useState(prest?.categorie ?? '')
  const [qte, setQte] = useState(prest?.quantite_attendue ?? 1)
  const [emplacement, setEmplacement] = useState(prest?.emplacement_prevu ?? '')
  const [prestaId, setPrestaId] = useState(prest?.prestataire_id ?? '')
  const [ajoutSurSite, setAjoutSurSite] = useState(prest?.ajout_sur_site ?? false)
  const [error, setError] = useState('')
  const [cError, setCError] = useState('')
  const [standSearch, setStandSearch] = useState(() => {
    if (initialStand) return standLabel(initialStand)
    if (prest?.stands) return standLabel(prest.stands)
    return ''
  })
  const [cStatut, setCStatut] = useState<ControleStatut | ''>(prest?.statut_conformite ?? '')
  const [cQte, setCQte] = useState<string>(prest?.quantite_constatee != null ? String(prest.quantite_constatee) : '')
  const [cComment, setCComment] = useState(prest?.commentaire ?? '')
  const [commentairePrestataire, setCommentairePrestataire] = useState(prest?.commentaire_prestataire ?? '')
  const [photos, setPhotos] = useState<string[]>([])
  const [newPhotos, setNewPhotos] = useState<File[]>([])
  const [newPhotoUrls, setNewPhotoUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const { notify } = useToast()

  useEffect(() => {
    async function loadForm() {
      // Dexie fallback (toArray sans orderBy car raison_sociale n'est pas indexé)
      try {
        const [localStands, localPrestataires] = await Promise.all([
          db.stands.where('evenement_id').equals(evenementId).toArray(),
          db.prestataires.toArray(),
        ])
        if (localStands.length) {
          const s = localStands.sort((a, b) => a.numero.localeCompare(b.numero, 'fr', { numeric: true })) as unknown as Stand[]
          setStands(s)
          if (!prest?.stand_id && !initialStand && !userEditedStand.current) { setStandId(s[0].id); setStandSearch(standLabel(s[0])) }
          setStandsLoading(false)
        }
        if (localPrestataires.length) setPrestataires(localPrestataires.sort((a, b) => a.raison_sociale.localeCompare(b.raison_sociale, 'fr')) as unknown as Prestataire[])
      } catch { /* données locales indisponibles, on continue avec le réseau */ }

      // Network: stands
      try {
        const { data: standsData } = await sb.from('stands').select('*').eq('evenement_id', evenementId).eq('deleted', false).order('numero')
        if (standsData) {
          setStands(standsData)
          if (!prest?.stand_id && !initialStand && !userEditedStand.current && standsData.length) { setStandId(standsData[0].id); setStandSearch(standLabel(standsData[0])) }
        }
      } catch { /* réseau indisponible */ }
      setStandsLoading(false)

      // Network: prestataires via sbAdmin (bypass RLS)
      try {
        const { data: ep } = await sbAdmin.from('evenement_prestataires')
          .select('prestataire_id')
          .eq('evenement_id', evenementId)
        const ids = (ep ?? []).map((r: { prestataire_id: string }) => r.prestataire_id).filter(Boolean)
        if (ids.length) {
          const { data: p } = await sbAdmin.from('prestataires')
            .select('id, raison_sociale, email_contact, telephone')
            .in('id', ids)
            .order('raison_sociale')
          if (p?.length) {
            setPrestataires(p as unknown as Prestataire[])
            db.prestataires.bulkPut(p.map(({ id, raison_sociale, email_contact, telephone }: { id: string; raison_sociale: string; email_contact: string | null; telephone: string | null }) => ({ id, raison_sociale, email_contact, telephone }))).catch(() => {})
          }
        }
      } catch { /* réseau indisponible */ }
    }
    loadForm()
    if (prest?.id) {
      sbAdmin.from('photos').select('url').eq('prestation_id', prest.id).not('url', 'is', null)
        .then(({ data }) => setPhotos((data ?? []).map((p: { url: string }) => p.url!)))
    }
  }, [])

  useEffect(() => {
    const urls = newPhotos.map(f => URL.createObjectURL(f))
    setNewPhotoUrls(urls)
    return () => { urls.forEach(u => URL.revokeObjectURL(u)) }
  }, [newPhotos])

  if (!standsLoading && stands.length === 0 && !standId) {
    return (
      <Modal title="Aucun stand disponible" confirmLabel="Aller aux stands" onClose={onSaved} onConfirm={async () => { onGoToStands(); return true }}>
        <p>Vous devez d'abord ajouter des stands à cet événement.</p>
      </Modal>
    )
  }

  async function uploadPendingPhotos(prestationId: string) {
    for (const file of newPhotos) {
      let compressed: File
      try { compressed = await compressImage(file) } catch { compressed = file }
      const path = `${prestationId}/${crypto.randomUUID()}.jpg`
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE as string
      const uploadRes = await fetch(`${supabaseUrl}/storage/v1/object/Photos/${path}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'image/jpeg', 'x-upsert': 'false' },
        body: compressed,
      })
      if (!uploadRes.ok) { const errTxt = await uploadRes.text(); setCError(`Upload échoué : ${uploadRes.status} — ${errTxt}`); return }
      const { data: { publicUrl } } = sbAdmin.storage.from('Photos').getPublicUrl(path)
      const { error: insErr } = await sbAdmin.from('photos').insert({ prestation_id: prestationId, url: publicUrl, synced: true })
      if (insErr) { setCError(`Enregistrement photo échoué : ${insErr.message}`); continue }
    }
  }

  async function deletePhoto(url: string) {
    if (!confirm('Supprimer cette photo ?')) return
    await sbAdmin.from('photos').delete().eq('url', url).eq('prestation_id', prest!.id)
    setPhotos(prev => prev.filter(u => u !== url))
  }

  function anomaliePatch(
    prevStatut: ControleStatut | null | undefined,
    newStatut: ControleStatut | string | null | undefined,
    currentAnomalie: boolean | undefined,
    currentDateAnomalie: string | null | undefined,
    currentDateRetour: string | null | undefined,
    now: string,
  ): Record<string, unknown> {
    const patch: Record<string, unknown> = {}
    const isAnomalie = (s: string | null | undefined) => s === 'non_conforme' || s === 'absent'
    if (isAnomalie(newStatut)) {
      if (!currentAnomalie) patch.anomalie = true
      if (!currentDateAnomalie) patch.date_anomalie = now
    }
    if (newStatut === 'a_verifier' && isAnomalie(prevStatut) && !currentDateRetour) {
      patch.date_retour_a_verifier = now
    }
    return patch
  }

  async function save(): Promise<boolean> {
    setUploading(true)
    try {
      const isOffline = !navigator.onLine

      if (controleurMode) {
        if (!prest?.id) return false
        const now = new Date().toISOString()
        const { data: { user } } = await sb.auth.getUser()
        const payload: Record<string, unknown> = {
          statut_conformite: cStatut || null,
          quantite_constatee: cQte !== '' ? parseInt(cQte) : null,
          commentaire: cComment || null,
          controleur_id: user?.id ?? null,
          date_controle: cStatut ? now : (prest.date_controle ?? null),
          ...anomaliePatch(prest.statut_conformite, cStatut, prest.anomalie, prest.date_anomalie, prest.date_retour_a_verifier, now),
        }
        const { error } = await sbAdmin.from('prestations').update(payload).eq('id', prest.id)
        if (error) { setError(error.message); return false }
        if (newPhotos.length) await uploadPendingPhotos(prest.id)
        const shouldNotify = (cStatut === 'non_conforme' || cStatut === 'absent') && cStatut !== prest?.statut_conformite
        if (shouldNotify) {
          const { data: { session } } = await sb.auth.getSession()
          fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-non-conformite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}`, 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY },
            body: JSON.stringify({ prestation_id: prest.id }),
          }).catch(() => {})
        }
        notify('Enregistré', 'success')
        onSaved(); return true
      }

      if (readOnly) {
        if (!prest?.id) return false
        if (isOffline) {
          const now = new Date().toISOString()
          const aPatch = cStatut ? anomaliePatch(prest.statut_conformite, cStatut, prest.anomalie, prest.date_anomalie, prest.date_retour_a_verifier, now) : {}
          await db.prestations.update(prest.id, {
            commentaire_prestataire: commentairePrestataire || null,
            ...(cStatut ? { statut_conformite: cStatut as ControleStatut, quantite_constatee: cQte !== '' ? parseInt(cQte) : null, date_controle: now } : {}),
            ...aPatch,
            pending_sync: 1,
          })
          onSaved(); return true
        }
        const { data: { user } } = await sb.auth.getUser()
        const now = new Date().toISOString()
        const payload: Record<string, unknown> = { commentaire_prestataire: commentairePrestataire || null }
        if (cStatut) {
          payload.statut_conformite = cStatut
          payload.quantite_constatee = cQte !== '' ? parseInt(cQte) : null
          payload.controleur_id = user?.id ?? null
          payload.date_controle = now
          Object.assign(payload, anomaliePatch(prest.statut_conformite, cStatut, prest.anomalie, prest.date_anomalie, prest.date_retour_a_verifier, now))
        }
        // sbAdmin pour contourner le RLS qui bloque silencieusement l'update prestataire
        const { error } = await sbAdmin.from('prestations').update(payload).eq('id', prest.id)
        if (error) { setError(error.message); notify(error.message); return false }
        const shouldNotify = (cStatut === 'non_conforme' || cStatut === 'absent') && cStatut !== prest?.statut_conformite
        if (shouldNotify) {
          const { data: { session } } = await sb.auth.getSession()
          fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-non-conformite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}`, 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY },
            body: JSON.stringify({ prestation_id: prest.id }),
          }).catch(() => {})
        }
        notify('Enregistré', 'success')
        onSaved(); return true
      }

      if (!libelle || !standId) { setError('Le stand et le libellé sont obligatoires.'); return false }

      if (isOffline) {
        const now = new Date().toISOString()
        if (prest?.id) {
          const aPatch = cStatut ? anomaliePatch(prest.statut_conformite, cStatut, prest.anomalie, prest.date_anomalie, prest.date_retour_a_verifier, now) : {}
          await db.prestations.update(prest.id, {
            stand_id: standId, libelle, categorie: categorie || null,
            quantite_attendue: qte, emplacement_prevu: emplacement || null,
            prestataire_id: prestaId || null, ajout_sur_site: ajoutSurSite,
            commentaire_prestataire: commentairePrestataire || null,
            ...(cStatut ? { statut_conformite: cStatut as ControleStatut, quantite_constatee: cQte !== '' ? parseInt(cQte) : null, commentaire: cComment || null, date_controle: now } : {}),
            ...aPatch,
            pending_sync: 1,
          })
          for (const file of newPhotos) {
            await db.photos.add({ prestation_id: prest.id, blob: file, created_at: now, synced: 0, remote_url: null })
          }
          if ((cStatut === 'non_conforme' || cStatut === 'absent') && cStatut !== prest.statut_conformite) {
            await db.pending_notifications.put({ prestation_id: prest.id })
          }
        } else {
          const newId = crypto.randomUUID()
          const isFirstAnomalie = cStatut === 'non_conforme' || cStatut === 'absent'
          await db.prestations.add({
            id: newId, stand_id: standId, prestataire_id: prestaId || null,
            libelle, categorie: categorie || null, quantite_attendue: qte,
            emplacement_prevu: emplacement || null, ajout_sur_site: ajoutSurSite,
            commentaire_prestataire: commentairePrestataire || null,
            statut_conformite: cStatut ? cStatut as ControleStatut : null,
            quantite_constatee: cQte !== '' ? parseInt(cQte) : null,
            commentaire: cComment || null, controleur_id: null,
            date_controle: cStatut ? now : null,
            anomalie: isFirstAnomalie,
            date_anomalie: isFirstAnomalie ? now : null,
            date_retour_a_verifier: null,
            pending_sync: 1,
          })
          for (const file of newPhotos) {
            await db.photos.add({ prestation_id: newId, blob: file, created_at: now, synced: 0, remote_url: null })
          }
          if (isFirstAnomalie) {
            await db.pending_notifications.put({ prestation_id: newId })
          }
        }
        onSaved(); return true
      }

      const { data: { user } } = await sb.auth.getUser()
      const now = new Date().toISOString()
      const isFirstAnomalie = (cStatut === 'non_conforme' || cStatut === 'absent')
      const conformitePayload = cStatut ? {
        statut_conformite: cStatut,
        quantite_constatee: cQte !== '' ? parseInt(cQte) : null,
        commentaire: cComment || null,
        controleur_id: user?.id ?? null,
        date_controle: now,
        ...anomaliePatch(prest?.statut_conformite, cStatut, prest?.anomalie, prest?.date_anomalie, prest?.date_retour_a_verifier, now),
      } : {}
      const newPrestAnomalie = !prest && isFirstAnomalie ? { anomalie: true, date_anomalie: now } : {}
      const payload: Record<string, unknown> = {
        stand_id: standId, libelle, categorie: categorie || null,
        quantite_attendue: qte, emplacement_prevu: emplacement || null,
        prestataire_id: prestaId || null, ajout_sur_site: ajoutSurSite,
        commentaire_prestataire: commentairePrestataire || null,
        ...conformitePayload,
        ...newPrestAnomalie,
      }
      let savedId = prest?.id
      if (prest) {
        const { error } = await sb.from('prestations').update(payload).eq('id', prest.id)
        if (error) { setError(error.message); notify(error.message); return false }
      } else {
        const { data, error } = await sb.from('prestations').insert(payload).select().single()
        if (error) { setError(error.message); notify(error.message); return false }
        savedId = data.id
      }
      if (newPhotos.length && savedId) await uploadPendingPhotos(savedId)
      const shouldNotify = (cStatut === 'non_conforme' || cStatut === 'absent') && cStatut !== prest?.statut_conformite
      if (shouldNotify && savedId) {
        const { data: { session } } = await sb.auth.getSession()
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-non-conformite`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}`, 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY },
          body: JSON.stringify({ prestation_id: savedId }),
        }).catch(() => {})
      }
      onSaved(); return true
    } finally { setUploading(false) }
  }

  const roStyle: React.CSSProperties = { background: 'var(--bg)', color: 'var(--text-muted)', cursor: 'not-allowed' }

  return (
    <Modal title={controleurMode ? `Contrôle — ${prest?.libelle ?? ''}` : prest ? 'Modifier la prestation' : 'Nouvelle prestation'} confirmLabel={uploading ? 'Enregistrement…' : prest ? 'Enregistrer' : 'Créer'} onClose={onSaved} onConfirm={save}
      footer={canDelete && prest ? <button className="btn btn-danger btn-sm" style={{ marginRight: 'auto' }} onClick={async () => { if (!confirm(`Supprimer "${prest.libelle}" ? Elle sera placée dans la corbeille.`)) return; await sb.from('prestations').update({ deleted: true }).eq('id', prest.id); onSaved() }}>Supprimer</button> : undefined}
    >
      <Alert message={error} />
      {controleurMode && prest && (
        <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13, border: '1px solid var(--border)' }}>
          <div><strong>{prest.stands?.numero}</strong>{prest.stands?.nom_exposant ? ` — ${prest.stands.nom_exposant}` : ''}</div>
          <div className="text-muted" style={{ marginTop: 4 }}>
            {[prest.categorie, `Qté attendue : ${prest.quantite_attendue}`, prest.emplacement_prevu].filter(Boolean).join(' · ')}
          </div>
        </div>
      )}
      {!controleurMode && (<>
      <div className="form-group" style={{ position: 'relative' }}>
        <label>Stand</label>
        <input
          value={standSearch}
          onChange={e => { if (!readOnly) { userEditedStand.current = true; setStandSearch(e.target.value); setStandId('') } }}
          placeholder="Rechercher par numéro ou nom d'exposant…"
          autoComplete="off"
          readOnly={readOnly}
          style={readOnly ? roStyle : undefined}
        />
        {standSearch && !standId && !readOnly && (() => {
          const q = standSearch.toLowerCase()
          const filtered = stands.filter(s => s.numero.toLowerCase().includes(q) || (s.nom_exposant ?? '').toLowerCase().includes(q))
          return filtered.length > 0 ? (
            <div style={{ position: 'absolute', zIndex: 100, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', width: '100%', maxHeight: 200, overflowY: 'auto', top: '100%', left: 0 }}>
              {filtered.map(s => (
                <div key={s.id}
                  style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13 }}
                  onMouseDown={() => { setStandId(s.id); setStandSearch(standLabel(s)) }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <strong>{s.numero}</strong>{s.nom_exposant ? ` — ${s.nom_exposant}` : ''}
                  {s.hall ? <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: 11 }}>Hall {s.hall}</span> : null}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ position: 'absolute', zIndex: 100, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 13, color: 'var(--text-muted)', width: '100%', top: '100%', left: 0 }}>
              Aucun stand trouvé
            </div>
          )
        })()}
        {standId && <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 4 }}>✓ Stand sélectionné</div>}
      </div>
      <div className="grid-2">
        <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Libellé</label><input value={libelle} onChange={e => { if (!readOnly) setLibelle(e.target.value) }} readOnly={readOnly} style={readOnly ? roStyle : undefined} /></div>
        <div className="form-group"><label>Catégorie</label><input value={categorie} onChange={e => { if (!readOnly) setCategorie(e.target.value) }} readOnly={readOnly} style={readOnly ? roStyle : undefined} /></div>
        <div className="form-group"><label>Quantité attendue</label><input type="number" min={1} value={qte} onChange={e => { if (!readOnly) setQte(parseInt(e.target.value) || 1) }} readOnly={readOnly} style={readOnly ? roStyle : undefined} /></div>
        <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Emplacement prévu</label><input value={emplacement} onChange={e => { if (!readOnly) setEmplacement(e.target.value) }} readOnly={readOnly} style={readOnly ? roStyle : undefined} /></div>
        {!readOnly && (
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label>Prestataire affecté</label>
            <select value={prestaId} onChange={e => setPrestaId(e.target.value)}>
              <option value="">— Non affecté —</option>
              {prestataires.map(p => <option key={p.id} value={p.id}>{p.raison_sociale}</option>)}
            </select>
          </div>
        )}
        <div className="form-group" style={{ gridColumn: '1/-1' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: readOnly ? 'not-allowed' : 'pointer' }}>
            <input type="checkbox" checked={ajoutSurSite} onChange={e => { if (!readOnly) setAjoutSurSite(e.target.checked) }} disabled={readOnly} style={{ width: 'auto', margin: 0 }} />
            Ajout sur site à facturer
          </label>
        </div>
      </div>
      </>)}

      <div style={{ marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Conformité</div>
        <Alert message={cError} />
        <div className="grid-2">
          <div className="form-group">
            <label>Statut</label>
            <select value={cStatut} onChange={e => setCStatut(e.target.value as ControleStatut | '')}>
              {readOnly && !controleurMode ? (
                <>
                  {cStatut === '' && <option value="">— Non contrôlée —</option>}
                  {cStatut !== '' && cStatut !== 'a_verifier' && <option value={cStatut}>{STATUT_LABELS[cStatut]}</option>}
                  <option value="a_verifier">{STATUT_LABELS.a_verifier}</option>
                </>
              ) : (
                <>
                  <option value="">— Non contrôlée —</option>
                  {(Object.keys(STATUT_LABELS) as ControleStatut[]).map(s => <option key={s} value={s}>{STATUT_LABELS[s]}</option>)}
                </>
              )}
            </select>
          </div>
          <div className="form-group">
            <label>Quantité constatée</label>
            <input type="number" min={0} value={cQte} onChange={e => { if (!readOnly || controleurMode) setCQte(e.target.value) }} placeholder={`Attendue : ${qte}`} readOnly={readOnly && !controleurMode} style={readOnly && !controleurMode ? roStyle : undefined} />
          </div>
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label>Commentaire / observations</label>
            <input value={cComment} onChange={e => setCComment(e.target.value)} placeholder="Ex: 3 unités présentes, 1 manquante…" readOnly={readOnly && !controleurMode} style={readOnly && !controleurMode ? roStyle : undefined} />
          </div>
        </div>
        {!controleurMode && (
        <div className="form-group" style={{ marginTop: 16 }}>
          <label>Commentaire prestataire</label>
          <textarea
            value={commentairePrestataire}
            onChange={e => setCommentairePrestataire(e.target.value)}
            placeholder="Observations, réserves ou confirmation de votre part…"
            rows={3}
            style={{ width: '100%', resize: 'vertical' }}
          />
        </div>
        )}
        <div className="form-group">
          <label>Photos {prest ? '(ajouter)' : '(disponible après création)'}</label>
          {prest && (
            <>
              {('ontouchstart' in window || navigator.maxTouchPoints > 0) ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <label style={{ cursor: 'pointer' }}>
                    <span className="btn btn-secondary btn-sm">📷 Appareil photo</span>
                    <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => { const f = Array.from(e.target.files ?? []); if (f.length) setNewPhotos(prev => [...prev, ...f]) }} />
                  </label>
                  <label style={{ cursor: 'pointer' }}>
                    <span className="btn btn-secondary btn-sm">🖼 Galerie</span>
                    <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => { const f = Array.from(e.target.files ?? []); if (f.length) setNewPhotos(prev => [...prev, ...f]) }} />
                  </label>
                </div>
              ) : (
                <input type="file" accept="image/*" multiple onChange={e => setNewPhotos(prev => [...prev, ...Array.from(e.target.files ?? [])])} />
              )}
              {newPhotoUrls.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  {newPhotoUrls.map((url, i) => <img key={i} src={url} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 6, border: '2px dashed var(--accent)' }} />)}
                </div>
              )}
              {photos.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  {photos.map((url, i) => (
                    <div key={i} style={{ position: 'relative' }}>
                      <img src={url} alt="" onClick={() => setLightbox(url)} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer' }} />
                      {!readOnly && <button onClick={() => deletePhoto(url)} style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: 18, height: 18, fontSize: 10, cursor: 'pointer', lineHeight: 1, padding: 0 }}>✕</button>}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        {prest?.date_controle && (
          <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
            Dernier contrôle : {new Date(prest.date_controle).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            {prest.users ? ` — ${prest.users.prenom} ${prest.users.nom}` : ''}
          </div>
        )}
      </div>

      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
          <img src={lightbox} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()} />
        </div>
      )}
    </Modal>
  )
}
