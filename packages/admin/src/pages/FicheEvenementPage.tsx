import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { sb } from '../lib/supabase'
import { db } from '../lib/db'
import { downloadEvent } from '../lib/sync'
import { Badge } from '../components/ui/Badge'
import { fmtDate } from '../lib/format'
import { EvenementForm } from '../components/EvenementForm'
import { TabMainCourante } from './event/TabMainCourante'
import type { Evenement } from '../types'
import { TabDashboard } from './event/TabDashboard'
import { TabStands } from './event/TabStands'
import { TabPrestations } from './event/TabPrestations'
import { TabPrestataires } from './event/TabPrestataires'
import { TabUtilisateurs } from './event/UserAccesList'
import { TabCorbeille } from './event/TabCorbeilleAdmin'

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

const TAB_LABELS: Record<Tab, string> = {
  dashboard: 'Tableau de bord', details: 'Détails', stands: 'Stands',
  prestations: 'Prestations', prestataires: 'Prestataires', utilisateurs: 'Utilisateurs',
  main_courante: 'Main courante', corbeille: 'Corbeille',
}

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
        {(Object.keys(TAB_LABELS) as Tab[]).map(t => (
          <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {TAB_LABELS[t]}
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
