import { useEffect, useState, useCallback } from 'react'
import { sb, sbAdmin } from '../lib/supabase'
import { db } from '../lib/db'
import type { LocalStand } from '../lib/db'
import { syncPending } from '../lib/sync'
import { useAuth } from '../hooks/useAuth'
import { Modal } from '../components/ui/Modal'
import { Alert } from '../components/ui/Alert'
import { DataTable } from '../components/ui/DataTable'
import { ExportButton } from '../components/ui/ExportButton'
import { compressImage } from '../lib/compressImage'
import { useToast } from '../components/ui/Toast'
import type { Evenement, MainCourante, McEtat } from '../types'

const ETAT_LABELS: Record<McEtat, string> = {
  a_traiter: 'À traiter',
  pris_en_charge: 'Pris en charge',
  resolu: 'Résolu',
}

const ETAT_STYLE: Record<McEtat, { background: string; color: string }> = {
  a_traiter: { background: 'rgba(239,68,68,0.12)', color: '#dc2626' },
  pris_en_charge: { background: 'rgba(59,130,246,0.12)', color: '#2563eb' },
  resolu: { background: 'rgba(34,197,94,0.12)', color: '#16a34a' },
}

function EtatBadge({ etat }: { etat: McEtat }) {
  const s = ETAT_STYLE[etat] ?? ETAT_STYLE.a_traiter
  return (
    <span style={{ ...s, borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}>
      {ETAT_LABELS[etat] ?? etat}
    </span>
  )
}

function fmtDateHeure(s: string) {
  return new Date(s).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Formulaire ─────────────────────────────────────────────────────────────────

function McForm({ mc, evenementId, onSaved, canDelete = false }: { mc: MainCourante | null; evenementId: string; onSaved: () => void; canDelete?: boolean }) {
  const { user } = useAuth()
  const [stands, setStands] = useState<LocalStand[]>([])
  const [standId, setStandId] = useState(mc?.stand_id ?? '')
  const [standSearch, setStandSearch] = useState('')
  const [titre, setTitre] = useState(mc?.titre ?? '')
  const [etat, setEtat] = useState<McEtat>(mc?.etat ?? 'a_traiter')
  const [descriptif, setDescriptif] = useState(mc?.descriptif ?? '')
  const [newPhotos, setNewPhotos] = useState<File[]>([])
  const [newPhotoUrls, setNewPhotoUrls] = useState<string[]>([])
  const [existingPhotos, setExistingPhotos] = useState<{ id: string; url: string }[]>(mc?.photos ?? [])
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)

  useEffect(() => {
    db.stands.where('evenement_id').equals(evenementId).sortBy('numero')
      .then(data => {
        setStands(data)
        if (mc?.stand_id) {
          const found = data.find(s => s.id === mc.stand_id)
          if (found) setStandSearch(`${found.numero}${found.nom_exposant ? ` — ${found.nom_exposant}` : ''}`)
        }
      })
  }, [evenementId])

  useEffect(() => {
    const urls = newPhotos.map(f => URL.createObjectURL(f))
    setNewPhotoUrls(urls)
    return () => urls.forEach(u => URL.revokeObjectURL(u))
  }, [newPhotos])

  async function deleteExistingPhoto(id: string) {
    if (!confirm('Supprimer cette photo ?')) return
    await sbAdmin.from('main_courante_photos').delete().eq('id', id)
    setExistingPhotos(prev => prev.filter(p => p.id !== id))
  }

  async function save(): Promise<boolean> {
    setUploading(true)
    try {
      if (!titre.trim()) { setError('Le titre est obligatoire.'); return false }

      const isOffline = !navigator.onLine
      const now = new Date().toISOString()

      if (isOffline) {
        const savedId = mc?.id ?? crypto.randomUUID()
        if (mc) {
          await db.main_courante.update(mc.id, {
            stand_id: standId || null,
            titre: titre.trim(),
            etat,
            descriptif: descriptif.trim() || null,
            pending_sync: 1,
          })
        } else {
          await db.main_courante.put({
            id: savedId,
            evenement_id: evenementId,
            stand_id: standId || null,
            titre: titre.trim(),
            etat,
            descriptif: descriptif.trim() || null,
            created_at: now,
            created_by: user?.id ?? null,
            pending_sync: 1,
          })
        }
        for (const file of newPhotos) {
          await db.mc_photos.add({
            main_courante_id: savedId,
            blob: file,
            created_at: now,
            synced: 0,
            remote_url: null,
          })
        }
        onSaved()
        return true
      }

      // Chemin online
      let savedId = mc?.id
      if (mc) {
        const { error } = await sb.from('main_courante').update({
          stand_id: standId || null,
          titre: titre.trim(),
          etat,
          descriptif: descriptif.trim() || null,
        }).eq('id', mc.id)
        if (error) { setError(error.message); return false }
      } else {
        const { data, error } = await sb.from('main_courante').insert({
          evenement_id: evenementId,
          stand_id: standId || null,
          titre: titre.trim(),
          etat,
          descriptif: descriptif.trim() || null,
          created_by: user?.id ?? null,
        }).select().single()
        if (error) { setError(error.message); return false }
        savedId = data.id
      }

      if (newPhotos.length && savedId) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
        const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE as string
        for (const file of newPhotos) {
          let compressed: File
          try { compressed = await compressImage(file) } catch { compressed = file }
          const path = `main-courante/${savedId}/${crypto.randomUUID()}.jpg`
          const res = await fetch(`${supabaseUrl}/storage/v1/object/Photos/${path}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'image/jpeg', 'x-upsert': 'false' },
            body: compressed,
          })
          if (res.ok) {
            const publicUrl = `${supabaseUrl}/storage/v1/object/public/Photos/${path}`
            await sbAdmin.from('main_courante_photos').insert({ main_courante_id: savedId, url: publicUrl })
          }
        }
      }

      onSaved()
      return true
    } finally { setUploading(false) }
  }

  async function deleteEntry() {
    if (!confirm(`Supprimer "${mc!.titre}" ?`)) return
    if (!navigator.onLine) { setError('Suppression non disponible hors ligne.'); return }
    const { error } = await sb.from('main_courante').delete().eq('id', mc!.id)
    if (error) { setError(error.message); return }
    await db.main_courante.delete(mc!.id)
    onSaved()
  }

  return (
    <Modal
      title={mc ? 'Modifier l\'entrée' : 'Nouvelle entrée'}
      confirmLabel={uploading ? 'Enregistrement…' : mc ? 'Enregistrer' : 'Créer'}
      confirmDisabled={uploading}
      onClose={onSaved}
      onConfirm={save}
      footer={canDelete && mc ? <button className="btn btn-danger btn-sm" style={{ marginRight: 'auto' }} onClick={deleteEntry}>Supprimer</button> : undefined}
    >
      <Alert message={error} />

      {/* Stand — étape 1 */}
      <div className="form-group" style={{ position: 'relative' }}>
        <label>Stand <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 12 }}>(optionnel)</span></label>
        <input
          value={standSearch}
          onChange={e => { setStandSearch(e.target.value); setStandId('') }}
          placeholder="Rechercher par numéro ou nom d'exposant…"
          autoComplete="off"
        />
        {standSearch && !standId && (() => {
          const q = standSearch.toLowerCase()
          const filtered = stands.filter(s =>
            s.numero.toLowerCase().includes(q) ||
            (s.nom_exposant ?? '').toLowerCase().includes(q)
          )
          return filtered.length > 0 ? (
            <div style={{ position: 'absolute', zIndex: 100, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', width: '100%', maxHeight: 200, overflowY: 'auto', top: '100%', left: 0 }}>
              {filtered.map(s => (
                <div key={s.id}
                  style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13 }}
                  onMouseDown={() => { setStandId(s.id); setStandSearch(`${s.numero}${s.nom_exposant ? ` — ${s.nom_exposant}` : ''}`) }}
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
        {standId && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--success)' }}>✓ Stand sélectionné</span>
            <button type="button" style={{ fontSize: 11, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }} onClick={() => { setStandId(''); setStandSearch('') }}>
              ✕ Dissocier
            </button>
          </div>
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0 16px' }} />

      {/* Titre */}
      <div className="form-group">
        <label>Titre <span style={{ color: 'var(--danger)' }}>*</span></label>
        <input value={titre} onChange={e => setTitre(e.target.value)} placeholder="Ex : Mobilier manquant hall B" />
      </div>

      {/* État */}
      <div className="form-group">
        <label>État</label>
        <select value={etat} onChange={e => setEtat(e.target.value as McEtat)}>
          {(Object.keys(ETAT_LABELS) as McEtat[]).map(v => (
            <option key={v} value={v}>{ETAT_LABELS[v]}</option>
          ))}
        </select>
      </div>

      {/* Descriptif */}
      <div className="form-group">
        <label>Descriptif</label>
        <textarea
          value={descriptif}
          onChange={e => setDescriptif(e.target.value)}
          placeholder="Décrivez l'incident ou l'observation…"
          rows={3}
          style={{ resize: 'vertical' }}
        />
      </div>

      {/* Photos */}
      <div className="form-group">
        <label>Photos</label>
        {(existingPhotos.length > 0 || newPhotoUrls.length > 0) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            {existingPhotos.map(p => (
              <div key={p.id} style={{ position: 'relative' }}>
                <img src={p.url} alt="" onClick={() => setLightbox(p.url)}
                  style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer' }} />
                <button onClick={() => deleteExistingPhoto(p.id)}
                  style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: 18, height: 18, fontSize: 10, cursor: 'pointer', lineHeight: 1, padding: 0 }}>✕</button>
              </div>
            ))}
            {newPhotoUrls.map((url, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <img src={url} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 6, border: '2px dashed var(--accent)' }} />
                <button onClick={() => setNewPhotos(prev => prev.filter((_, j) => j !== i))}
                  style={{ position: 'absolute', top: -4, right: -4, background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: '50%', width: 18, height: 18, fontSize: 10, cursor: 'pointer', lineHeight: 1, padding: 0 }}>✕</button>
              </div>
            ))}
          </div>
        )}
        {('ontouchstart' in window || navigator.maxTouchPoints > 0) ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ cursor: 'pointer' }}>
              <span className="btn btn-secondary btn-sm">📷 Appareil photo</span>
              <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                onChange={e => { const f = Array.from(e.target.files ?? []); if (f.length) setNewPhotos(prev => [...prev, ...f]) }} />
            </label>
            <label style={{ cursor: 'pointer' }}>
              <span className="btn btn-secondary btn-sm">🖼 Galerie</span>
              <input type="file" accept="image/*" multiple style={{ display: 'none' }}
                onChange={e => { const f = Array.from(e.target.files ?? []); if (f.length) setNewPhotos(prev => [...prev, ...f]) }} />
            </label>
          </div>
        ) : (
          <input type="file" accept="image/*" multiple
            onChange={e => setNewPhotos(prev => [...prev, ...Array.from(e.target.files ?? [])])} />
        )}
      </div>

      {lightbox && (
        <div onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
          <img src={lightbox} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8 }} onClick={e => e.stopPropagation()} />
        </div>
      )}
    </Modal>
  )
}

// ── Onglet ─────────────────────────────────────────────────────────────────────

export function TabMainCourante({ ev, canDelete = false }: { ev: Evenement; canDelete?: boolean }) {
  const [entries, setEntries] = useState<MainCourante[]>([])
  const [modal, setModal] = useState<MainCourante | null | 'new'>(null)
  const [exportFn, setExportFn] = useState<(() => void) | null>(null)
  const { notify } = useToast()

  const load = useCallback(async function load() {
    // Affichage immédiat depuis IndexedDB
    const [localMcs, localStands] = await Promise.all([
      db.main_courante.where('evenement_id').equals(ev.id).toArray(),
      db.stands.where('evenement_id').equals(ev.id).toArray(),
    ])
    const standMap = new Map(localStands.map(s => [s.id, s]))

    const localToDisplay = (mcs: typeof localMcs) =>
      mcs
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map(mc => ({
          ...mc,
          stands: mc.stand_id ? (standMap.get(mc.stand_id) ?? null) : null,
          users: null,
          photos: [],
        })) as MainCourante[]

    if (localMcs.length) setEntries(localToDisplay(localMcs))

    if (!navigator.onLine) return

    // Rafraîchissement depuis le serveur
    const { data, error } = await sb.from('main_courante')
      .select('*, stands(numero, nom_exposant), users(nom, prenom), main_courante_photos(id, url)')
      .eq('evenement_id', ev.id)
      .order('created_at', { ascending: false })
    if (error) { notify(error.message, 'error'); return }
    const serverEntries = (data ?? []).map(e => ({
      ...e,
      photos: (e.main_courante_photos as { id: string; url: string }[]) ?? [],
      pending_sync: 0 as const,
    })) as MainCourante[]

    // Récupérer les IDs encore en attente de sync
    const pendingIds = new Set(
      await db.main_courante.where('pending_sync').equals(1).primaryKeys()
    )

    // Fusionner : garder les entrées pending locales + les entrées serveur
    const pendingEntries = localToDisplay(localMcs.filter(mc => pendingIds.has(mc.id)))
    const merged = [
      ...pendingEntries,
      ...serverEntries.filter(mc => !pendingIds.has(mc.id)),
    ].sort((a, b) => b.created_at.localeCompare(a.created_at))
    setEntries(merged)

    // Mise à jour du cache IndexedDB (sans écraser les pending)
    const toCache = serverEntries
      .filter(mc => !pendingIds.has(mc.id))
      .map(mc => ({
        id: mc.id,
        evenement_id: mc.evenement_id,
        stand_id: mc.stand_id,
        titre: mc.titre,
        etat: mc.etat,
        descriptif: mc.descriptif,
        created_at: mc.created_at,
        created_by: mc.created_by,
        pending_sync: 0 as const,
      }))
    if (toCache.length) await db.main_courante.bulkPut(toCache)
  }, [ev.id])

  useEffect(() => {
    const init = async () => {
      if (navigator.onLine) await syncPending()
      await load()
    }
    init()
  }, [load])

  useEffect(() => {
    const onOnline = async () => { await syncPending(); await load() }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [load])

  useEffect(() => {
    const channel = sb.channel(`mc_${ev.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'main_courante', filter: `evenement_id=eq.${ev.id}` },
        () => { load() }
      )
      .subscribe()
    return () => { sb.removeChannel(channel) }
  }, [load, ev.id])

  const standLabel = (mc: MainCourante) =>
    mc.stands ? `${mc.stands.numero}${mc.stands.nom_exposant ? ` — ${mc.stands.nom_exposant}` : ''}` : ''

  return (
    <>
      <div className="card">
        <div className="card-header">
          <div className="card-title">Main courante <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({entries.length})</span></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <ExportButton onClick={exportFn} />
            <button className="btn btn-primary btn-sm" onClick={() => setModal('new')}>+ Nouvelle entrée</button>
          </div>
        </div>
        <div className="card-body">
          <DataTable
            data={entries}
            exportFilename={`main-courante-${ev.nom}`}
            onExportReady={fn => setExportFn(() => fn)}
            onRowClick={mc => setModal(mc)}
            emptyState={<div className="empty-state">Aucune entrée dans la main courante.</div>}
            columns={[
              {
                key: 'stand', label: 'Stand', sortable: true, filterable: true,
                getValue: standLabel,
                render: mc => mc.stands
                  ? <span style={{ fontWeight: 600 }}>{standLabel(mc)}</span>
                  : <span className="text-muted">—</span>,
              },
              {
                key: 'titre', label: 'Titre', sortable: true, filterable: true,
                render: mc => (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      title={mc.pending_sync === 1 ? 'En attente de synchronisation' : 'Synchronisé'}
                      style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: mc.pending_sync === 1 ? '#f97316' : '#22c55e' }}
                    />
                    <span style={{ fontWeight: 600 }}>{mc.titre}</span>
                  </span>
                ),
              },
              {
                key: 'etat', label: 'État', sortable: true, filterable: true,
                getValue: mc => ETAT_LABELS[mc.etat] ?? mc.etat,
                render: mc => <EtatBadge etat={mc.etat} />,
              },
              {
                key: 'descriptif', label: 'Descriptif', filterable: true, hideOnMobile: true,
                render: mc => mc.descriptif
                  ? <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{mc.descriptif.length > 80 ? mc.descriptif.slice(0, 80) + '…' : mc.descriptif}</span>
                  : <span className="text-muted">—</span>,
              },
              {
                key: 'photos', label: 'Photos', hideOnMobile: true,
                getValue: mc => String(mc.photos?.length ?? 0),
                render: mc => mc.photos?.length
                  ? <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>📷 {mc.photos.length}</span>
                  : null,
              },
              {
                key: 'created_at', label: 'Date', sortable: true, hideOnMobile: true,
                getValue: mc => mc.created_at,
                render: mc => <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtDateHeure(mc.created_at)}</span>,
              },
              {
                key: 'by', label: 'Par', sortable: true, hideOnMobile: true,
                getValue: mc => mc.users ? `${mc.users.prenom} ${mc.users.nom}` : '',
                render: mc => mc.users
                  ? <span style={{ fontSize: 12 }}>{mc.users.prenom} {mc.users.nom}</span>
                  : <span className="text-muted">—</span>,
              },
            ]}
          />
        </div>
      </div>

      {modal !== null && (
        <McForm mc={modal === 'new' ? null : modal} evenementId={ev.id} onSaved={() => { setModal(null); load() }} canDelete={canDelete} />
      )}
    </>
  )
}
