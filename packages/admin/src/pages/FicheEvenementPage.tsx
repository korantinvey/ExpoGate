import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { sb, sbAdmin } from '../lib/supabase'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { Alert } from '../components/ui/Alert'
import { ImportZone } from '../components/ui/ImportZone'
import { DataTable } from '../components/ui/DataTable'
import { ExportButton } from '../components/ui/ExportButton'
import { DateInput } from '../components/ui/DateInput'
import { useToast } from '../components/ui/Toast'
import { fmtDate } from '../lib/format'
import { downloadTemplate } from '../lib/excel'
import { compressImage } from '../lib/compressImage'
import { normalizeNom, normalizePrenom, normalizeEmail, isValidEmail } from '../lib/normalize'
import type {
  Evenement, EvenementStatut, Stand, Prestation, ControleStatut,
  Prestataire, User, UserEvenement, RoleLocal,
} from '../types'

// ── Edit event modal (reused from EvenementsPage) ────────────────────────────
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
            <option value="parametrage">Paramétrage</option>
            <option value="actif">Actif</option>
            <option value="termine">Terminé</option>
          </select>
        </div>
      </div>
    </Modal>
  )
}

// ── Onglet Détails ────────────────────────────────────────────────────────────
function TabDetails({ ev }: { ev: Evenement }) {
  return (
    <div className="card">
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
        Colonnes attendues : <strong>numero</strong>, nom_exposant, hall, emplacement.
      </p>
      <button className="btn btn-secondary btn-sm" style={{ marginBottom: 16 }} onClick={() => downloadTemplate('stands')}>
        ↓ Télécharger le modèle Excel
      </button>
      <ImportZone expectedCols={['nom_exposant', 'hall', 'numero', 'surface', 'angles']} onRows={setRows} />
    </Modal>
  )
}

// ── Stand prestations modal ───────────────────────────────────────────────────
function StandPrestationsModal({ stand, evenementId, onClose }: { stand: Stand; evenementId: string; onClose: () => void }) {
  const [prestations, setPrestations] = useState<Prestation[]>([])
  const [editing, setEditing] = useState<Prestation | null | 'new'>(null)

  function load() {
    sb.from('prestations')
      .select('*, prestataires(raison_sociale)')
      .eq('stand_id', stand.id)
      .order('libelle')
      .then(({ data }) => setPrestations(data ?? []))
  }

  useEffect(() => { load() }, [stand.id])

  if (editing !== null) {
    return (
      <PrestationForm
        prest={editing === 'new' ? null : editing}
        evenementId={evenementId}
        onSaved={() => { setEditing(null); load() }}
        onGoToStands={() => setEditing(null)}
      />
    )
  }

  return (
    <Modal
      title={`Prestations — Stand ${stand.numero}${stand.nom_exposant ? ` · ${stand.nom_exposant}` : ''}`}
      confirmLabel="Fermer"
      onClose={onClose}
      onConfirm={async () => { onClose(); return true }}
      footer={<button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>+ Prestation</button>}
    >
      {prestations.length === 0 ? (
        <div className="empty-state" style={{ padding: '24px 0' }}>Aucune prestation sur ce stand.</div>
      ) : (
        <table style={{ width: '100%', fontSize: 14 }}>
          <thead>
            <tr>
              <th>Libellé</th>
              <th>Catégorie</th>
              <th>Qté</th>
              <th>Emplacement</th>
              <th>Prestataire</th>
            </tr>
          </thead>
          <tbody>
            {prestations.map(p => (
              <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => setEditing(p)}>
                <td style={{ fontWeight: 600 }}>{p.libelle}</td>
                <td>{p.categorie ?? '—'}</td>
                <td>{p.quantite_attendue}</td>
                <td>{p.emplacement_prevu ?? '—'}</td>
                <td>{p.prestataires?.raison_sociale ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  )
}

// ── Onglet Stands ─────────────────────────────────────────────────────────────
type StandAvecStatut = Stand & { _statut: 'valide' | 'a_valider' | 'sans_prestation' }

function categoriserStand(stand: Stand, prestationsParStand: Record<string, { statut_conformite: string | null }[]>): StandAvecStatut {
  const prests = prestationsParStand[stand.id] ?? []
  if (prests.length === 0) return { ...stand, _statut: 'sans_prestation' }
  const toutConforme = prests.every(p => p.statut_conformite === 'conforme')
  return { ...stand, _statut: toutConforme ? 'valide' : 'a_valider' }
}

function TabStands({ ev }: { ev: Evenement }) {
  const [stands, setStands] = useState<StandAvecStatut[]>([])
  const [modal, setModal] = useState<Stand | null | 'new'>(null)
  const [viewingPrestations, setViewingPrestations] = useState<Stand | null>(null)
  const [importing, setImporting] = useState(false)
  const [exportFn, setExportFn] = useState<(() => void) | null>(null)
  const [sousOnglet, setSousOnglet] = useState<'a_valider' | 'valide' | 'tous'>('a_valider')

  async function load() {
    const { data: standsData } = await sb.from('stands').select('*').eq('evenement_id', ev.id).order('numero')
    const rawStands = standsData ?? []
    const standIds = rawStands.map(s => s.id)
    const prestationsParStand: Record<string, { statut_conformite: string | null }[]> = {}
    if (standIds.length > 0) {
      const { data: p } = await sb.from('prestations').select('stand_id, statut_conformite').in('stand_id', standIds)
      for (const row of p ?? []) {
        if (!prestationsParStand[row.stand_id]) prestationsParStand[row.stand_id] = []
        prestationsParStand[row.stand_id].push(row)
      }
    }
    setStands(rawStands.map(s => categoriserStand(s, prestationsParStand)))
  }

  useEffect(() => { load() }, [])

  const standsFiltrés = sousOnglet === 'tous' ? stands
    : sousOnglet === 'valide' ? stands.filter(s => s._statut === 'valide')
    : stands.filter(s => s._statut === 'a_valider' || s._statut === 'sans_prestation')

  const nbAValider = stands.filter(s => s._statut === 'a_valider' || s._statut === 'sans_prestation').length
  const nbValides = stands.filter(s => s._statut === 'valide').length

  const columns = [
    { key: 'nom_exposant', label: 'Exposant', sortable: true, filterable: true, render: (s: StandAvecStatut) => <span style={{ fontWeight: 600 }}>{s.nom_exposant}</span> },
    { key: 'hall', label: 'Hall / Pavillon', sortable: true, filterable: true },
    { key: 'numero', label: 'N° de stand', sortable: true, filterable: true },
    { key: 'surface', label: 'Surface (m²)', sortable: true, hideOnMobile: true },
    { key: 'angles', label: 'Angles', sortable: true, hideOnMobile: true },
    { key: 'prestations', label: '', render: (s: StandAvecStatut) => (
      <button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); setViewingPrestations(s as Stand) }}>
        Prestations
      </button>
    )},
  ]

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
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', padding: '0 20px' }}>
          {([
            { key: 'a_valider', label: 'À valider', count: nbAValider },
            { key: 'valide', label: 'Validés', count: nbValides },
            { key: 'tous', label: 'Tous', count: stands.length },
          ] as const).map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setSousOnglet(key)}
              style={{
                padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: sousOnglet === key ? 600 : 400,
                color: sousOnglet === key ? 'var(--accent-dark)' : 'var(--text-muted)',
                borderBottom: sousOnglet === key ? '2px solid var(--accent-dark)' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {label} <span style={{ marginLeft: 4, fontSize: 12, background: 'var(--border)', borderRadius: 10, padding: '1px 7px' }}>{count}</span>
            </button>
          ))}
        </div>
        <div className="card-body">
          <DataTable
            data={standsFiltrés}
            exportFilename={`stands-${ev.nom}-${sousOnglet}`}
            onExportReady={fn => setExportFn(() => fn)}
            onRowClick={s => setModal(s)}
            emptyState={
              <div className="empty-state">
                <div className="empty-icon">▦</div>
                <div>{sousOnglet === 'a_valider' ? 'Tous les stands sont validés' : sousOnglet === 'valide' ? 'Aucun stand validé' : 'Aucun stand pour cet événement'}</div>
                {sousOnglet === 'tous' && <div className="mt-4"><button className="btn btn-primary" onClick={() => setModal('new')}>Ajouter un stand</button></div>}
              </div>
            }
            columns={columns}
          />
        </div>
      </div>

      {modal !== null && (
        <StandForm stand={modal === 'new' ? null : modal} evenementId={ev.id} onSaved={() => { setModal(null); load() }} />
      )}
      {importing && (
        <ImportStandsModal evenementId={ev.id} nomEvenement={ev.nom} onDone={() => { setImporting(false); load() }} />
      )}
      {viewingPrestations && (
        <StandPrestationsModal stand={viewingPrestations} evenementId={ev.id} onClose={() => setViewingPrestations(null)} />
      )}
    </>
  )
}

const STATUT_LABELS: Record<ControleStatut, string> = {
  conforme: 'Conforme',
  non_conforme: 'Non conforme',
  absent: 'Absent',
  a_verifier: 'À vérifier',
}
const STATUT_COLORS: Record<ControleStatut, string> = {
  conforme: 'var(--success)',
  non_conforme: '#f97316',
  absent: 'var(--danger)',
  a_verifier: 'var(--text-muted)',
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
function PrestationForm({ prest, evenementId, onSaved, onGoToStands }: { prest: Prestation | null; evenementId: string; onSaved: () => void; onGoToStands: () => void }) {
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

  const [standSearch, setStandSearch] = useState(() => {
    if (!prest?.stand_id) return ''
    return '' // sera rempli après chargement
  })

  const [cStatut, setCStatut] = useState<ControleStatut | ''>(prest?.statut_conformite ?? '')
  const [cQte, setCQte] = useState<string>(prest?.quantite_constatee != null ? String(prest.quantite_constatee) : '')
  const [cComment, setCComment] = useState(prest?.commentaire ?? '')
  const [photos, setPhotos] = useState<string[]>([])
  const [newPhotos, setNewPhotos] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [cError, setCError] = useState('')
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
        .then(({ data }) => setPhotos((data ?? []).map(p => p.url!)))
    }
  }, [])

  if (stands.length === 0) {
    return (
      <Modal title="Aucun stand disponible" confirmLabel="Aller aux stands" onClose={onSaved} onConfirm={async () => { onGoToStands(); return true }}>
        <p>Vous devez d'abord ajouter des stands à cet événement.</p>
      </Modal>
    )
  }

  async function save(): Promise<boolean> {
    if (!libelle || !standId) { setError('Le stand et le libellé sont obligatoires.'); return false }
    if (!prestaId) { setError('Un prestataire doit être affecté.'); return false }
    setUploading(true)
    try {
      const { data: { user } } = await sb.auth.getUser()
      const conformitePayload = cStatut ? {
        statut_conformite: cStatut,
        quantite_constatee: cQte !== '' ? parseInt(cQte) : null,
        commentaire: cComment || null,
        controleur_id: user?.id ?? null,
        date_controle: new Date().toISOString(),
      } : {}
      const payload: Record<string, unknown> = {
        stand_id: standId, libelle,
        categorie: categorie || null, quantite_attendue: qte,
        emplacement_prevu: emplacement || null,
        prestataire_id: prestaId || null,
        ajout_sur_site: ajoutSurSite,
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
        }).catch(() => {}) // fire-and-forget, ne bloque pas la sauvegarde
      }
      onSaved(); return true
    } finally {
      setUploading(false)
    }
  }

  async function uploadPendingPhotos(prestationId: string): Promise<string[]> {
    const urls: string[] = []
    for (const file of newPhotos) {
      let compressed: File
      try { compressed = await compressImage(file) }
      catch { compressed = file }
      const path = `${prestationId}/${crypto.randomUUID()}.jpg`
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE as string
      const uploadRes = await fetch(`${supabaseUrl}/storage/v1/object/Photos/${path}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'image/jpeg', 'x-upsert': 'false' },
        body: compressed,
      })
      if (!uploadRes.ok) { const errTxt = await uploadRes.text(); console.error('[upload 400]', errTxt); setCError(`Upload échoué : ${uploadRes.status} — ${errTxt}`); return urls }
      const { data: { publicUrl } } = sbAdmin.storage.from('Photos').getPublicUrl(path)
      const { error: insErr } = await sbAdmin.from('photos').insert({ prestation_id: prestationId, url: publicUrl, synced: true })
      if (insErr) { setCError(`Enregistrement photo échoué : ${insErr.message}`); continue }
      urls.push(publicUrl)
    }
    return urls
  }

  async function deletePhoto(url: string) {
    if (!confirm('Supprimer cette photo ?')) return
    await sbAdmin.from('photos').delete().eq('url', url).eq('prestation_id', prest!.id)
    setPhotos(prev => prev.filter(u => u !== url))
  }

  return (
    <Modal title={prest ? 'Modifier la prestation' : 'Nouvelle prestation'} confirmLabel={uploading ? 'Enregistrement…' : prest ? 'Enregistrer' : 'Créer'} onClose={onSaved} onConfirm={save}>
      <Alert message={error} />
      <div className="form-group" style={{ position: 'relative' }}>
        <label>Stand</label>
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
        {standId && <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 4 }}>✓ Stand sélectionné</div>}
      </div>
      <div className="grid-2">
        <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Libellé</label><input value={libelle} onChange={e => setLibelle(e.target.value)} placeholder="Ex: Mange-debout haut" /></div>
        <div className="form-group"><label>Catégorie</label><input value={categorie} onChange={e => setCategorie(e.target.value)} placeholder="Ex: Mobilier" /></div>
        <div className="form-group"><label>Quantité attendue</label><input type="number" min={1} value={qte} onChange={e => setQte(parseInt(e.target.value) || 1)} /></div>
        <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Emplacement prévu</label><input value={emplacement} onChange={e => setEmplacement(e.target.value)} placeholder="Ex: Fond de stand, côté gauche" /></div>
        <div className="form-group" style={{ gridColumn: '1/-1' }}>
          <label>Prestataire affecté</label>
          <select value={prestaId} onChange={e => setPrestaId(e.target.value)}>
            <option value="">— Non affecté —</option>
            {prestataires.map(p => <option key={p.id} value={p.id}>{p.raison_sociale}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ gridColumn: '1/-1' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={ajoutSurSite} onChange={e => setAjoutSurSite(e.target.checked)} style={{ width: 'auto', margin: 0 }} />
            Ajout sur site à facturer
          </label>
        </div>
      </div>

      <div style={{ marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Conformité</div>
        <Alert message={cError} />
        <div className="grid-2">
          <div className="form-group">
            <label>Statut</label>
            <select value={cStatut} onChange={e => setCStatut(e.target.value as ControleStatut | '')}>
              <option value="">— Non contrôlée —</option>
              {(Object.keys(STATUT_LABELS) as ControleStatut[]).map(s => (
                <option key={s} value={s}>{STATUT_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Quantité constatée</label>
            <input type="number" min={0} value={cQte} onChange={e => setCQte(e.target.value)} placeholder={`Attendue : ${qte}`} />
          </div>
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label>Commentaire / observations</label>
            <input value={cComment} onChange={e => setCComment(e.target.value)} placeholder="Ex: 3 unités présentes, 1 manquante…" />
          </div>
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
              {newPhotos.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  {newPhotos.map((f, i) => (
                    <img key={i} src={URL.createObjectURL(f)} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 6, border: '2px dashed var(--accent)' }} />
                  ))}
                </div>
              )}
              {photos.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  {photos.map((url, i) => (
                    <div key={i} style={{ position: 'relative' }}>
                      <img src={url} alt="" onClick={() => setLightbox(url)} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer' }} />
                      <button onClick={() => deletePhoto(url)} style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: 18, height: 18, fontSize: 10, cursor: 'pointer', lineHeight: 1, padding: 0 }}>✕</button>
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
      <ImportZone
        expectedCols={['numero_stand', 'libelle', 'categorie', 'quantite', 'emplacement', 'raison_sociale_prestataire']}
        onRows={setRows}
      />
    </Modal>
  )
}

// ── Onglet Prestations ────────────────────────────────────────────────────────
function TabPrestations({ ev, onGoToStands }: { ev: Evenement; onGoToStands: () => void }) {
  const [prestations, setPrestations] = useState<Prestation[]>([])
  const [modal, setModal] = useState<Prestation | null | 'new'>(null)
  const [importing, setImporting] = useState(false)
  const [exportFn, setExportFn] = useState<(() => void) | null>(null)

  async function load() {
    const { data: stands } = await sb.from('stands').select('id').eq('evenement_id', ev.id)
    const standIds = (stands ?? []).map(s => s.id)
    if (!standIds.length) { setPrestations([]); return }
    const { data } = await sb.from('prestations')
      .select('*, stands(numero, nom_exposant), prestataires(raison_sociale), users(nom, prenom)')
      .in('stand_id', standIds)
      .order('libelle')
    setPrestations(data ?? [])
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
            emptyState={<div className="empty-state"><div className="empty-icon">▤</div><div>Aucune prestation pour cet événement</div></div>}
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

      {modal !== null && (
        <PrestationForm
          prest={modal === 'new' ? null : modal}
          evenementId={ev.id}
          onSaved={() => { setModal(null); load() }}
          onGoToStands={() => { setModal(null); onGoToStands() }}
        />
      )}
      {importing && <ImportPrestationsModal evenementId={ev.id} onDone={() => { setImporting(false); load() }} />}
    </>
  )
}

type Notify = (msg: string, type?: 'success' | 'error') => void

async function sendInvite(email: string, notify: Notify) {
  if (!email) return
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
  if (error) notify(`Erreur : ${error.message}`, 'error')
  else notify(`Email d'invitation envoyé à ${email}`, 'success')
}

async function impersonate(email: string, notify: Notify) {
  if (!email) return
  const { data, error } = await sbAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: window.location.origin },
  })
  if (error || !data.properties?.action_link) {
    notify(`Erreur : ${error?.message ?? 'lien non généré'}`, 'error')
    return
  }
  await navigator.clipboard.writeText(data.properties.action_link)
  notify('Lien copié — ouvrez-le dans une fenêtre privée (le coller dans la barre d\'adresse)', 'success')
}

// ── Smart add-user-to-event modal ─────────────────────────────────────────────
type AddStep = 'email' | 'found' | 'new'

function AddUserToEventModal({ evenementId, forcedRole, forcedPrestaId, onClose }: { evenementId: string; forcedRole: RoleLocal; forcedPrestaId?: string; onClose: () => void }) {
  const [step, setStep] = useState<AddStep>('email')
  const [email, setEmail] = useState('')
  const [existingUser, setExistingUser] = useState<User | null>(null)
  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
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
      if (data) { setExistingUser(data); setStep('found') }
      else { setStep('new') }
      return false
    }

    let userId: string
    if (step === 'found' && existingUser) {
      userId = existingUser.id
    } else {
      if (!prenom || !nom) { setError('Prénom et nom sont obligatoires.'); return false }
      const { data, error: createError } = await sbAdmin.auth.admin.createUser({
        email: normalizeEmail(email), email_confirm: true,
        password: crypto.randomUUID(),
        user_metadata: { prenom, nom },
      })
      if (createError) { setError(createError.message); return false }
      await sbAdmin.from('users').update({ prenom, nom, is_admin: false }).eq('id', data.user.id)
      userId = data.user.id
    }

    const { error: accesError } = await sb.from('user_evenements').upsert(
      { user_id: userId, evenement_id: evenementId, role_local: forcedRole, prestataire_id: forcedRole === 'prestataire' ? prestaId : null },
      { onConflict: 'user_id,evenement_id' }
    )
    if (accesError) { setError(accesError.message); return false }
    onClose(); return true
  }

  const confirmLabel = step === 'email' ? 'Vérifier' : step === 'found' ? "Ajouter" : 'Créer et ajouter'

  const PrestaField = () => forcedRole === 'prestataire' && !forcedPrestaId ? (
    <div className="form-group">
      <label>Société prestataire</label>
      <select value={prestaId} onChange={e => setPrestaId(e.target.value)}>
        {prestataires.map(p => <option key={p.id} value={p.id}>{p.raison_sociale}</option>)}
      </select>
    </div>
  ) : null

  const title = forcedRole === 'prestataire' ? 'Ajouter un utilisateur prestataire' : 'Ajouter un utilisateur'

  return (
    <Modal title={title} confirmLabel={confirmLabel} onClose={onClose} onConfirm={confirm}>
      <Alert message={error} />
      {step === 'email' && (
        <div className="form-group">
          <label>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} onBlur={() => setEmail(normalizeEmail(email))} autoFocus />
        </div>
      )}
      {step === 'found' && existingUser && (
        <>
          <div className="form-group">
            <label>Compte existant</label>
            <div style={{ padding: '8px 12px', background: 'var(--surface-alt)', borderRadius: 6, fontWeight: 600 }}>
              {existingUser.prenom} {existingUser.nom} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({existingUser.email})</span>
            </div>
          </div>
          <PrestaField />
        </>
      )}
      {step === 'new' && (
        <>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} disabled />
          </div>
          <div className="grid-2">
            <div className="form-group"><label>Prénom</label><input value={prenom} onChange={e => setPrenom(e.target.value)} onBlur={() => setPrenom(normalizePrenom(prenom))} autoFocus /></div>
            <div className="form-group"><label>Nom</label><input value={nom} onChange={e => setNom(e.target.value)} onBlur={() => setNom(normalizeNom(nom))} /></div>
          </div>
          <div className="text-muted" style={{ fontSize: 12, marginBottom: 8 }}>
            Un email d'invitation sera envoyé pour que l'utilisateur définisse son mot de passe.
          </div>
          <PrestaField />
        </>
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
  const emptyMsg = isPresta ? 'Aucun utilisateur prestataire sur cet événement.' : 'Aucun utilisateur sur cet événement.'

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
            emptyState={<div className="empty-state">{emptyMsg}</div>}
            columns={[
              { key: 'utilisateur', label: 'Utilisateur', sortable: true, filterable: true, getValue: a => `${a.users?.prenom} ${a.users?.nom}`, render: a => <span style={{ fontWeight: 600 }}>{a.users?.prenom} {a.users?.nom}</span> },
              { key: 'email', label: 'Email', sortable: true, filterable: true, getValue: a => a.users?.email ?? '' },
              ...(isPresta ? [{ key: 'prestataire', label: 'Société', sortable: true, filterable: true, getValue: (a: UserEvenement) => a.prestataires?.raison_sociale ?? '' }] : []),
              { key: 'actions', label: '', render: (a: UserEvenement) => (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); sendInvite(a.users?.email ?? '', notify) }}>Invitation</button>
                  <button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); impersonate(a.users?.email ?? '', notify) }}>Voir en tant que</button>
                  <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); revoke(a.id) }}>Révoquer</button>
                </div>
              )},
            ]}
          />
        </div>
      </div>

      {showModal && (
        <AddUserToEventModal evenementId={ev.id} forcedRole={roleFilter} onClose={() => { setShowModal(false); load() }} />
      )}
      {editing && (
        <EditAccesModal acces={editing} onClose={() => { setEditing(null); load() }} />
      )}
      {toastEl}
    </>
  )
}

function TabUtilisateurs({ ev }: { ev: Evenement }) {
  return <UserAccesList ev={ev} roleFilter="organisateur" />
}

// ── Détail prestataire (modal avec membres) ───────────────────────────────────
function PrestataireDetailModal({ prestataire, evenementId, onClose }: { prestataire: Prestataire; evenementId: string; onClose: () => void }) {
  const [nom, setNom] = useState(prestataire.raison_sociale)
  const [email, setEmail] = useState(prestataire.email_contact ?? '')
  const [tel, setTel] = useState(prestataire.telephone ?? '')
  const [membres, setMembres] = useState<UserEvenement[]>([])
  const [addModal, setAddModal] = useState(false)
  const [editingMembre, setEditingMembre] = useState<UserEvenement | null>(null)
  const [infoError, setInfoError] = useState('')
  const { notify, toastEl } = useToast()

  async function loadMembres() {
    const { data } = await sb.from('user_evenements')
      .select('*, users(nom, prenom, email)')
      .eq('evenement_id', evenementId)
      .eq('prestataire_id', prestataire.id)
    setMembres(data ?? [])
  }

  useEffect(() => { loadMembres() }, [])

  async function saveInfo(): Promise<boolean> {
    if (!nom) { setInfoError('La raison sociale est obligatoire.'); return false }
    const { error } = await sb.from('prestataires')
      .update({ raison_sociale: nom, email_contact: email || null, telephone: tel || null })
      .eq('id', prestataire.id)
    if (error) { setInfoError(error.message); return false }
    onClose(); return true
  }

  async function revokeMembre(id: string) {
    if (!confirm('Retirer ce membre ?')) return
    const { error } = await sb.from('user_evenements').delete().eq('id', id)
    if (error) { notify(error.message, 'error'); return }
    await loadMembres()
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
        footer={
          <button className="btn btn-danger btn-sm" style={{ marginRight: 'auto' }} onClick={retirerDeLEvenement}>
            Retirer de l'événement
          </button>
        }
      >
        <Alert message={infoError} />
        <div className="form-group"><label>Raison sociale</label><input value={nom} onChange={e => setNom(e.target.value)} /></div>
        <div className="grid-2">
          <div className="form-group"><label>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
          <div className="form-group"><label>Téléphone</label><input value={tel} onChange={e => setTel(e.target.value)} /></div>
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
                        <button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); impersonate(m.users?.email ?? '', notify) }}>Voir en tant que</button>
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

      {addModal && (
        <AddUserToEventModal
          evenementId={evenementId}
          forcedRole="prestataire"
          forcedPrestaId={prestataire.id}
          onClose={() => { setAddModal(false); loadMembres() }}
        />
      )}
      {editingMembre && (
        <EditMembreModal
          membre={editingMembre}
          onClose={() => { setEditingMembre(null); loadMembres() }}
        />
      )}
      {toastEl}
    </>
  )
}

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
      <div className="form-group">
        <label>Email</label>
        <input value={membre.users?.email ?? ''} disabled />
      </div>
    </Modal>
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

      {selected && (
        <PrestataireDetailModal
          prestataire={selected}
          evenementId={ev.id}
          onClose={() => { setSelected(null); load() }}
        />
      )}
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

// ── Page principale FicheEvenement ────────────────────────────────────────────
type Tab = 'details' | 'stands' | 'prestations' | 'prestataires' | 'utilisateurs'

export function FicheEvenementPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [ev, setEv] = useState<Evenement | null>(null)
  const [tab, setTab] = useState<Tab>('details')
  const [editing, setEditing] = useState(false)

  async function load() {
    if (!id) { navigate('/evenements'); return }
    const { data } = await sb.from('evenements').select('*').eq('id', id).single()
    setEv(data ?? null)
  }

  useEffect(() => { load() }, [id])

  if (!ev) return <div className="empty-state">Chargement…</div>

  return (
    <>
      <div className="page-header">
        <a href="#" className="back-link" onClick={e => { e.preventDefault(); navigate('/evenements') }}>← Tous les événements</a>
        <div className="flex items-center justify-between mt-4">
          <div>
            <div className="page-title">{ev.nom}</div>
            <div className="page-subtitle">
              {ev.lieu ?? '—'} · {fmtDate(ev.date_debut)} → {fmtDate(ev.date_fin)} · <Badge statut={ev.statut} />
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>Modifier les informations</button>
        </div>
      </div>

      <div className="tabs">
        {(['details', 'stands', 'prestations', 'prestataires', 'utilisateurs'] as Tab[]).map(t => (
          <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {{ details: 'Détails', stands: 'Stands', prestations: 'Prestations', prestataires: 'Prestataires', utilisateurs: 'Utilisateurs' }[t]}
          </button>
        ))}
      </div>

      {tab === 'details' && <TabDetails ev={ev} />}
      {tab === 'stands' && <TabStands ev={ev} />}
      {tab === 'prestations' && <TabPrestations ev={ev} onGoToStands={() => setTab('stands')} />}
      {tab === 'prestataires' && <TabPrestataires ev={ev} />}
      {tab === 'utilisateurs' && <TabUtilisateurs ev={ev} />}

      {editing && <EvenementForm ev={ev} onSaved={() => { setEditing(false); load() }} />}
    </>
  )
}
