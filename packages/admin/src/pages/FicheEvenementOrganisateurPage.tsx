import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { sb, sbAdmin } from '../lib/supabase'
import { db } from '../lib/db'
import { useAuth } from '../hooks/useAuth'
import { fmtDate } from '../lib/format'
import { downloadTemplate } from '../lib/excel'
import { compressImage } from '../lib/compressImage'
import { normalizeNom, normalizePrenom, normalizeEmail, isValidEmail } from '../lib/normalize'
import { Modal } from '../components/ui/Modal'
import { Alert } from '../components/ui/Alert'
import { Badge } from '../components/ui/Badge'
import { DataTable } from '../components/ui/DataTable'
import { ExportButton } from '../components/ui/ExportButton'
import { ImportZone } from '../components/ui/ImportZone'
import { DateInput } from '../components/ui/DateInput'
import { useToast } from '../components/ui/Toast'
import type {
  Evenement, EvenementStatut, Stand, Prestation, ControleStatut,
  Prestataire, User, UserEvenement, RoleLocal,
} from '../types'

// ── Edit event modal ──────────────────────────────────────────────────────────
function EvenementForm({ ev, onSaved }: { ev: Evenement; onSaved: () => void }) {
  const [nom, setNom] = useState(ev.nom)
  const [lieu, setLieu] = useState(ev.lieu ?? '')
  const [debut, setDebut] = useState(ev.date_debut)
  const [fin, setFin] = useState(ev.date_fin)
  const [statut, setStatut] = useState<EvenementStatut>(ev.statut)
  const [error, setError] = useState('')

  async function save(): Promise<boolean> {
    if (!nom || !debut || !fin) { setError('Nom et dates sont obligatoires.'); return false }
    const { error } = await sb.from('evenements').update({ nom, lieu: lieu || null, date_debut: debut, date_fin: fin, statut }).eq('id', ev.id)
    if (error) { setError(error.message); return false }
    onSaved(); return true
  }

  return (
    <Modal title="Modifier l'événement" confirmLabel="Enregistrer" onClose={onSaved} onConfirm={save}>
      <Alert message={error} />
      <div className="grid-2">
        <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Nom</label><input value={nom} onChange={e => setNom(e.target.value)} /></div>
        <div className="form-group"><label>Date de début</label><DateInput value={debut} onChange={setDebut} /></div>
        <div className="form-group"><label>Date de fin</label><DateInput value={fin} onChange={setFin} defaultMonth={debut} /></div>
        <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Lieu</label><input value={lieu} onChange={e => setLieu(e.target.value)} /></div>
        <div className="form-group" style={{ gridColumn: '1/-1' }}>
          <label>Statut</label>
          <select value={statut} onChange={e => setStatut(e.target.value as EvenementStatut)}>
            <option value="actif">Actif</option>
            <option value="termine">Terminé</option>
          </select>
        </div>
      </div>
    </Modal>
  )
}

// ── Onglet Détails ────────────────────────────────────────────────────────────
function TabDetails({ ev, onEdit }: { ev: Evenement; onEdit: () => void }) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Détails de l'événement</div>
        <button className="btn btn-secondary btn-sm" onClick={onEdit}>Modifier</button>
      </div>
      <div className="card-body" style={{ padding: 24 }}>
        <div className="grid-2">
          <div><div className="text-muted">Lieu</div><div style={{ marginTop: 2 }}>{ev.lieu ?? '—'}</div></div>
          <div><div className="text-muted">Statut</div><div style={{ marginTop: 2 }}><Badge statut={ev.statut} /></div></div>
          <div><div className="text-muted">Date de début</div><div style={{ marginTop: 2 }}>{fmtDate(ev.date_debut)}</div></div>
          <div><div className="text-muted">Date de fin</div><div style={{ marginTop: 2 }}>{fmtDate(ev.date_fin)}</div></div>
        </div>
      </div>
    </div>
  )
}

// ── Stand modal ───────────────────────────────────────────────────────────────
function StandForm({ stand, evenementId, onSaved }: { stand: Stand | null; evenementId: string; onSaved: () => void }) {
  const [exposant, setExposant] = useState(stand?.nom_exposant ?? '')
  const [hall, setHall] = useState(stand?.hall ?? '')
  const [numero, setNumero] = useState(stand?.numero ?? '')
  const [surface, setSurface] = useState(stand?.surface != null ? String(stand.surface) : '')
  const [angles, setAngles] = useState(stand?.angles != null ? String(stand.angles) : '')
  const [error, setError] = useState('')

  async function save(): Promise<boolean> {
    if (!numero) { setError('Le numéro de stand est obligatoire.'); return false }
    const payload = {
      evenement_id: evenementId,
      nom_exposant: exposant || null,
      hall: hall || null,
      numero,
      surface: surface !== '' ? parseFloat(surface) : null,
      angles: angles !== '' ? parseInt(angles) : null,
    }
    const { error } = stand
      ? await sb.from('stands').update(payload).eq('id', stand.id)
      : await sb.from('stands').upsert(payload, { onConflict: 'evenement_id,numero' })
    if (error) { setError(error.message); return false }
    onSaved(); return true
  }

  return (
    <Modal title={stand ? 'Modifier le stand' : 'Nouveau stand'} confirmLabel={stand ? 'Enregistrer' : 'Créer'} onClose={onSaved} onConfirm={save}>
      <Alert message={error} />
      <div className="grid-2">
        <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Exposant</label><input value={exposant} onChange={e => setExposant(e.target.value)} /></div>
        <div className="form-group"><label>Hall / Pavillon</label><input value={hall} onChange={e => setHall(e.target.value)} placeholder="Ex: Hall 3" /></div>
        <div className="form-group"><label>Numéro de stand</label><input value={numero} onChange={e => setNumero(e.target.value)} placeholder="Ex: A12" /></div>
        <div className="form-group"><label>Surface (m²)</label><input type="number" min="0" step="0.01" value={surface} onChange={e => setSurface(e.target.value)} placeholder="Ex: 24.50" /></div>
        <div className="form-group"><label>Angles</label><input type="number" min="0" max="4" step="1" value={angles} onChange={e => setAngles(e.target.value)} placeholder="0 – 4" /></div>
      </div>
    </Modal>
  )
}

// ── Import stands modal ───────────────────────────────────────────────────────
function ImportStandsModal({ evenementId, nomEvenement, onDone }: { evenementId: string; nomEvenement: string; onDone: () => void }) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [error, setError] = useState('')

  async function doImport(): Promise<boolean> {
    if (!rows.length) { setError('Veuillez sélectionner un fichier.'); return false }
    const payload = rows.map(r => ({
      evenement_id: evenementId,
      nom_exposant: (r.nom_exposant ?? r['Nom exposant'] ?? null) as string | null,
      hall: (r.hall ?? r.Hall ?? null) as string | null,
      numero: String(r.numero ?? r.Numero ?? r.NUMERO ?? '').trim(),
      surface: r.surface != null && r.surface !== '' ? parseFloat(String(r.surface)) : null,
      angles: r.angles != null && r.angles !== '' ? parseInt(String(r.angles)) : null,
    })).filter(r => r.numero)
    if (!payload.length) { setError('Aucune ligne valide (colonne "numero" requise).'); return false }
    const { error } = await sb.from('stands').upsert(payload, { onConflict: 'evenement_id,numero' })
    if (error) { setError(error.message); return false }
    onDone(); return true
  }

  return (
    <Modal title={`Importer les stands — ${nomEvenement}`} confirmLabel="Importer" onClose={onDone} onConfirm={doImport}>
      <Alert message={error} />
      <p className="text-muted" style={{ marginBottom: 12 }}>
        Colonnes attendues : <strong>numero</strong>, nom_exposant, hall, surface, angles.
      </p>
      <button className="btn btn-secondary btn-sm" style={{ marginBottom: 16 }} onClick={() => downloadTemplate('stands')}>
        ↓ Télécharger le modèle Excel
      </button>
      <ImportZone expectedCols={['nom_exposant', 'hall', 'numero', 'surface', 'angles']} onRows={setRows} />
    </Modal>
  )
}

// ── Onglet Stands ─────────────────────────────────────────────────────────────
// ── Stand prestations modal ───────────────────────────────────────────────────
function StandPrestationsModal({ stand, onClose, onEditPrestation }: { stand: Stand & { prestations?: Prestation[] }; onClose: () => void; onEditPrestation?: (p: Prestation) => void }) {
  const [prestations, setPrestations] = useState<Prestation[]>(stand.prestations ?? [])

  useEffect(() => {
    if (stand.prestations) return
    sb.from('prestations')
      .select('*, prestataires(raison_sociale)')
      .eq('stand_id', stand.id)
      .order('libelle')
      .then(({ data }) => setPrestations(data ?? []))
  }, [stand.id])

  return (
    <Modal
      title={`Prestations — Stand ${stand.numero}${stand.nom_exposant ? ` · ${stand.nom_exposant}` : ''}`}
      confirmLabel="Fermer"
      onClose={onClose}
      onConfirm={async () => { onClose(); return true }}
    >
      {prestations.length === 0 ? (
        <div className="empty-state" style={{ padding: '24px 0' }}>Aucune prestation sur ce stand.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {prestations.map(p => {
            const statut = p.statut_conformite
            const bg = conformiteBg(statut)
            const statutColor = statut ? STATUT_COLORS[statut] : undefined
            const statutLabel = statut ? STATUT_LABELS[statut] : null
            return (
              <div key={p.id}
                style={{ borderRadius: 8, border: '1px solid var(--border)', padding: '10px 12px', cursor: onEditPrestation ? 'pointer' : undefined, ...bg }}
                onClick={() => onEditPrestation?.(p)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{p.libelle}</span>
                  {statutLabel && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: statutColor, background: `${statutColor}20`, padding: '2px 7px', borderRadius: 4, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {statutLabel}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                  {p.categorie && <span>{p.categorie}</span>}
                  {p.quantite_attendue != null && <span>{p.quantite_attendue} unité{p.quantite_attendue > 1 ? 's' : ''}</span>}
                  {p.emplacement_prevu && <span>{p.emplacement_prevu}</span>}
                  {p.prestataires?.raison_sociale && <span style={{ color: 'var(--text-muted)' }}>{p.prestataires.raison_sociale}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}

function TabStands({ ev }: { ev: Evenement }) {
  const [stands, setStands] = useState<Stand[]>([])
  const [modal, setModal] = useState<Stand | null | 'new'>(null)
  const [viewingPrestations, setViewingPrestations] = useState<Stand | null>(null)
  const [editingPrestation, setEditingPrestation] = useState<Prestation | null>(null)
  const [importing, setImporting] = useState(false)
  const [exportFn, setExportFn] = useState<(() => void) | null>(null)

  async function load() {
    // Affiche les données locales immédiatement
    const local = await db.stands.where('evenement_id').equals(ev.id).toArray()
    if (local.length) setStands(local.sort((a, b) => a.numero.localeCompare(b.numero, 'fr', { numeric: true })) as unknown as Stand[])
    // Rafraîchit depuis le réseau si disponible
    try {
      const { data, error } = await sb.from('stands').select('*').eq('evenement_id', ev.id).order('numero')
      if (!error && data) setStands(data)
    } catch { /* données locales déjà affichées */ }
  }

  useEffect(() => { load() }, [])

  return (
    <>
      <div className="card">
        <div className="card-header">
          <div className="card-title">{stands.length} stand{stands.length > 1 ? 's' : ''}</div>
          <div className="flex gap-2">
            <ExportButton onClick={exportFn} />
            <button className="btn btn-secondary btn-sm" onClick={() => setImporting(true)}>Importer</button>
            <button className="btn btn-primary btn-sm" onClick={() => setModal('new')}>+ Stand</button>
          </div>
        </div>
        <div className="card-body">
          <DataTable
            data={stands}
            exportFilename={`stands-${ev.nom}`}
            onExportReady={fn => setExportFn(() => fn)}
            onRowClick={s => setModal(s)}
            emptyState={<div className="empty-state">Aucun stand pour cet événement</div>}
            columns={[
              { key: 'nom_exposant', label: 'Exposant', sortable: true, filterable: true, render: s => <span style={{ fontWeight: 600 }}>{s.nom_exposant}</span> },
              { key: 'hall', label: 'Hall / Pavillon', sortable: true, filterable: true },
              { key: 'numero', label: 'N° de stand', sortable: true, filterable: true },
              { key: 'surface', label: 'Surface (m²)', sortable: true, hideOnMobile: true },
              { key: 'angles', label: 'Angles', sortable: true, hideOnMobile: true },
              { key: 'prestations', label: '', render: s => (
                <button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); setViewingPrestations(s) }}>
                  Prestations
                </button>
              )},
            ]}
          />
        </div>
      </div>
      {modal !== null && <StandForm stand={modal === 'new' ? null : modal} evenementId={ev.id} onSaved={() => { setModal(null); load() }} />}
      {importing && <ImportStandsModal evenementId={ev.id} nomEvenement={ev.nom} onDone={() => { setImporting(false); load() }} />}
      {viewingPrestations && !editingPrestation && <StandPrestationsModal stand={viewingPrestations} onClose={() => setViewingPrestations(null)} onEditPrestation={p => setEditingPrestation(p)} />}
      {editingPrestation && <PrestationForm prest={editingPrestation} evenementId={ev.id} onSaved={() => { setEditingPrestation(null); load() }} onGoToStands={() => setEditingPrestation(null)} />}
    </>
  )
}

const STATUT_LABELS: Record<ControleStatut, string> = {
  conforme: 'Conforme', non_conforme: 'Non conforme', absent: 'Absent', a_verifier: 'À vérifier',
}
const STATUT_COLORS: Record<ControleStatut, string> = {
  conforme: 'var(--success)', non_conforme: '#f97316', absent: 'var(--danger)', a_verifier: 'var(--text-muted)',
}
const STATUT_ROW_BG: Partial<Record<ControleStatut, string>> = {
  conforme: 'rgba(34,197,94,0.12)',
  non_conforme: 'rgba(249,115,22,0.12)',
  absent: 'rgba(239,68,68,0.12)',
}
function conformiteBg(statut: ControleStatut | null | undefined): { background: string } | undefined {
  if (!statut) return undefined
  const bg = STATUT_ROW_BG[statut]
  return bg ? { background: bg } : undefined
}

// ── Prestation modal ──────────────────────────────────────────────────────────
function PrestationForm({ prest, evenementId, onSaved, onGoToStands, readOnly = false }: { prest: Prestation | null; evenementId: string; onSaved: () => void; onGoToStands: () => void; readOnly?: boolean }) {
  const [stands, setStands] = useState<Stand[]>([])
  const [prestataires, setPrestataires] = useState<Prestataire[]>([])
  const [standId, setStandId] = useState(prest?.stand_id ?? '')
  const [libelle, setLibelle] = useState(prest?.libelle ?? '')
  const [categorie, setCategorie] = useState(prest?.categorie ?? '')
  const [qte, setQte] = useState(prest?.quantite_attendue ?? 1)
  const [emplacement, setEmplacement] = useState(prest?.emplacement_prevu ?? '')
  const [prestaId, setPrestaId] = useState(prest?.prestataire_id ?? '')
  const [ajoutSurSite, setAjoutSurSite] = useState(prest?.ajout_sur_site ?? false)
  const [error, setError] = useState('')
  const [standSearch, setStandSearch] = useState('')

  const [cStatut, setCStatut] = useState<ControleStatut | ''>(prest?.statut_conformite ?? '')
  const [cQte, setCQte] = useState<string>(prest?.quantite_constatee != null ? String(prest.quantite_constatee) : '')
  const [cComment, setCComment] = useState(prest?.commentaire ?? '')
  const [commentairePrestataire, setCommentairePrestataire] = useState(prest?.commentaire_prestataire ?? '')
  const [photos, setPhotos] = useState<string[]>([])
  const [newPhotos, setNewPhotos] = useState<File[]>([])
  const [newPhotoUrls, setNewPhotoUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      sb.from('stands').select('*').eq('evenement_id', evenementId).order('numero'),
      sb.from('prestataires').select('*').order('raison_sociale'),
    ]).then(([{ data: s }, { data: p }]) => {
      setStands(s ?? [])
      setPrestataires(p ?? [])
      if (!prest?.stand_id && s?.length) setStandId(s[0].id)
      if (!prest?.prestataire_id && p?.length) setPrestaId(p[0].id)
      if (prest?.stand_id) {
        const found = (s ?? []).find(st => st.id === prest.stand_id)
        if (found) setStandSearch(`${found.numero}${found.nom_exposant ? ` — ${found.nom_exposant}` : ''}`)
      }
    })
    if (prest?.id) {
      sbAdmin.from('photos').select('url').eq('prestation_id', prest.id).not('url', 'is', null)
        .then(({ data }) => setPhotos((data ?? []).map((p: { url: string }) => p.url)))
    }
  }, [])

  useEffect(() => {
    const urls = newPhotos.map(f => URL.createObjectURL(f))
    setNewPhotoUrls(urls)
    return () => { urls.forEach(u => URL.revokeObjectURL(u)) }
  }, [newPhotos])

  if (stands.length === 0) {
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
      if (!uploadRes.ok) { setError(`Upload échoué : ${uploadRes.status} — ${await uploadRes.text()}`); return }
      const { data: { publicUrl } } = sbAdmin.storage.from('Photos').getPublicUrl(path)
      const { error: insErr } = await sbAdmin.from('photos').insert({ prestation_id: prestationId, url: publicUrl, synced: true })
      if (insErr) { setError(`Enregistrement photo échoué : ${insErr.message}`); continue }
    }
  }

  async function deletePhoto(url: string) {
    if (!confirm('Supprimer cette photo ?')) return
    await sbAdmin.from('photos').delete().eq('url', url).eq('prestation_id', prest!.id)
    setPhotos(prev => prev.filter(u => u !== url))
  }

  async function save(): Promise<boolean> {
    setUploading(true)
    try {
      const { data: { user } } = await sb.auth.getUser()

      if (readOnly) {
        // Mode prestataire : seuls le statut et le commentaire prestataire sont modifiables
        if (!prest?.id) return false
        const payload: Record<string, unknown> = {
          commentaire_prestataire: commentairePrestataire || null,
        }
        if (cStatut) {
          payload.statut_conformite = cStatut
          payload.quantite_constatee = cQte !== '' ? parseInt(cQte) : null
          payload.controleur_id = user?.id ?? null
          payload.date_controle = new Date().toISOString()
        }
        const { error } = await sb.from('prestations').update(payload).eq('id', prest.id)
        if (error) { setError(error.message); return false }
        const shouldNotify = (cStatut === 'non_conforme' || cStatut === 'absent') && cStatut !== prest?.statut_conformite
        if (shouldNotify) {
          const { data: { session } } = await sb.auth.getSession()
          fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-non-conformite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}`, 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY },
            body: JSON.stringify({ prestation_id: prest.id }),
          }).catch(() => {})
        }
        onSaved(); return true
      }

      if (!libelle || !standId) { setError('Le stand et le libellé sont obligatoires.'); return false }
      if (!prestaId) { setError('Un prestataire doit être affecté.'); return false }
      const conformitePayload = cStatut ? {
        statut_conformite: cStatut,
        quantite_constatee: cQte !== '' ? parseInt(cQte) : null,
        commentaire: cComment || null,
        controleur_id: user?.id ?? null,
        date_controle: new Date().toISOString(),
      } : {}
      const payload: Record<string, unknown> = {
        stand_id: standId, libelle, categorie: categorie || null,
        quantite_attendue: qte, emplacement_prevu: emplacement || null,
        prestataire_id: prestaId || null, ajout_sur_site: ajoutSurSite,
        commentaire_prestataire: commentairePrestataire || null,
        ...conformitePayload,
      }
      let savedId = prest?.id
      if (prest) {
        const { error } = await sb.from('prestations').update(payload).eq('id', prest.id)
        if (error) { setError(error.message); return false }
      } else {
        const { data, error } = await sb.from('prestations').insert(payload).select().single()
        if (error) { setError(error.message); return false }
        savedId = data.id
      }
      if (newPhotos.length && savedId) await uploadPendingPhotos(savedId)
      const shouldNotify = (cStatut === 'non_conforme' || cStatut === 'absent') && cStatut !== prest?.statut_conformite
      if (shouldNotify && savedId) {
        const { data: { session } } = await sb.auth.getSession()
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-non-conformite`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ prestation_id: savedId }),
        }).catch(() => {})
      }
      onSaved(); return true
    } finally { setUploading(false) }
  }

  const roStyle: React.CSSProperties = { background: 'var(--bg)', color: 'var(--text-muted)', cursor: 'not-allowed' }

  return (
    <Modal title={prest ? 'Modifier la prestation' : 'Nouvelle prestation'} confirmLabel={uploading ? 'Enregistrement…' : prest ? 'Enregistrer' : 'Créer'} onClose={onSaved} onConfirm={save}>
      <Alert message={error} />
      <div className="form-group" style={{ position: 'relative' }}>
        <label>Stand</label>
        <input
          value={standSearch}
          onChange={e => { if (!readOnly) { setStandSearch(e.target.value); setStandId('') } }}
          placeholder="Rechercher par numéro ou nom d'exposant…"
          autoComplete="off"
          readOnly={readOnly}
          style={readOnly ? roStyle : undefined}
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

      <div style={{ marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Conformité</div>
        <div className="grid-2">
          <div className="form-group">
            <label>Statut</label>
            <select value={cStatut} onChange={e => setCStatut(e.target.value as ControleStatut | '')}>
              <option value="">— Non contrôlée —</option>
              {(Object.keys(STATUT_LABELS) as ControleStatut[]).map(s => <option key={s} value={s}>{STATUT_LABELS[s]}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Quantité constatée</label>
            <input type="number" min={0} value={cQte} onChange={e => { if (!readOnly) setCQte(e.target.value) }} placeholder={`Attendue : ${qte}`} readOnly={readOnly} style={readOnly ? roStyle : undefined} />
          </div>
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label>Commentaire / observations</label>
            <input value={cComment} onChange={e => setCComment(e.target.value)} placeholder="Ex: 3 unités présentes, 1 manquante…" readOnly={readOnly} style={readOnly ? roStyle : undefined} />
          </div>
        </div>
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
          <img src={lightbox} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8 }} onClick={e => e.stopPropagation()} />
        </div>
      )}
    </Modal>
  )
}

// ── Import prestations modal ──────────────────────────────────────────────────
function ImportPrestationsModal({ evenementId, onDone }: { evenementId: string; onDone: () => void }) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [error, setError] = useState('')

  async function doImport(): Promise<boolean> {
    if (!rows.length) { setError('Veuillez sélectionner un fichier.'); return false }
    const [{ data: stands }, { data: prestataires }] = await Promise.all([
      sb.from('stands').select('id, numero').eq('evenement_id', evenementId),
      sb.from('prestataires').select('id, raison_sociale'),
    ])
    const standMap = Object.fromEntries((stands ?? []).map(s => [String(s.numero).trim().toLowerCase(), s.id]))
    const prestaMap = Object.fromEntries((prestataires ?? []).map(p => [p.raison_sociale.trim().toLowerCase(), p.id]))
    const toInsert: object[] = []
    const erreurs: string[] = []
    rows.forEach((r, i) => {
      const numStand = String(r.numero_stand ?? '').trim()
      const libelle = String(r.libelle ?? '').trim()
      if (!numStand || !libelle) return
      const standId = standMap[numStand.toLowerCase()]
      const raisonSociale = String(r.raison_sociale_prestataire ?? '').trim()
      const prestaId = raisonSociale ? prestaMap[raisonSociale.toLowerCase()] : null
      if (!standId) { erreurs.push(`Ligne ${i + 2} : stand "${numStand}" introuvable`); return }
      if (!prestaId) { erreurs.push(`Ligne ${i + 2} : prestataire "${raisonSociale || '(vide)'}" introuvable`); return }
      toInsert.push({ stand_id: standId, libelle, categorie: (r.categorie as string) || null, quantite_attendue: parseInt(String(r.quantite)) || 1, emplacement_prevu: (r.emplacement as string) || null, prestataire_id: prestaId })
    })
    if (erreurs.length) setError(`${erreurs.length} ligne(s) ignorée(s) : ${erreurs.slice(0, 5).join(' · ')}`)
    if (!toInsert.length) return false
    const { error } = await sb.from('prestations').insert(toInsert)
    if (error) { setError(error.message); return false }
    onDone(); return true
  }

  return (
    <Modal title="Importer les prestations" confirmLabel="Importer" onClose={onDone} onConfirm={doImport}>
      <Alert message={error} />
      <p className="text-muted" style={{ marginBottom: 12 }}>
        Colonnes : <strong>numero_stand</strong>, <strong>libelle</strong>, categorie, quantite, emplacement, <strong>raison_sociale_prestataire</strong>.
      </p>
      <button className="btn btn-secondary btn-sm" style={{ marginBottom: 16 }} onClick={() => downloadTemplate('prestations')}>
        ↓ Télécharger le modèle Excel
      </button>
      <ImportZone expectedCols={['numero_stand', 'libelle', 'categorie', 'quantite', 'emplacement', 'raison_sociale_prestataire']} onRows={setRows} />
    </Modal>
  )
}

// ── Onglet Prestations ────────────────────────────────────────────────────────
function TabPrestations({ ev, onGoToStands }: { ev: Evenement; onGoToStands: () => void }) {
  const [prestations, setPrestations] = useState<Prestation[]>([])
  const [modal, setModal] = useState<Prestation | null | 'new'>(null)
  const [importing, setImporting] = useState(false)
  const [exportFn, setExportFn] = useState<(() => void) | null>(null)

  async function loadFromCache() {
    const localStands = await db.stands.where('evenement_id').equals(ev.id).toArray()
    if (!localStands.length) return
    const standMap = Object.fromEntries(localStands.map(s => [s.id, s]))
    const localPrests = await db.prestations.where('stand_id').anyOf(localStands.map(s => s.id)).toArray()
    setPrestations(localPrests.map(p => ({
      ...p,
      stands: standMap[p.stand_id] ?? null,
      prestataires: null,
      users: null,
    })) as unknown as Prestation[])
  }

  async function load() {
    // Affiche les données locales immédiatement
    await loadFromCache()
    // Rafraîchit depuis le réseau si disponible
    try {
      const { data: stands, error: standsErr } = await sb.from('stands').select('id').eq('evenement_id', ev.id)
      if (standsErr) throw standsErr
      const standIds = (stands ?? []).map(s => s.id)
      if (!standIds.length) { setPrestations([]); return }
      const { data, error } = await sb.from('prestations')
        .select('*, stands(numero, nom_exposant), prestataires(raison_sociale), users(nom, prenom)')
        .in('stand_id', standIds)
        .order('libelle')
      if (!error && data) setPrestations(data)
    } catch { /* données locales déjà affichées */ }
  }

  useEffect(() => { load() }, [])

  return (
    <>
      <div className="card">
        <div className="card-header">
          <div className="card-title">{prestations.length} prestation{prestations.length > 1 ? 's' : ''}</div>
          <div className="flex gap-2">
            <ExportButton onClick={exportFn} />
            <button className="btn btn-secondary btn-sm" onClick={() => setImporting(true)}>Importer</button>
            <button className="btn btn-primary btn-sm" onClick={() => setModal('new')}>+ Prestation</button>
          </div>
        </div>
        <div className="card-body">
          <DataTable
            data={prestations}
            exportFilename={`prestations-${ev.nom}`}
            onExportReady={fn => setExportFn(() => fn)}
            onRowClick={p => setModal(p)}
            rowStyle={p => conformiteBg(p.statut_conformite)}
            emptyState={<div className="empty-state">Aucune prestation pour cet événement</div>}
            columns={[
              { key: 'stand', label: 'Stand', sortable: true, filterable: true, getValue: p => p.stands?.numero ?? '', render: p => <><strong>{p.stands?.numero}</strong>{p.stands?.nom_exposant ? ` — ${p.stands.nom_exposant}` : ''}</> },
              { key: 'libelle', label: 'Libellé', sortable: true, filterable: true, render: p => <span style={{ fontWeight: 600 }}>{p.libelle}</span> },
              { key: 'categorie', label: 'Catégorie', sortable: true, filterable: true, hideOnMobile: true },
              { key: 'quantite_attendue', label: 'Qté', sortable: true },
              { key: 'emplacement_prevu', label: 'Emplacement', filterable: true, hideOnMobile: true },
              { key: 'prestataire', label: 'Prestataire', sortable: true, filterable: true, hideOnMobile: true, getValue: p => p.prestataires?.raison_sociale ?? '', render: p => p.prestataires?.raison_sociale ?? <span className="text-muted">—</span> },
              { key: 'statut_conformite', label: 'Conformité', sortable: true, filterable: true,
                options: [{ value: '', label: 'Non contrôlée' }, ...Object.entries(STATUT_LABELS).map(([v, l]) => ({ value: v, label: l }))],
                getValue: p => p.statut_conformite ?? '',
                render: p => p.statut_conformite
                  ? <span style={{ color: STATUT_COLORS[p.statut_conformite], fontWeight: 600 }}>{STATUT_LABELS[p.statut_conformite]}</span>
                  : <span className="text-muted">—</span> },
              { key: 'ajout_sur_site', label: 'Sur site', sortable: true, filterable: true, hideOnMobile: true,
                options: [{ value: 'Oui', label: 'À facturer' }, { value: 'Non', label: 'Non' }],
                getValue: p => p.ajout_sur_site ? 'Oui' : 'Non',
                render: p => p.ajout_sur_site ? <span style={{ color: 'var(--amber)', fontWeight: 600 }}>À facturer</span> : <span className="text-muted">—</span> },
            ]}
          />
        </div>
      </div>
      {modal !== null && <PrestationForm prest={modal === 'new' ? null : modal} evenementId={ev.id} onSaved={() => { setModal(null); load() }} onGoToStands={() => { setModal(null); onGoToStands() }} />}
      {importing && <ImportPrestationsModal evenementId={ev.id} onDone={() => { setImporting(false); load() }} />}
    </>
  )
}

// ── Helpers utilisateurs ──────────────────────────────────────────────────────
type Notify = (msg: string, type?: 'success' | 'error') => void

async function sendInvite(email: string, notify: Notify) {
  if (!email) return
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
  if (error) notify(`Erreur : ${error.message}`, 'error')
  else notify(`Email d'invitation envoyé à ${email}`, 'success')
}

// ── Add user to event (existing users only — creation via BO admin) ────────────
function AddUserToEventModal({ evenementId, forcedRole, forcedPrestaId, onClose }: { evenementId: string; forcedRole: RoleLocal; forcedPrestaId?: string; onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [foundUser, setFoundUser] = useState<User | null>(null)
  const [step, setStep] = useState<'email' | 'found' | 'notfound'>('email')
  const [prestaId, setPrestaId] = useState(forcedPrestaId ?? '')
  const [prestataires, setPrestataires] = useState<Prestataire[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (forcedRole === 'prestataire' && !forcedPrestaId) {
      sb.from('prestataires').select('*').order('raison_sociale').then(({ data }) => {
        setPrestataires(data ?? [])
        if (data?.length) setPrestaId(data[0].id)
      })
    }
  }, [forcedRole, forcedPrestaId])

  async function confirm(): Promise<boolean> {
    setError('')
    if (step === 'email') {
      if (!email) { setError('Saisissez un email.'); return false }
      if (!isValidEmail(email)) { setError('Format d\'email invalide.'); return false }
      const { data } = await sb.from('users').select('*').eq('email', normalizeEmail(email)).maybeSingle()
      if (data) { setFoundUser(data); setStep('found') }
      else { setStep('notfound') }
      return false
    }
    if (step === 'notfound') return false
    if (!foundUser) return false

    const { error: accesError } = await sb.from('user_evenements').upsert(
      { user_id: foundUser.id, evenement_id: evenementId, role_local: forcedRole, prestataire_id: forcedRole === 'prestataire' ? prestaId : null },
      { onConflict: 'user_id,evenement_id' }
    )
    if (accesError) { setError(accesError.message); return false }
    onClose(); return true
  }

  const PrestaField = () => forcedRole === 'prestataire' && !forcedPrestaId ? (
    <div className="form-group">
      <label>Société prestataire</label>
      <select value={prestaId} onChange={e => setPrestaId(e.target.value)}>
        {prestataires.map(p => <option key={p.id} value={p.id}>{p.raison_sociale}</option>)}
      </select>
    </div>
  ) : null

  return (
    <Modal
      title={forcedRole === 'prestataire' ? 'Ajouter un utilisateur prestataire' : 'Ajouter un utilisateur'}
      confirmLabel={step === 'email' ? 'Vérifier' : step === 'found' ? 'Ajouter' : 'OK'}
      onClose={onClose}
      onConfirm={confirm}
    >
      <Alert message={error} />
      {step === 'email' && (
        <div className="form-group">
          <label>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} onBlur={() => setEmail(normalizeEmail(email))} autoFocus />
        </div>
      )}
      {step === 'found' && foundUser && (
        <>
          <div className="form-group">
            <label>Compte trouvé</label>
            <div style={{ padding: '8px 12px', background: 'var(--bg)', borderRadius: 6, fontWeight: 600 }}>
              {foundUser.prenom} {foundUser.nom} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({foundUser.email})</span>
            </div>
          </div>
          <PrestaField />
        </>
      )}
      {step === 'notfound' && (
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          Aucun compte trouvé pour <strong>{email}</strong>. La création de compte se fait depuis le back-office admin.
        </div>
      )}
    </Modal>
  )
}

// ── Edit accès modal ──────────────────────────────────────────────────────────
function EditAccesModal({ acces, onClose }: { acces: UserEvenement; onClose: () => void }) {
  const [prestataires, setPrestataires] = useState<Prestataire[]>([])
  const [role, setRole] = useState<RoleLocal>(acces.role_local)
  const [prestaId, setPrestaId] = useState(acces.prestataire_id ?? '')
  const [error, setError] = useState('')

  useEffect(() => {
    sb.from('prestataires').select('*').order('raison_sociale').then(({ data }) => {
      setPrestataires(data ?? [])
      if (!acces.prestataire_id && data?.length) setPrestaId(data[0].id)
    })
  }, [])

  async function save(): Promise<boolean> {
    const { error } = await sb.from('user_evenements')
      .update({ role_local: role, prestataire_id: role === 'prestataire' ? prestaId : null })
      .eq('id', acces.id)
    if (error) { setError(error.message); return false }
    onClose(); return true
  }

  return (
    <Modal title={`Modifier l'accès — ${acces.users?.prenom} ${acces.users?.nom}`} confirmLabel="Enregistrer" onClose={onClose} onConfirm={save}>
      <Alert message={error} />
      <div className="form-group">
        <label>Rôle</label>
        <select value={role} onChange={e => setRole(e.target.value as RoleLocal)}>
          <option value="organisateur">Utilisateur</option>
          <option value="prestataire">Prestataire</option>
        </select>
      </div>
      {role === 'prestataire' && (
        <div className="form-group">
          <label>Société prestataire</label>
          <select value={prestaId} onChange={e => setPrestaId(e.target.value)}>
            {prestataires.map(p => <option key={p.id} value={p.id}>{p.raison_sociale}</option>)}
          </select>
        </div>
      )}
    </Modal>
  )
}

// ── Onglet Utilisateurs ───────────────────────────────────────────────────────
function UserAccesList({ ev, roleFilter }: { ev: Evenement; roleFilter: RoleLocal }) {
  const [acces, setAcces] = useState<UserEvenement[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<UserEvenement | null>(null)
  const [exportFn, setExportFn] = useState<(() => void) | null>(null)
  const { notify, toastEl } = useToast()

  async function load() {
    const { data } = await sb.from('user_evenements')
      .select('*, users(nom, prenom, email), prestataires(raison_sociale)')
      .eq('evenement_id', ev.id)
      .eq('role_local', roleFilter)
    setAcces(data ?? [])
  }

  useEffect(() => { load() }, [roleFilter])

  async function revoke(id: string) {
    if (!confirm('Révoquer cet accès ?')) return
    const { error } = await sb.from('user_evenements').delete().eq('id', id)
    if (error) { notify(error.message, 'error'); return }
    await load()
  }

  const isPresta = roleFilter === 'prestataire'
  const title = isPresta ? 'Utilisateurs prestataires' : 'Utilisateurs'

  return (
    <>
      <div className="card">
        <div className="card-header">
          <div className="card-title">{title}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <ExportButton onClick={exportFn} />
            <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>+ Ajouter</button>
          </div>
        </div>
        <div className="card-body">
          <DataTable
            data={acces}
            exportFilename={`utilisateurs-${ev.nom}`}
            onExportReady={fn => setExportFn(() => fn)}
            onRowClick={a => setEditing(a)}
            emptyState={<div className="empty-state">{isPresta ? 'Aucun utilisateur prestataire.' : 'Aucun utilisateur.'}</div>}
            columns={[
              { key: 'utilisateur', label: 'Utilisateur', sortable: true, filterable: true, getValue: a => `${a.users?.prenom} ${a.users?.nom}`, render: a => <span style={{ fontWeight: 600 }}>{a.users?.prenom} {a.users?.nom}</span> },
              { key: 'email', label: 'Email', sortable: true, filterable: true, getValue: a => a.users?.email ?? '' },
              ...(isPresta ? [{ key: 'prestataire', label: 'Société', sortable: true, filterable: true, getValue: (a: UserEvenement) => a.prestataires?.raison_sociale ?? '' }] : []),
              { key: 'actions', label: '', render: (a: UserEvenement) => (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); sendInvite(a.users?.email ?? '', notify) }}>Invitation</button>
                  <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); revoke(a.id) }}>Révoquer</button>
                </div>
              )},
            ]}
          />
        </div>
      </div>
      {showModal && <AddUserToEventModal evenementId={ev.id} forcedRole={roleFilter} onClose={() => { setShowModal(false); load() }} />}
      {editing && <EditAccesModal acces={editing} onClose={() => { setEditing(null); load() }} />}
      {toastEl}
    </>
  )
}

function TabUtilisateurs({ ev }: { ev: Evenement }) {
  return <UserAccesList ev={ev} roleFilter="organisateur" />
}

// ── Prestataires ──────────────────────────────────────────────────────────────
function EditMembreModal({ membre, onClose }: { membre: UserEvenement; onClose: () => void }) {
  const [prenom, setPrenom] = useState(membre.users?.prenom ?? '')
  const [nom, setNom] = useState(membre.users?.nom ?? '')
  const [error, setError] = useState('')

  async function save(): Promise<boolean> {
    if (!prenom || !nom) { setError('Prénom et nom sont obligatoires.'); return false }
    const { error } = await sb.from('users').update({ prenom, nom }).eq('id', membre.user_id)
    if (error) { setError(error.message); return false }
    onClose(); return true
  }

  return (
    <Modal title={`Modifier — ${membre.users?.prenom} ${membre.users?.nom}`} confirmLabel="Enregistrer" onClose={onClose} onConfirm={save}>
      <Alert message={error} />
      <div className="grid-2">
        <div className="form-group"><label>Prénom</label><input value={prenom} onChange={e => setPrenom(e.target.value)} onBlur={() => setPrenom(normalizePrenom(prenom))} /></div>
        <div className="form-group"><label>Nom</label><input value={nom} onChange={e => setNom(e.target.value)} onBlur={() => setNom(normalizeNom(nom))} /></div>
      </div>
      <div className="form-group"><label>Email</label><input value={membre.users?.email ?? ''} disabled /></div>
    </Modal>
  )
}

function PrestataireDetailModal({ prestataire, evenementId, onClose }: { prestataire: Prestataire; evenementId: string; onClose: () => void }) {
  const [nom, setNom] = useState(prestataire.raison_sociale)
  const [email, setEmail] = useState(prestataire.email_contact ?? '')
  const [tel, setTel] = useState(prestataire.telephone ?? '')
  const [membres, setMembres] = useState<UserEvenement[]>([])
  const [prestations, setPrestations] = useState<Prestation[]>([])
  const [addModal, setAddModal] = useState(false)
  const [editingMembre, setEditingMembre] = useState<UserEvenement | null>(null)
  const [editingPrestation, setEditingPrestation] = useState<Prestation | null>(null)
  const [infoError, setInfoError] = useState('')
  const { notify, toastEl } = useToast()

  async function loadMembres() {
    const { data } = await sb.from('user_evenements')
      .select('*, users(nom, prenom, email)')
      .eq('evenement_id', evenementId)
      .eq('prestataire_id', prestataire.id)
    setMembres(data ?? [])
  }

  async function loadPrestations() {
    const { data: stands } = await sb.from('stands').select('id').eq('evenement_id', evenementId)
    const standIds = (stands ?? []).map(s => s.id)
    if (!standIds.length) { setPrestations([]); return }
    const { data } = await sb.from('prestations')
      .select('*, stands(numero, nom_exposant), users(nom, prenom)')
      .in('stand_id', standIds)
      .eq('prestataire_id', prestataire.id)
      .order('libelle')
    setPrestations(data ?? [])
  }

  useEffect(() => { loadMembres(); loadPrestations() }, [])

  async function saveInfo(): Promise<boolean> {
    if (!nom) { setInfoError('La raison sociale est obligatoire.'); return false }
    const { error } = await sb.from('prestataires').update({ raison_sociale: nom, email_contact: email || null, telephone: tel || null }).eq('id', prestataire.id)
    if (error) { setInfoError(error.message); return false }
    onClose(); return true
  }

  async function revokeMembre(id: string) {
    if (!confirm('Retirer ce membre ?')) return
    await sb.from('user_evenements').delete().eq('id', id)
    loadMembres()
  }

  async function retirerDeLEvenement() {
    if (!confirm(`Retirer "${prestataire.raison_sociale}" de cet événement ?\n\nTous ses membres seront révoqués. Les prestations associées resteront mais sans accès utilisateur.`)) return
    const { error } = await sb.from('user_evenements')
      .delete()
      .eq('evenement_id', evenementId)
      .eq('prestataire_id', prestataire.id)
    if (error) { notify(error.message, 'error'); return }
    onClose()
  }

  return (
    <>
      <Modal title={prestataire.raison_sociale} confirmLabel="Enregistrer" onClose={onClose} onConfirm={saveInfo}
        footer={<button className="btn btn-danger btn-sm" style={{ marginRight: 'auto' }} onClick={retirerDeLEvenement}>Retirer de l'événement</button>}
      >
        <Alert message={infoError} />
        <div className="form-group"><label>Raison sociale</label><input value={nom} onChange={e => setNom(e.target.value)} /></div>
        <div className="grid-2">
          <div className="form-group"><label>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
          <div className="form-group"><label>Téléphone</label><input value={tel} onChange={e => setTel(e.target.value)} /></div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', marginTop: 16, paddingTop: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Prestations sur cet événement</div>
          {prestations.length === 0 ? (
            <div className="text-muted" style={{ fontSize: 13 }}>Aucune prestation assignée.</div>
          ) : (
            <table style={{ width: '100%', fontSize: 13 }}>
              <thead><tr>
                <th style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', paddingBottom: 6 }}>Stand</th>
                <th style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', paddingBottom: 6 }}>Libellé</th>
                <th style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', paddingBottom: 6 }}>Conformité</th>
              </tr></thead>
              <tbody>
                {prestations.map(p => (
                  <tr key={p.id} style={{ cursor: 'pointer', borderTop: '1px solid var(--border)', ...conformiteBg(p.statut_conformite) }} onClick={() => setEditingPrestation(p)}>
                    <td style={{ padding: '8px 8px 8px 0', fontWeight: 600 }}>{p.stands?.numero}{p.stands?.nom_exposant ? ` — ${p.stands.nom_exposant}` : ''}</td>
                    <td style={{ padding: '8px 8px 8px 0' }}>{p.libelle}</td>
                    <td style={{ padding: '8px 0' }}>
                      {p.statut_conformite
                        ? <span style={{ color: STATUT_COLORS[p.statut_conformite], fontWeight: 600 }}>{STATUT_LABELS[p.statut_conformite]}</span>
                        : <span className="text-muted">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ borderTop: '1px solid var(--border)', marginTop: 16, paddingTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Membres sur cet événement</div>
            <button className="btn btn-primary btn-sm" onClick={() => setAddModal(true)}>+ Ajouter</button>
          </div>
          {membres.length === 0 ? (
            <div className="text-muted" style={{ fontSize: 13 }}>Aucun membre pour cet événement.</div>
          ) : (
            <table style={{ width: '100%', fontSize: 13 }}>
              <thead><tr><th>Nom</th><th>Email</th><th></th></tr></thead>
              <tbody>
                {membres.map(m => (
                  <tr key={m.id} style={{ cursor: 'pointer' }} onClick={() => setEditingMembre(m)}>
                    <td style={{ fontWeight: 600 }}>{m.users?.prenom} {m.users?.nom}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{m.users?.email}</td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); sendInvite(m.users?.email ?? '', notify) }}>Invitation</button>
                        <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); revokeMembre(m.id) }}>Retirer</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Modal>
      {addModal && <AddUserToEventModal evenementId={evenementId} forcedRole="prestataire" forcedPrestaId={prestataire.id} onClose={() => { setAddModal(false); loadMembres() }} />}
      {editingMembre && <EditMembreModal membre={editingMembre} onClose={() => { setEditingMembre(null); loadMembres() }} />}
      {editingPrestation && <PrestationForm readOnly prest={editingPrestation} evenementId={evenementId} onSaved={() => { setEditingPrestation(null); loadPrestations() }} onGoToStands={() => setEditingPrestation(null)} />}
      {toastEl}
    </>
  )
}

function TabPrestataires({ ev }: { ev: Evenement }) {
  const [prestataires, setPrestataires] = useState<Prestataire[]>([])
  const [selected, setSelected] = useState<Prestataire | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [exportFn, setExportFn] = useState<(() => void) | null>(null)
  const [newNom, setNewNom] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newTel, setNewTel] = useState('')
  const [newError, setNewError] = useState('')
  const { notify, toastEl } = useToast()

  async function load() {
    const { data } = await sb.from('prestataires').select('*').order('raison_sociale')
    setPrestataires(data ?? [])
  }

  useEffect(() => { load() }, [])

  async function create(): Promise<boolean> {
    if (!newNom) { setNewError('La raison sociale est obligatoire.'); return false }
    if (newEmail && !isValidEmail(newEmail)) { setNewError('Format d\'email invalide.'); return false }
    const { error } = await sb.from('prestataires').insert({ raison_sociale: newNom, email_contact: normalizeEmail(newEmail) || null, telephone: newTel || null })
    if (error) { setNewError(error.message); return false }
    setNewNom(''); setNewEmail(''); setNewTel('')
    load(); return true
  }

  async function retirer(p: Prestataire) {
    if (!confirm(`Retirer "${p.raison_sociale}" de cet événement ?\n\nTous ses membres seront révoqués. Les prestations associées resteront mais sans accès utilisateur.`)) return
    const { error } = await sb.from('user_evenements').delete().eq('evenement_id', ev.id).eq('prestataire_id', p.id)
    if (error) { notify(error.message, 'error'); return }
    notify(`${p.raison_sociale} retiré de l'événement`, 'success')
    load()
  }

  return (
    <>
      <div className="card">
        <div className="card-header">
          <div className="card-title">Sociétés prestataires</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <ExportButton onClick={exportFn} />
            <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}>+ Nouveau prestataire</button>
          </div>
        </div>
        <div className="card-body">
          <DataTable
            data={prestataires}
            exportFilename={`prestataires-${ev.nom}`}
            onExportReady={fn => setExportFn(() => fn)}
            onRowClick={p => setSelected(p)}
            emptyState={<div className="empty-state">Aucun prestataire.</div>}
            columns={[
              { key: 'raison_sociale', label: 'Raison sociale', sortable: true, filterable: true, render: p => <span style={{ fontWeight: 600 }}>{p.raison_sociale}</span> },
              { key: 'email_contact', label: 'Email', sortable: true, filterable: true },
              { key: 'telephone', label: 'Téléphone', filterable: true },
              { key: 'actions', label: '', render: p => (
                <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); retirer(p) }}>Retirer</button>
              )},
            ]}
          />
        </div>
      </div>
      {selected && <PrestataireDetailModal prestataire={selected} evenementId={ev.id} onClose={() => { setSelected(null); load() }} />}
      {showNew && (
        <Modal title="Nouveau prestataire" confirmLabel="Créer" onClose={() => setShowNew(false)} onConfirm={create}>
          <Alert message={newError} />
          <div className="form-group"><label>Raison sociale</label><input value={newNom} onChange={e => setNewNom(e.target.value)} autoFocus /></div>
          <div className="grid-2">
            <div className="form-group"><label>Email</label><input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} /></div>
            <div className="form-group"><label>Téléphone</label><input value={newTel} onChange={e => setNewTel(e.target.value)} /></div>
          </div>
        </Modal>
      )}
      {toastEl}
    </>
  )
}

// ── Onglet Tableau de bord (organisateur) ────────────────────────────────────
function TabDashboard({ ev }: { ev: Evenement }) {
  const [stats, setStats] = useState<{
    nbStands: number; total: number
    conforme: number; non_conforme: number; absent: number; a_verifier: number; non_controlees: number
    standsConforme: number; standsAControler: number; standsNonConforme: number
  } | null>(null)

  useEffect(() => {
    function classifyStands<S extends { id: string }, P extends { stand_id: string; statut_conformite: string | null }>(
      stands: S[], prests: P[]
    ) {
      let standsConforme = 0, standsAControler = 0, standsNonConforme = 0
      for (const stand of stands) {
        const sp = prests.filter(p => p.stand_id === stand.id)
        if (sp.some(p => p.statut_conformite === 'non_conforme' || p.statut_conformite === 'absent')) standsNonConforme++
        else if (sp.length > 0 && sp.every(p => p.statut_conformite === 'conforme')) standsConforme++
        else standsAControler++
      }
      return { standsConforme, standsAControler, standsNonConforme }
    }

    async function loadFromCache() {
      const localStands = await db.stands.where('evenement_id').equals(ev.id).toArray()
      const localPrests = await db.prestations.where('stand_id').anyOf(localStands.map(s => s.id)).toArray()
      setStats({
        nbStands: localStands.length,
        total: localPrests.length,
        conforme: localPrests.filter(p => p.statut_conformite === 'conforme').length,
        non_conforme: localPrests.filter(p => p.statut_conformite === 'non_conforme').length,
        absent: localPrests.filter(p => p.statut_conformite === 'absent').length,
        a_verifier: localPrests.filter(p => p.statut_conformite === 'a_verifier').length,
        non_controlees: localPrests.filter(p => !p.statut_conformite).length,
        ...classifyStands(localStands, localPrests),
      })
    }
    async function load() {
      await loadFromCache()
      try {
        type RawStand = { id: string; prestations: { statut_conformite: string | null }[] }
        const { data, error: sErr } = await sb.from('stands')
          .select('id, prestations(statut_conformite)')
          .eq('evenement_id', ev.id)
        if (sErr) throw sErr
        const stands = (data ?? []) as unknown as RawStand[]
        if (!stands.length) {
          setStats({ nbStands: 0, total: 0, conforme: 0, non_conforme: 0, absent: 0, a_verifier: 0, non_controlees: 0, standsConforme: 0, standsAControler: 0, standsNonConforme: 0 })
          return
        }
        const list = stands.flatMap(s => s.prestations)
        const standsWithId = stands.map(s => ({ id: s.id }))
        const prestsWithStandId = stands.flatMap(s => s.prestations.map(p => ({ stand_id: s.id, statut_conformite: p.statut_conformite })))
        setStats({
          nbStands: stands.length,
          total: list.length,
          conforme: list.filter(p => p.statut_conformite === 'conforme').length,
          non_conforme: list.filter(p => p.statut_conformite === 'non_conforme').length,
          absent: list.filter(p => p.statut_conformite === 'absent').length,
          a_verifier: list.filter(p => p.statut_conformite === 'a_verifier').length,
          non_controlees: list.filter(p => !p.statut_conformite).length,
          ...classifyStands(standsWithId, prestsWithStandId),
        })
      } catch { /* données locales déjà affichées */ }
    }
    load()
  }, [ev.id])

  if (!stats) return <div className="empty-state">Chargement…</div>

  const controlled = stats.conforme + stats.non_conforme + stats.absent + stats.a_verifier
  const pct = (n: number) => stats.total > 0 ? Math.round(n / stats.total * 100) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="stats-grid">
        <div className="stat-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: 12 }}>
            <div className="stat-value">{stats.nbStands}</div>
            <div className="stat-label">Stands</div>
          </div>
          <div style={{ display: 'flex', borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 'auto' }}>
            {([
              { label: 'Conf.', count: stats.standsConforme, color: 'var(--success)' },
              { label: 'À ctrl.', count: stats.standsAControler, color: 'var(--text-muted)' },
              { label: 'NC', count: stats.standsNonConforme, color: '#f97316' },
            ] as const).map(({ label, count, color }, i, arr) => (
              <div key={label} style={{ flex: 1, textAlign: 'center', borderRight: i < arr.length - 1 ? '1px solid var(--border)' : undefined }}>
                <div style={{ fontSize: 20, fontWeight: 700, color, lineHeight: 1 }}>{count}</div>
                <div style={{ fontSize: 9, color, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 3, opacity: 0.85 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="stat-card"><div className="stat-value">{stats.total}</div><div className="stat-label">Prestations</div></div>
        <div className="stat-card"><div className="stat-value" style={{ color: stats.total > 0 ? 'var(--accent-dark)' : undefined }}>{stats.total > 0 ? `${pct(controlled)}%` : '—'}</div><div className="stat-label">Contrôlées</div></div>
        <div className="stat-card"><div className="stat-value" style={{ color: 'var(--success)' }}>{stats.conforme}</div><div className="stat-label">Conformes</div></div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Avancement du contrôle</div>
          <span className="text-muted" style={{ fontSize: 13 }}>{controlled} / {stats.total} contrôlées</span>
        </div>
        <div className="card-body" style={{ padding: 24 }}>
          {stats.total === 0 ? (
            <div className="empty-state" style={{ padding: '16px 0' }}>Aucune prestation sur cet événement.</div>
          ) : (
            <>
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Progression globale</span>
                  <strong>{pct(controlled)}%</strong>
                </div>
                <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct(controlled)}%`, background: 'var(--accent)', borderRadius: 4, transition: 'width 0.3s' }} />
                </div>
              </div>
              {([
                { label: 'Conformes', count: stats.conforme, color: 'var(--success)' },
                { label: 'Non conformes', count: stats.non_conforme, color: '#f97316' },
                { label: 'Absentes', count: stats.absent, color: 'var(--danger)' },
                { label: 'À vérifier', count: stats.a_verifier, color: 'var(--text-muted)' },
                { label: 'Non contrôlées', count: stats.non_controlees, color: 'var(--text-muted)' },
              ] as const).map(({ label, count, color }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
                  <span style={{ width: 130, fontSize: 13, color: 'var(--text)' }}>{label}</span>
                  <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct(count)}%`, background: color, borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color, minWidth: 28, textAlign: 'right' }}>{count}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 38, textAlign: 'right' }}>{pct(count)}%</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Vue organisateur ──────────────────────────────────────────────────────────
type Tab = 'dashboard' | 'details' | 'stands' | 'prestations' | 'prestataires' | 'utilisateurs'

export function VueOrganisateur({ ev, onReload }: { ev: Evenement; onReload: () => void }) {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [editing, setEditing] = useState(false)

  const TAB_LABELS: Record<Tab, string> = {
    dashboard: 'Tableau de bord',
    details: 'Détails',
    stands: 'Stands',
    prestations: 'Prestations',
    prestataires: 'Prestataires',
    utilisateurs: 'Utilisateurs',
  }

  return (
    <>
      <div className="tabs" style={{ marginBottom: 20 }}>
        {(Object.keys(TAB_LABELS) as Tab[]).map(t => (
          <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <TabDashboard ev={ev} />}
      {tab === 'details' && <TabDetails ev={ev} onEdit={() => setEditing(true)} />}
      {tab === 'stands' && <TabStands ev={ev} />}
      {tab === 'prestations' && <TabPrestations ev={ev} onGoToStands={() => setTab('stands')} />}
      {tab === 'prestataires' && <TabPrestataires ev={ev} />}
      {tab === 'utilisateurs' && <TabUtilisateurs ev={ev} />}

      {editing && <EvenementForm ev={ev} onSaved={() => { setEditing(false); onReload() }} />}
    </>
  )
}

// ── Vue prestataire ───────────────────────────────────────────────────────────
type PrestaTab = 'dashboard' | 'stands' | 'prestations'

export function VuePrestataire({ ev, userId }: { ev: Evenement; userId: string }) {
  const [stands, setStands] = useState<(Stand & { prestations: Prestation[] })[]>([])
  const [viewingPrestations, setViewingPrestations] = useState<(Stand & { prestations: Prestation[] }) | null>(null)
  const [editingPrestation, setEditingPrestation] = useState<Prestation | null>(null)
  const [tab, setTab] = useState<PrestaTab>('dashboard')
  const [exportFnStands, setExportFnStands] = useState<(() => void) | null>(null)
  const [exportFnPresta, setExportFnPresta] = useState<(() => void) | null>(null)

  useEffect(() => {
    async function load() {
      const { data: acces } = await sb.from('user_evenements')
        .select('prestataire_id')
        .eq('evenement_id', ev.id)
        .eq('user_id', userId)
        .single()
      if (!acces?.prestataire_id) return
      const { data: prests } = await sb.from('prestations')
        .select('*, stands(*)')
        .eq('prestataire_id', acces.prestataire_id)
      if (!prests) return
      const byStand = new Map<string, Stand & { prestations: Prestation[] }>()
      for (const p of prests) {
        if (!p.stands || (p.stands as Stand).evenement_id !== ev.id) continue
        const s = p.stands as Stand
        if (!byStand.has(s.id)) byStand.set(s.id, { ...s, prestations: [] })
        byStand.get(s.id)!.prestations.push(p)
      }
      setStands(Array.from(byStand.values()).sort((a, b) => a.numero.localeCompare(b.numero)))
    }
    load()
  }, [ev.id, userId])

  const allPrestations = stands.flatMap(s => s.prestations)
  const nbStands = stands.length
  const nbNonVerif = allPrestations.filter(p => !p.statut_conformite || p.statut_conformite === 'a_verifier').length
  const nbConforme = allPrestations.filter(p => p.statut_conformite === 'conforme').length
  const nbNonConforme = allPrestations.filter(p => p.statut_conformite === 'non_conforme').length
  const nbAbsent = allPrestations.filter(p => p.statut_conformite === 'absent').length

  function onPrestationSaved(updated: Prestation) {
    setStands(prev => prev.map(s => ({ ...s, prestations: s.prestations.map(p => p.id === updated.id ? updated : p) })))
  }

  return (
    <>
      <div className="tabs">
        {([['dashboard', 'Tableau de bord'], ['stands', 'Mes stands'], ['prestations', 'Mes prestations']] as [PrestaTab, string][]).map(([t, label]) => (
          <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{label}</button>
        ))}
      </div>

      {tab === 'dashboard' && (
        stands.length === 0 ? (
          <div className="empty-state">Aucune prestation affectée à votre société sur cet événement.</div>
        ) : (
          <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 160, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px 24px' }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--text)' }}>{nbStands}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Stand{nbStands > 1 ? 's' : ''}</div>
            </div>
            <div style={{ flex: 1, minWidth: 160, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px 24px' }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--text-muted)' }}>{nbNonVerif}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Non vérifiée{nbNonVerif > 1 ? 's' : ''}</div>
            </div>
            <div style={{ flex: 1, minWidth: 160, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 'var(--radius)', padding: '20px 24px' }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--success)' }}>{nbConforme}</div>
              <div style={{ fontSize: 12, color: 'var(--success)', marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.04em', opacity: 0.8 }}>Conforme{nbConforme > 1 ? 's' : ''}</div>
            </div>
            <div style={{ flex: 1, minWidth: 160, background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 'var(--radius)', padding: '20px 24px' }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: '#f97316' }}>{nbNonConforme}</div>
              <div style={{ fontSize: 12, color: '#f97316', marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.04em', opacity: 0.8 }}>Non conforme{nbNonConforme > 1 ? 's' : ''}</div>
            </div>
            <div style={{ flex: 1, minWidth: 160, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 'var(--radius)', padding: '20px 24px' }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--danger)' }}>{nbAbsent}</div>
              <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.04em', opacity: 0.8 }}>Absent{nbAbsent > 1 ? 's' : ''}</div>
            </div>
          </div>
        )
      )}

      {tab === 'stands' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Mes stands</div>
            <ExportButton onClick={exportFnStands} />
          </div>
          <div className="card-body">
            <DataTable
              data={stands}
              exportFilename={`mes-stands-${ev.nom}`}
              onExportReady={fn => setExportFnStands(() => fn)}
              onRowClick={s => setViewingPrestations(s)}
              emptyState={<div className="empty-state">Aucune prestation affectée à votre société sur cet événement.</div>}
              columns={[
                { key: 'numero', label: 'N° stand', sortable: true, filterable: true, render: s => <span style={{ fontWeight: 700, color: 'var(--accent-dark)' }}>{s.numero}</span> },
                { key: 'nom_exposant', label: 'Exposant', sortable: true, filterable: true },
                { key: 'hall', label: 'Hall', sortable: true, filterable: true },
                { key: 'surface', label: 'Surface (m²)', sortable: true },
                { key: 'prestations', label: 'Prestations', sortable: true, getValue: s => String(s.prestations.length), render: s => <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{s.prestations.length} prestation{s.prestations.length > 1 ? 's' : ''} ↗</span> },
              ]}
            />
          </div>
        </div>
      )}

      {tab === 'prestations' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Mes prestations</div>
            <ExportButton onClick={exportFnPresta} />
          </div>
          <div className="card-body">
            <DataTable
              data={allPrestations}
              exportFilename={`mes-prestations-${ev.nom}`}
              onExportReady={fn => setExportFnPresta(() => fn)}
              onRowClick={p => setEditingPrestation(p)}
              rowStyle={p => conformiteBg(p.statut_conformite)}
              emptyState={<div className="empty-state">Aucune prestation affectée à votre société sur cet événement.</div>}
              columns={[
                { key: 'stand', label: 'Stand', sortable: true, filterable: true, getValue: p => (p.stands as Stand | undefined)?.numero ?? '', render: p => <strong>{(p.stands as Stand | undefined)?.numero ?? '—'}</strong> },
                { key: 'libelle', label: 'Libellé', sortable: true, filterable: true, render: p => <span style={{ fontWeight: 600 }}>{p.libelle}</span> },
                { key: 'categorie', label: 'Catégorie', sortable: true, filterable: true },
                { key: 'quantite_attendue', label: 'Qté', sortable: true },
                { key: 'emplacement_prevu', label: 'Emplacement', filterable: true },
                { key: 'statut_conformite', label: 'Conformité', sortable: true, filterable: true,
                  options: [
                    { value: 'conforme', label: 'Conforme' },
                    { value: 'non_conforme', label: 'Non conforme' },
                    { value: 'absent', label: 'Absent' },
                    { value: 'a_verifier', label: 'À vérifier' },
                  ],
                  render: p => p.statut_conformite
                    ? <span style={{ color: STATUT_COLORS[p.statut_conformite], fontWeight: 600 }}>{STATUT_LABELS[p.statut_conformite]}</span>
                    : <span className="text-muted">—</span>,
                },
              ]}
            />
          </div>
        </div>
      )}

      {viewingPrestations && !editingPrestation && (
        <StandPrestationsModal
          stand={viewingPrestations}
          onClose={() => setViewingPrestations(null)}
          onEditPrestation={p => setEditingPrestation(p)}
        />
      )}
      {editingPrestation && (
        <PrestationForm
          prest={editingPrestation}
          evenementId={ev.id}
          onSaved={async () => {
            const { data } = await sb.from('prestations').select('*, stands(*), users(nom, prenom)').eq('id', editingPrestation.id).single()
            if (data) onPrestationSaved(data)
            setEditingPrestation(null)
          }}
          onGoToStands={() => setEditingPrestation(null)}
          readOnly
        />
      )}
    </>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────
export function FicheEvenementOrganisateurPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [ev, setEv] = useState<Evenement | null>(null)
  const [role, setRole] = useState<RoleLocal | null>(null)

  async function load() {
    if (!user || !id) return
    try {
      const [{ data: evData, error: evErr }, { data: accesData }] = await Promise.all([
        sb.from('evenements').select('*').eq('id', id).single(),
        sb.from('user_evenements').select('role_local').eq('evenement_id', id).eq('user_id', user.id).single(),
      ])
      if (evErr) throw evErr
      setEv(evData ?? null)
      setRole((accesData?.role_local as RoleLocal) ?? null)
    } catch {
      const local = await db.evenements.get(id)
      if (local) {
        setEv(local as unknown as Evenement)
        setRole((local.role_local as RoleLocal) ?? 'organisateur')
      }
    }
  }

  useEffect(() => { load() }, [id, user])

  if (!ev || !role || !user) return <div className="empty-state">Chargement…</div>

  return (
    <>
      <div className="page-header">
        <button className="back-link" onClick={() => navigate('/')}>← Mes événements</button>
        <div style={{ marginTop: 12 }}>
          <div className="page-title">{ev.nom}</div>
          <div className="page-subtitle">{ev.lieu ?? '—'} · {fmtDate(ev.date_debut)} → {fmtDate(ev.date_fin)} · <Badge statut={ev.statut} /></div>
        </div>
      </div>

      {role === 'organisateur'
        ? <VueOrganisateur ev={ev} onReload={load} />
        : <VuePrestataire ev={ev} userId={user.id} />
      }
    </>
  )
}
