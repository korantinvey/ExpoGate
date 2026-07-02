import { useEffect, useState } from 'react'
import { sb } from '../../lib/supabase'
import { db, getPendingStandIds } from '../../lib/db'
import { SyncDot } from '../../components/ui/SyncDot'
import { ImportButton } from '../../components/ui/ImportButton'
import { DataTable } from '../../components/ui/DataTable'
import { ExportButton } from '../../components/ui/ExportButton'
import { useToast } from '../../components/ui/Toast'
import type { Evenement, Stand } from '../../types'
import { categoriserStand, type StandAvecStatut, type BulkStandField } from './helpers'
import { StandForm } from './StandForm'
import { ImportStandsModal } from './ImportStandsModal'
import { StandPrestationsModal } from './StandPrestationsModalAdmin'

export function TabStands({ ev }: { ev: Evenement }) {
  const [stands, setStands] = useState<StandAvecStatut[]>([])
  const [modal, setModal] = useState<Stand | null | 'new'>(null)
  const [viewingPrestations, setViewingPrestations] = useState<Stand | null>(null)
  const [importing, setImporting] = useState(false)
  const [exportFn, setExportFn] = useState<(() => void) | null>(null)
  const [sousOnglet, setSousOnglet] = useState<'a_valider' | 'valide' | 'tous'>('a_valider')
  const [pendingStandIds, setPendingStandIds] = useState<Set<string>>(new Set())
  const [selectedStandIds, setSelectedStandIds] = useState<Set<string>>(new Set())
  const [filteredStands, setFilteredStands] = useState<StandAvecStatut[]>([])
  const [bulkField, setBulkField] = useState<BulkStandField>('hall')
  const [bulkValue, setBulkValue] = useState('')
  const [bulkApplying, setBulkApplying] = useState(false)
  const { notify: bulkNotify } = useToast()

  async function load() {
    const localStands = await db.stands.where('evenement_id').equals(ev.id).toArray()
    if (localStands.length) {
      const localPrests = await db.prestations.where('stand_id').anyOf(localStands.map(s => s.id)).toArray()
      const localPrestsByStand: Record<string, { statut_conformite: string | null }[]> = {}
      for (const p of localPrests) {
        if (!localPrestsByStand[p.stand_id]) localPrestsByStand[p.stand_id] = []
        localPrestsByStand[p.stand_id].push(p)
      }
      setPendingStandIds(new Set(localPrests.filter(p => p.pending_sync === 1).map(p => p.stand_id)))
      setStands(localStands.sort((a, b) => a.numero.localeCompare(b.numero, 'fr', { numeric: true })).map(s => categoriserStand(s as unknown as Stand, localPrestsByStand)))
    }
    try {
      const { data: standsData, error } = await sb.from('stands').select('*').eq('evenement_id', ev.id).eq('deleted', false).order('numero')
      if (error || !standsData) return
      const standIds = standsData.map(s => s.id)
      const prestationsParStand: Record<string, { statut_conformite: string | null }[]> = {}
      if (standIds.length > 0) {
        const [{ data: p }, pendingIds] = await Promise.all([
          sb.from('prestations').select('stand_id, statut_conformite').in('stand_id', standIds).eq('deleted', false),
          getPendingStandIds(standIds),
        ])
        for (const row of p ?? []) {
          if (!prestationsParStand[row.stand_id]) prestationsParStand[row.stand_id] = []
          prestationsParStand[row.stand_id].push(row)
        }
        setPendingStandIds(pendingIds)
      }
      setStands(standsData.map(s => categoriserStand(s, prestationsParStand)))
    } catch { /* données locales déjà affichées */ }
  }

  useEffect(() => { load() }, [])

  const standsFiltrés = sousOnglet === 'tous' ? stands
    : sousOnglet === 'valide' ? stands.filter(s => s._statut === 'valide')
    : stands.filter(s => s._statut === 'a_valider' || s._statut === 'sans_prestation')

  const bulkStandIds = selectedStandIds.size > 0 ? selectedStandIds : new Set(filteredStands.map(s => s.id))
  const showBulkStands = selectedStandIds.size > 0 || filteredStands.length < standsFiltrés.length

  async function applyBulkStands() {
    if (!bulkStandIds.size) return
    setBulkApplying(true)
    const patch: Record<string, unknown> = {}
    if (bulkField === 'hall') patch.hall = bulkValue || null
    else if (bulkField === 'nom_exposant') patch.nom_exposant = bulkValue || null
    else if (bulkField === 'surface') patch.surface = bulkValue !== '' ? parseFloat(bulkValue) : null
    else if (bulkField === 'angles') patch.angles = bulkValue !== '' ? parseInt(bulkValue) : null
    const { error } = await sb.from('stands').update(patch).in('id', [...bulkStandIds])
    setBulkApplying(false)
    if (error) { bulkNotify(error.message, 'error'); return }
    bulkNotify(`${bulkStandIds.size} stand${bulkStandIds.size > 1 ? 's' : ''} mis à jour`, 'success')
    setSelectedStandIds(new Set())
    load()
  }

  const nbAValider = stands.filter(s => s._statut === 'a_valider' || s._statut === 'sans_prestation').length
  const nbValides = stands.filter(s => s._statut === 'valide').length

  const columns = [
    { key: 'nom_exposant', label: 'Exposant', sortable: true, filterable: true, render: (s: StandAvecStatut) => (
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <SyncDot pending={pendingStandIds.has(s.id)} />
        <span style={{ fontWeight: 600 }}>{s.nom_exposant}</span>
      </span>
    )},
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
            <ImportButton onClick={() => setImporting(true)} />
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
          {showBulkStands && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', background: 'rgba(29,158,117,0.08)', border: '1px solid var(--accent)', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-dark)', whiteSpace: 'nowrap' }}>
                {selectedStandIds.size > 0
                  ? `${selectedStandIds.size} stand${selectedStandIds.size > 1 ? 's' : ''} sélectionné${selectedStandIds.size > 1 ? 's' : ''}`
                  : `${filteredStands.length} stand${filteredStands.length > 1 ? 's' : ''} filtré${filteredStands.length > 1 ? 's' : ''}`}
              </span>
              <span style={{ color: 'var(--border)' }}>|</span>
              <select value={bulkField} onChange={e => { setBulkField(e.target.value as BulkStandField); setBulkValue('') }}
                style={{ fontSize: 13, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)' }}>
                <option value="hall">Hall / Pavillon</option>
                <option value="nom_exposant">Exposant</option>
                <option value="surface">Surface (m²)</option>
                <option value="angles">Angles</option>
              </select>
              {(bulkField === 'surface' || bulkField === 'angles') ? (
                <input type="number" min={0} value={bulkValue} onChange={e => setBulkValue(e.target.value)} placeholder="Valeur…"
                  style={{ fontSize: 13, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, width: 90 }} />
              ) : (
                <input type="text" value={bulkValue} onChange={e => setBulkValue(e.target.value)} placeholder="Valeur…"
                  style={{ fontSize: 13, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, width: 150 }} />
              )}
              <button className="btn btn-primary btn-sm" onClick={applyBulkStands} disabled={bulkApplying}>
                {bulkApplying ? '…' : 'Appliquer'}
              </button>
              {selectedStandIds.size > 0 && (
                <button className="btn btn-secondary btn-sm" onClick={() => setSelectedStandIds(new Set())}>Désélectionner</button>
              )}
            </div>
          )}
          <DataTable
            data={standsFiltrés}
            exportFilename={`stands-${ev.nom}-${sousOnglet}`}
            onExportReady={fn => setExportFn(() => fn)}
            onRowClick={s => setModal(s)}
            selectable
            selectedIds={selectedStandIds}
            onSelectionChange={setSelectedStandIds}
            onFilteredRowsChange={rows => setFilteredStands(rows as StandAvecStatut[])}
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
