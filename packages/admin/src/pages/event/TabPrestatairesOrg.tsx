import { useEffect, useState } from 'react'
import { sb } from '../../lib/supabase'
import { Modal } from '../../components/ui/Modal'
import { Alert } from '../../components/ui/Alert'
import { DataTable } from '../../components/ui/DataTable'
import { ExportButton } from '../../components/ui/ExportButton'
import { useToast } from '../../components/ui/Toast'
import { isValidEmail, normalizeEmail } from '../../lib/normalize'
import type { Evenement, Prestataire } from '../../types'
import { PrestataireDetailModal } from './PrestataireDetailModalOrg'

export function TabPrestataires({ ev }: { ev: Evenement }) {
  const [prestataires, setPrestataires] = useState<Prestataire[]>([])
  const [selected, setSelected] = useState<Prestataire | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const [allGlobal, setAllGlobal] = useState<Prestataire[]>([])
  const [assignId, setAssignId] = useState('')
  const [assignError, setAssignError] = useState('')
  const [exportFn, setExportFn] = useState<(() => void) | null>(null)
  const [newNom, setNewNom] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newTel, setNewTel] = useState('')
  const [newError, setNewError] = useState('')
  const { notify, toastEl } = useToast()

  async function load() {
    const { data: ep } = await sb.from('evenement_prestataires')
      .select('prestataire_id, prestataires(*)')
      .eq('evenement_id', ev.id)
    const list = (ep ?? [])
      .map(r => r.prestataires as unknown as Prestataire)
      .filter(Boolean)
      .sort((a, b) => a.raison_sociale.localeCompare(b.raison_sociale, 'fr'))
    setPrestataires(list)
  }

  useEffect(() => { load() }, [])

  async function create(): Promise<boolean> {
    if (!newNom) { setNewError('La raison sociale est obligatoire.'); return false }
    if (newEmail && !isValidEmail(newEmail)) { setNewError("Format d'email invalide."); return false }
    const { data: newP, error } = await sb.from('prestataires')
      .insert({ raison_sociale: newNom, email_contact: normalizeEmail(newEmail) || null, telephone: newTel || null })
      .select('id').single()
    if (error || !newP) { setNewError(error?.message ?? 'Erreur'); return false }
    const { error: e2 } = await sb.from('evenement_prestataires')
      .insert({ evenement_id: ev.id, prestataire_id: newP.id })
    if (e2) { setNewError(e2.message); return false }
    setNewNom(''); setNewEmail(''); setNewTel('')
    load(); return true
  }

  async function openAssign() {
    const { data } = await sb.from('prestataires').select('*').order('raison_sociale')
    const alreadyIds = new Set(prestataires.map(p => p.id))
    const available = (data ?? []).filter(p => !alreadyIds.has(p.id))
    setAllGlobal(available)
    setAssignId(available[0]?.id ?? '')
    setAssignError('')
    setShowAssign(true)
  }

  async function assign(): Promise<boolean> {
    if (!assignId) { setAssignError('Choisissez un prestataire.'); return false }
    const { error } = await sb.from('evenement_prestataires')
      .insert({ evenement_id: ev.id, prestataire_id: assignId })
    if (error) { setAssignError(error.message); return false }
    load(); return true
  }

  async function retirer(p: Prestataire) {
    if (!confirm(`Retirer "${p.raison_sociale}" de cet événement ?\n\nTous ses membres seront révoqués. Les prestations associées resteront mais sans accès utilisateur.`)) return
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      sb.from('user_evenements').delete().eq('evenement_id', ev.id).eq('prestataire_id', p.id),
      sb.from('evenement_prestataires').delete().eq('evenement_id', ev.id).eq('prestataire_id', p.id),
    ])
    if (e1 || e2) { notify((e1 ?? e2)!.message, 'error'); return }
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
            <button className="btn btn-secondary btn-sm" onClick={openAssign}>Assigner un existant</button>
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
      {showAssign && (
        <Modal title="Assigner un prestataire existant" confirmLabel="Assigner" onClose={() => setShowAssign(false)} onConfirm={assign}>
          <Alert message={assignError} />
          {allGlobal.length === 0
            ? <p className="text-muted">Tous les prestataires sont déjà assignés à cet événement.</p>
            : <div className="form-group">
                <label>Prestataire</label>
                <select value={assignId} onChange={e => setAssignId(e.target.value)}>
                  {allGlobal.map(p => <option key={p.id} value={p.id}>{p.raison_sociale}</option>)}
                </select>
              </div>
          }
        </Modal>
      )}
      {toastEl}
    </>
  )
}
