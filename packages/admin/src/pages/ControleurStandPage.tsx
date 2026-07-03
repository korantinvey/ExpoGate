import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { db, type LocalPrestation } from '../lib/db'
import { syncPending, getPendingCount } from '../lib/sync'
import type { ControleStatut } from '../types'

// ── Constantes ────────────────────────────────────────────────────────────────

const STATUTS: { value: ControleStatut; label: string; color: string; bg: string }[] = [
  { value: 'conforme',      label: 'Conforme',      color: '#16a34a', bg: '#dcfce7' },
  { value: 'non_conforme',  label: 'Non conforme',  color: '#ea580c', bg: '#ffedd5' },
  { value: 'absent',        label: 'Absent',        color: '#dc2626', bg: '#fee2e2' },
  { value: 'a_verifier',    label: 'À vérifier',    color: '#6b7280', bg: '#f3f4f6' },
]

function statutStyle(s: ControleStatut | null) {
  const found = STATUTS.find(x => x.value === s)
  return found ?? null
}

// ── Formulaire inline pour une prestation ────────────────────────────────────

interface ControlFormProps {
  prest: LocalPrestation
  userId: string
  onSaved: () => void
  onCancel: () => void
}

function ControlForm({ prest, userId, onSaved, onCancel }: ControlFormProps) {
  const [statut, setStatut] = useState<ControleStatut | ''>(prest.statut_conformite ?? '')
  const [qte, setQte] = useState(prest.quantite_constatee != null ? String(prest.quantite_constatee) : '')
  const [comment, setComment] = useState(prest.commentaire ?? '')
  const [newPhotos, setNewPhotos] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  // Génère les URLs de prévisualisation blob (state pour déclencher le re-render)
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  useEffect(() => {
    const urls = newPhotos.map(f => URL.createObjectURL(f))
    setPreviewUrls(urls)
    return () => { urls.forEach(u => URL.revokeObjectURL(u)) }
  }, [newPhotos])

  useEffect(() => {
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  function addPhotos(files: FileList | null) {
    if (!files) return
    setNewPhotos(prev => [...prev, ...Array.from(files)])
  }

  function removePhoto(index: number) {
    setNewPhotos(prev => prev.filter((_, i) => i !== index))
  }

  async function save() {
    setSaving(true)
    try {
      const now = new Date().toISOString()
      const prevStatut = prest.statut_conformite
      const newStatut: ControleStatut | null = statut || null
      const isAnomalie = (s: ControleStatut | null) => s === 'non_conforme' || s === 'absent'

      const updates: Record<string, unknown> = {
        statut_conformite: newStatut,
        quantite_constatee: qte !== '' ? parseInt(qte) : null,
        commentaire: comment || null,
        controleur_id: userId,
        date_controle: now,
        pending_sync: 1,
      }

      if (isAnomalie(newStatut)) {
        if (!prest.anomalie) updates.anomalie = true
        if (!prest.date_anomalie) updates.date_anomalie = now
      }

      if (newStatut === 'a_verifier' && isAnomalie(prevStatut) && !prest.date_retour_a_verifier) {
        updates.date_retour_a_verifier = now
      }

      await db.prestations.update(prest.id, updates)
      // Stocker les photos en local
      for (const file of newPhotos) {
        await db.photos.add({
          prestation_id: prest.id,
          blob: file,
          created_at: now,
          synced: 0,
          remote_url: null,
        })
      }
      // Sync immédiate si connecté
      if (isOnline) {
        try { await syncPending() } catch { /* sera retenté plus tard */ }
      }
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="ctrl-form">
      {/* Statuts */}
      <div className="ctrl-statut-grid">
        {STATUTS.map(s => (
          <button
            key={s.value}
            className={`ctrl-statut-btn${statut === s.value ? ' active' : ''}`}
            style={{
              '--btn-color': s.color,
              '--btn-bg': s.bg,
            } as React.CSSProperties}
            onClick={() => setStatut(s.value)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Quantité */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginTop: 14 }}>
        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
          <label>Quantité constatée <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(attendue : {prest.quantite_attendue})</span></label>
          <input
            type="number"
            min={0}
            value={qte}
            onChange={e => setQte(e.target.value)}
            placeholder={String(prest.quantite_attendue)}
          />
        </div>
      </div>

      {/* Commentaire */}
      <div className="form-group" style={{ marginTop: 12, marginBottom: 0 }}>
        <label>Commentaire / observations</label>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Ex : 2 unités présentes, 1 manquante…"
          rows={2}
          style={{ resize: 'none' }}
        />
      </div>

      {/* Photos */}
      <div style={{ marginTop: 12 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Photos</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Prévisualisation des nouvelles photos */}
          {newPhotos.map((_, i) => (
            <div key={i} style={{ position: 'relative', width: 72, height: 72 }}>
              <img
                src={previewUrls[i]}
                alt=""
                style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '2px dashed var(--accent)' }}
              />
              <button
                onClick={() => removePhoto(i)}
                style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, border: 'none', borderRadius: '50%', background: 'var(--danger)', color: '#fff', fontSize: 12, cursor: 'pointer', padding: 0, lineHeight: 1 }}
              >✕</button>
            </div>
          ))}
          {/* Boutons d'ajout photo — version mobile (caméra + galerie séparés) */}
          <div className="photo-input-mobile" style={{ display: 'flex', gap: 8 }}>
            <label style={{ cursor: 'pointer' }}>
              <span className="btn btn-secondary btn-sm">📷</span>
              <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => addPhotos(e.target.files)} />
            </label>
            <label style={{ cursor: 'pointer' }}>
              <span className="btn btn-secondary btn-sm">🖼</span>
              <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => addPhotos(e.target.files)} />
            </label>
          </div>
          {/* Version desktop */}
          <label className="photo-input-desktop" style={{ cursor: 'pointer' }}>
            <span className="btn btn-secondary btn-sm">+ Photo</span>
            <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => addPhotos(e.target.files)} />
          </label>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button className="btn btn-secondary btn-sm" onClick={onCancel}>Annuler</button>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={save} disabled={saving}>
          {saving ? 'Enregistrement…' : isOnline ? 'Enregistrer' : '💾 Enregistrer hors ligne'}
        </button>
      </div>

      {!isOnline && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
          Sera synchronisé automatiquement au retour du réseau.
        </div>
      )}
    </div>
  )
}

// ── Card prestation ───────────────────────────────────────────────────────────

function PrestationCard({
  prest,
  expanded,
  onExpand,
  userId,
  onSaved,
}: {
  prest: LocalPrestation
  expanded: boolean
  onExpand: () => void
  userId: string
  onSaved: () => void
}) {
  const st = statutStyle(prest.statut_conformite)

  return (
    <div className={`ctrl-prest-card${expanded ? ' expanded' : ''}`}>
      <div className="ctrl-prest-header" onClick={expanded ? onSaved : onExpand}>
        <div className="ctrl-prest-info">
          <div className="ctrl-prest-libelle">{prest.libelle}</div>
          {(prest.categorie || prest.emplacement_prevu) && (
            <div className="ctrl-prest-meta">
              {prest.categorie && <span>{prest.categorie}</span>}
              {prest.emplacement_prevu && <span>{prest.emplacement_prevu}</span>}
              <span>qté {prest.quantite_attendue}</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {st && (
            <span style={{ fontSize: 11, fontWeight: 600, color: st.color, background: st.bg, padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>
              {st.label}
            </span>
          )}
          <span
            title={prest.pending_sync === 1 ? 'En attente de synchronisation' : 'Synchronisé'}
            style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: prest.pending_sync === 1 ? '#f97316' : '#22c55e', display: 'inline-block' }}
          />
          <span style={{ color: 'var(--text-muted)', fontSize: 18, lineHeight: 1, transform: expanded ? 'rotate(90deg)' : undefined, transition: 'transform 0.2s' }}>›</span>
        </div>
      </div>

      {expanded && (
        <ControlForm
          prest={prest}
          userId={userId}
          onSaved={onSaved}
          onCancel={onSaved}
        />
      )}
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────

export function ControleurStandPage() {
  const { eventId, standId } = useParams<{ eventId: string; standId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [standNumero, setStandNumero] = useState('')
  const [standExposant, setStandExposant] = useState<string | null>(null)
  const [prestations, setPrestations] = useState<LocalPrestation[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [pending, setPending] = useState(0)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [syncing, setSyncing] = useState(false)

  const loadData = useCallback(async () => {
    if (!standId) return
    const [stand, prests] = await Promise.all([
      db.stands.get(standId),
      db.prestations.where('stand_id').equals(standId).toArray(),
    ])
    if (stand) {
      setStandNumero(stand.numero)
      setStandExposant(stand.nom_exposant)
    }
    setPrestations(prests.sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr')))
    setPending(await getPendingCount())
  }, [standId])

  useEffect(() => {
    const init = async () => {
      if (navigator.onLine) {
        setSyncing(true)
        try { await syncPending() } finally { setSyncing(false) }
      }
      await loadData()
    }
    init()
    const on = () => { setIsOnline(true); triggerSync() }
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [standId, loadData])

  async function triggerSync() {
    if (!navigator.onLine || syncing) return
    setSyncing(true)
    try { await syncPending(); await loadData() } finally { setSyncing(false) }
  }

  const done = prestations.filter(p => p.statut_conformite !== null).length
  const issues = prestations.filter(p => p.statut_conformite === 'non_conforme' || p.statut_conformite === 'absent').length
  const pct = prestations.length ? Math.round((done / prestations.length) * 100) : 0

  return (
    <div className="ctrl-shell">
      <div className="ctrl-header">
        <button className="ctrl-back" onClick={() => navigate(`/controleur/${eventId}`)}>←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ctrl-title" style={{ fontSize: 16 }}>Stand {standNumero}</div>
          {standExposant && <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{standExposant}</div>}
        </div>
        <div>
          {syncing ? (
            <span style={{ fontSize: 12, color: 'var(--accent)' }}>⟳</span>
          ) : pending > 0 ? (
            <button
              onClick={triggerSync}
              disabled={!isOnline}
              style={{ background: 'none', border: 'none', fontSize: 12, cursor: isOnline ? 'pointer' : 'default', color: isOnline ? 'var(--accent)' : 'var(--text-muted)' }}
            >
              {isOnline ? `↑ ${pending}` : `📵 ${pending}`}
            </button>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--success)' }}>✓</span>
          )}
        </div>
      </div>

      <div className="ctrl-content">
        {/* Barre de progression stand */}
        {prestations.length > 0 && (
          <div style={{ padding: '10px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {done}/{prestations.length} contrôlée{done > 1 ? 's' : ''}
                {issues > 0 && <span style={{ color: '#f97316', marginLeft: 8 }}>· ⚠ {issues} problème{issues > 1 ? 's' : ''}</span>}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: pct === 100 ? 'var(--success)' : 'var(--text)' }}>{pct}%</span>
            </div>
            <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: issues > 0 ? '#f97316' : pct === 100 ? 'var(--success)' : 'var(--accent)', width: `${pct}%`, borderRadius: 2, transition: 'width 0.3s' }} />
            </div>
          </div>
        )}

        {/* Liste des prestations */}
        {prestations.length === 0 ? (
          <div className="empty-state">Aucune prestation sur ce stand.</div>
        ) : (
          <div className="ctrl-prest-list">
            {prestations.map(p => (
              <PrestationCard
                key={p.id}
                prest={p}
                expanded={expandedId === p.id}
                onExpand={() => setExpandedId(p.id)}
                userId={user?.id ?? ''}
                onSaved={() => { setExpandedId(null); loadData() }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
