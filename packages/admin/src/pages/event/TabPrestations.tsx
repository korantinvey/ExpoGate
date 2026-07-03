import { useEffect, useState } from 'react'
import { sb } from '../../lib/supabase'
import { db, getPendingPrestaIds } from '../../lib/db'
import { SyncDot } from '../../components/ui/SyncDot'
import { ImportButton } from '../../components/ui/ImportButton'
import { DataTable } from '../../components/ui/DataTable'
import { ExportButton } from '../../components/ui/ExportButton'
import { useToast } from '../../components/ui/Toast'
import type { Evenement, Prestation, Prestataire } from '../../types'
import { STATUT_LABELS, STATUT_COLORS, conformiteBg, type BulkPrestaField } from './helpers'
import { PrestationForm } from './PrestationForm'
import { ImportPrestationsModal } from './ImportPrestationsModal'

export function TabPrestations({ ev, onGoToStands }: { ev: Evenement; onGoToStands: () => void }) {
  const [prestations, setPrestations] = useState<Prestation[]>([])
  const [modal, setModal] = useState<Prestation | null | 'new'>(null)
  const [importing, setImporting] = useState(false)
  const [exportFn, setExportFn] = useState<(() => void) | null>(null)
  const [pendingSyncIds, setPendingSyncIds] = useState<Set<string>>(new Set())
  const [selectedPrestaIds, setSelectedPrestaIds] = useState<Set<string>>(new Set())
  const [bulkPrestaField, setBulkPrestaField] = useState<BulkPrestaField>('prestataire_id')
  const [bulkPrestaValue, setBulkPrestaValue] = useState('')
  const [bulkPrestaApplying, setBulkPrestaApplying] = useState(false)
  const [filteredPrestations, setFilteredPrestations] = useState<Prestation[]>([])
  const [bulkPrestataires, setBulkPrestataires] = useState<Prestataire[]>([])
  const { notify: bulkNotify } = useToast()

  async function load() {
    const localStands = await db.stands.where('evenement_id').equals(ev.id).toArray()
    if (localStands.length) {
      const standMap = Object.fromEntries(localStands.map(s => [s.id, s]))
      const localPrests = await db.prestations.where('stand_id').anyOf(localStands.map(s => s.id)).toArray()
      setPendingSyncIds(await getPendingPrestaIds(localPrests.map(p => p.id)))
      setPrestations(localPrests.map(p => ({
        ...p,
        stands: standMap[p.stand_id] ?? null,
        prestataires: null,
        users: null,
      })) as unknown as Prestation[])
    }
    try {
      const { data: stands, error: standsErr } = await sb.from('stands').select('id').eq('evenement_id', ev.id).eq('deleted', false)
      if (standsErr) throw standsErr
      const standIds = (stands ?? []).map(s => s.id)
      if (!standIds.length) { setPrestations([]); return }
      const { data, error } = await sb.from('prestations')
        .select('*, stands(numero, nom_exposant), prestataires(raison_sociale), users(nom, prenom)')
        .in('stand_id', standIds)
        .eq('deleted', false)
        .order('libelle')
      if (!error && data) {
        setPrestations(data)
        setPendingSyncIds(await getPendingPrestaIds(data.map(p => p.id)))
      }
    } catch { /* données locales déjà affichées */ }
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    db.prestataires.orderBy('raison_sociale').toArray().then(local => { if (local.length) setBulkPrestataires(local as unknown as Prestataire[]) })
    sb.from('prestataires').select('id, raison_sociale, email_contact, telephone, created_at').order('raison_sociale')
      .then(({ data }) => {
        if (!data?.length) return
        setBulkPrestataires(data as unknown as Prestataire[])
        db.prestataires.bulkPut(data.map(({ id, raison_sociale, email_contact, telephone }) => ({ id, raison_sociale, email_contact, telephone }))).catch(() => {})
      })
  }, [])

  async function applyBulkPrestations() {
    setBulkPrestaApplying(true)
    const bulkIds = selectedPrestaIds.size > 0 ? selectedPrestaIds : new Set(filteredPrestations.map(p => p.id))
    if (!bulkIds.size) { setBulkPrestaApplying(false); return }
    const patch: Record<string, unknown> = {}
    if (bulkPrestaField === 'prestataire_id') patch.prestataire_id = bulkPrestaValue || null
    else if (bulkPrestaField === 'categorie') patch.categorie = bulkPrestaValue || null
    else if (bulkPrestaField === 'emplacement_prevu') patch.emplacement_prevu = bulkPrestaValue || null
    else if (bulkPrestaField === 'ajout_sur_site') patch.ajout_sur_site = bulkPrestaValue === 'true'
    const { error } = await sb.from('prestations').update(patch).in('id', [...bulkIds])
    setBulkPrestaApplying(false)
    if (error) { bulkNotify(error.message, 'error'); return }
    bulkNotify(`${bulkIds.size} prestation${bulkIds.size > 1 ? 's' : ''} mise${bulkIds.size > 1 ? 's' : ''} à jour`, 'success')
    setSelectedPrestaIds(new Set())
    load()
  }

  const showBulkPrestas = selectedPrestaIds.size > 0 || filteredPrestations.length < prestations.length

  return (
    <>
      <div className="card">
        <div className="card-header">
          <div className="card-title">{prestations.length} prestation{prestations.length > 1 ? 's' : ''}</div>
          <div className="flex gap-2">
            <ExportButton onClick={exportFn} />
            <ImportButton onClick={() => setImporting(true)} />
            <button className="btn btn-primary btn-sm" onClick={() => setModal('new')}>+ Prestation</button>
          </div>
        </div>
        <div className="card-body">
          {showBulkPrestas && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', background: 'rgba(29,158,117,0.08)', border: '1px solid var(--accent)', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-dark)', whiteSpace: 'nowrap' }}>
                {selectedPrestaIds.size > 0
                  ? `${selectedPrestaIds.size} prestation${selectedPrestaIds.size > 1 ? 's' : ''} sélectionné${selectedPrestaIds.size > 1 ? 'es' : 'e'}`
                  : `${filteredPrestations.length} prestation${filteredPrestations.length > 1 ? 's' : ''} filtré${filteredPrestations.length > 1 ? 'es' : 'e'}`}
              </span>
              <span style={{ color: 'var(--border)' }}>|</span>
              <select value={bulkPrestaField} onChange={e => { setBulkPrestaField(e.target.value as BulkPrestaField); setBulkPrestaValue('') }}
                style={{ fontSize: 13, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)' }}>
                <option value="prestataire_id">Prestataire affecté</option>
                <option value="categorie">Catégorie</option>
                <option value="emplacement_prevu">Emplacement prévu</option>
                <option value="ajout_sur_site">Ajout sur site</option>
              </select>
              {bulkPrestaField === 'prestataire_id' && (
                <select value={bulkPrestaValue} onChange={e => setBulkPrestaValue(e.target.value)}
                  style={{ fontSize: 13, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', maxWidth: 200 }}>
                  <option value="">— Aucun prestataire —</option>
                  {bulkPrestataires.map(p => <option key={p.id} value={p.id}>{p.raison_sociale}</option>)}
                </select>
              )}
              {bulkPrestaField === 'ajout_sur_site' && (
                <select value={bulkPrestaValue} onChange={e => setBulkPrestaValue(e.target.value)}
                  style={{ fontSize: 13, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)' }}>
                  <option value="true">Oui (à facturer)</option>
                  <option value="false">Non</option>
                </select>
              )}
              {(bulkPrestaField === 'categorie' || bulkPrestaField === 'emplacement_prevu') && (
                <input type="text" value={bulkPrestaValue} onChange={e => setBulkPrestaValue(e.target.value)} placeholder="Valeur…"
                  style={{ fontSize: 13, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, width: 150 }} />
              )}
              <button className="btn btn-primary btn-sm" onClick={applyBulkPrestations} disabled={bulkPrestaApplying}>
                {bulkPrestaApplying ? '…' : 'Appliquer'}
              </button>
              {selectedPrestaIds.size > 0 && (
                <button className="btn btn-secondary btn-sm" onClick={() => setSelectedPrestaIds(new Set())}>Désélectionner</button>
              )}
            </div>
          )}
          <DataTable
            data={prestations}
            exportFilename={`prestations-${ev.nom}`}
            onExportReady={fn => setExportFn(() => fn)}
            onRowClick={p => setModal(p)}
            rowStyle={p => conformiteBg(p.statut_conformite)}
            selectable
            selectedIds={selectedPrestaIds}
            onSelectionChange={setSelectedPrestaIds}
            onFilteredRowsChange={rows => setFilteredPrestations(rows as Prestation[])}
            emptyState={<div className="empty-state"><div className="empty-icon">▤</div><div>Aucune prestation pour cet événement</div></div>}
            columns={[
              { key: 'stand', label: 'Stand', sortable: true, filterable: true, getValue: p => p.stands?.numero ?? '', render: p => <><strong>{p.stands?.numero}</strong>{p.stands?.nom_exposant ? ` — ${p.stands.nom_exposant}` : ''}</> },
              { key: 'libelle', label: 'Libellé', sortable: true, filterable: true, render: p => (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <SyncDot pending={pendingSyncIds.has(p.id)} />
                  <span style={{ fontWeight: 600 }}>{p.libelle}</span>
                </span>
              )},
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
          canDelete
        />
      )}
      {importing && <ImportPrestationsModal evenementId={ev.id} onDone={() => { setImporting(false); load() }} />}
    </>
  )
}
