import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { sb } from '../lib/supabase'
import { db } from '../lib/db'
import { downloadEvent } from '../lib/sync'
import { Modal } from '../components/ui/Modal'
import { Alert } from '../components/ui/Alert'
import { Badge } from '../components/ui/Badge'
import { DateInput } from '../components/ui/DateInput'
import { fmtDate } from '../lib/format'
import { TabMainCourante } from './TabMainCourante'
import type { Evenement, EvenementStatut } from '../types'
import { TabDashboard } from './event/TabDashboardAdmin'
import { TabStands } from './event/TabStandsAdmin'
import { TabPrestations } from './event/TabPrestationsAdmin'
import { TabPrestataires } from './event/TabPrestatairesAdmin'
import { TabUtilisateurs } from './event/UserAccesListAdmin'
import { TabCorbeille } from './event/TabCorbeilleAdmin'

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

type Tab = 'dashboard' | 'details' | 'stands' | 'prestations' | 'prestataires' | 'utilisateurs' | 'main_courante' | 'corbeille'

export function FicheEvenementPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [ev, setEv] = useState<Evenement | null>(null)
  const [tab, setTab] = useState<Tab>('dashboard')
  const [editing, setEditing] = useState(false)

  async function load() {
    if (!id) { navigate('/evenements'); return }
    try {
      const { data, error } = await sb.from('evenements').select('*').eq('id', id).single()
      if (error) throw error
      setEv(data ?? null)
      downloadEvent(id, 'admin').catch(() => {})
    } catch {
      const local = await db.evenements.get(id)
      if (local) setEv(local as unknown as Evenement)
    }
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
        {(['dashboard', 'details', 'stands', 'prestations', 'prestataires', 'utilisateurs', 'main_courante', 'corbeille'] as Tab[]).map(t => (
          <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {{ dashboard: 'Tableau de bord', details: 'Détails', stands: 'Stands', prestations: 'Prestations', prestataires: 'Prestataires', utilisateurs: 'Utilisateurs', main_courante: 'Main courante', corbeille: 'Corbeille' }[t]}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <TabDashboard ev={ev} />}
      {tab === 'details' && <TabDetails ev={ev} />}
      {tab === 'stands' && <TabStands ev={ev} />}
      {tab === 'prestations' && <TabPrestations ev={ev} onGoToStands={() => setTab('stands')} />}
      {tab === 'prestataires' && <TabPrestataires ev={ev} />}
      {tab === 'utilisateurs' && <TabUtilisateurs ev={ev} />}
      {tab === 'main_courante' && <TabMainCourante ev={ev} canDelete />}
      {tab === 'corbeille' && <TabCorbeille ev={ev} />}

      {editing && <EvenementForm ev={ev} onSaved={() => { setEditing(false); load() }} />}
    </>
  )
}
