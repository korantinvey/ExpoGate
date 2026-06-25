import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { sb } from '../lib/supabase'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { Alert } from '../components/ui/Alert'
import { DataTable } from '../components/ui/DataTable'
import { ExportButton } from '../components/ui/ExportButton'
import { DateInput } from '../components/ui/DateInput'
import { fmtDate } from '../lib/format'
import type { Evenement, EvenementStatut } from '../types'

function EvenementForm({ ev, onSaved }: { ev: Evenement | null; onSaved: () => void }) {
  const [nom, setNom] = useState(ev?.nom ?? '')
  const [lieu, setLieu] = useState(ev?.lieu ?? '')
  const [debut, setDebut] = useState(ev?.date_debut ?? '')
  const [fin, setFin] = useState(ev?.date_fin ?? '')
  const [statut, setStatut] = useState<EvenementStatut>(ev?.statut ?? 'parametrage')
  const [error, setError] = useState('')

  async function save(): Promise<boolean> {
    if (!nom || !debut || !fin) { setError('Nom et dates sont obligatoires.'); return false }
    const payload = { nom, lieu: lieu || null, date_debut: debut, date_fin: fin, statut }
    const { error } = ev
      ? await sb.from('evenements').update(payload).eq('id', ev.id)
      : await sb.from('evenements').insert(payload)
    if (error) { setError(error.message); return false }
    onSaved()
    return true
  }

  return (
    <Modal
      title={ev ? 'Modifier l\'événement' : 'Nouvel événement'}
      confirmLabel={ev ? 'Enregistrer' : 'Créer'}
      onClose={onSaved}
      onConfirm={save}
    >
      <Alert message={error} />
      <div className="grid-2">
        <div className="form-group" style={{ gridColumn: '1/-1' }}>
          <label>Nom de l'événement</label>
          <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Ex: Salon du Meuble Paris 2025" />
        </div>
        <div className="form-group">
          <label>Date de début</label>
          <DateInput value={debut} onChange={setDebut} />
        </div>
        <div className="form-group">
          <label>Date de fin</label>
          <DateInput value={fin} onChange={setFin} defaultMonth={debut} />
        </div>
        <div className="form-group" style={{ gridColumn: '1/-1' }}>
          <label>Lieu</label>
          <input value={lieu} onChange={e => setLieu(e.target.value)} placeholder="Ex: Paris Expo Porte de Versailles" />
        </div>
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

export function EvenementsPage() {
  const navigate = useNavigate()
  const [events, setEvents] = useState<Evenement[]>([])
  const [filter, setFilter] = useState('')
  const [modal, setModal] = useState<Evenement | null | 'new'>(null)
  const [exportFn, setExportFn] = useState<(() => void) | null>(null)

  async function load() {
    let q = sb.from('evenements').select('*').order('date_debut', { ascending: false })
    if (filter) q = q.eq('statut', filter)
    const { data } = await q
    setEvents(data ?? [])
  }

  useEffect(() => { load() }, [filter])

  return (
    <>
      <div className="page-header">
        <div className="page-title">Événements</div>
        <div className="page-subtitle">Créer et gérer les salons</div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">{events.length} événement{events.length > 1 ? 's' : ''}</div>
          <div className="flex gap-2">
            <select value={filter} onChange={e => setFilter(e.target.value)} style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }}>
              <option value="">Tous les statuts</option>
              <option value="parametrage">Paramétrage</option>
              <option value="actif">Actif</option>
              <option value="termine">Terminé</option>
            </select>
            <ExportButton onClick={exportFn} />
            <button className="btn btn-primary btn-sm" onClick={() => setModal('new')}>+ Nouvel événement</button>
          </div>
        </div>
        <div className="card-body">
          <DataTable
            data={events}
            exportFilename="evenements"
            onExportReady={fn => setExportFn(() => fn)}
            onRowClick={e => navigate(`/evenements/${e.id}`)}
            emptyState={
              <div className="empty-state">
                <div className="empty-icon">◈</div>
                <div>Aucun événement trouvé</div>
                <div className="mt-4"><button className="btn btn-primary" onClick={() => setModal('new')}>Créer un événement</button></div>
              </div>
            }
            columns={[
              { key: 'nom', label: 'Nom', sortable: true, filterable: true, render: e => <span style={{ fontWeight: 600 }}>{e.nom}</span> },
              { key: 'lieu', label: 'Lieu', sortable: true, filterable: true, hideOnMobile: true },
              { key: 'dates', label: 'Dates', hideOnMobile: true, getValue: e => `${e.date_debut} ${e.date_fin}`, render: e => `${fmtDate(e.date_debut)} → ${fmtDate(e.date_fin)}` },
              { key: 'statut', label: 'Statut', sortable: true, filterable: true, options: [{ value: 'parametrage', label: 'Paramétrage' }, { value: 'actif', label: 'Actif' }, { value: 'termine', label: 'Terminé' }], render: e => <Badge statut={e.statut} /> },
            ]}
          />
        </div>
      </div>

      {modal !== null && (
        <EvenementForm
          ev={modal === 'new' ? null : modal}
          onSaved={() => { setModal(null); load() }}
        />
      )}
    </>
  )
}
