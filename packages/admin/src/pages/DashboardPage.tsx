import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { sb } from '../lib/supabase'
import { Badge } from '../components/ui/Badge'
import { DataTable } from '../components/ui/DataTable'
import { ExportButton } from '../components/ui/ExportButton'
import { fmtDate } from '../lib/format'
import type { Evenement } from '../types'

export function DashboardPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ actifs: '—', users: '—', prestataires: '—', stands: '—' })
  const [events, setEvents] = useState<Evenement[]>([])
  const [exportFn, setExportFn] = useState<(() => void) | null>(null)

  useEffect(() => {
    Promise.all([
      sb.from('evenements').select('*', { count: 'exact', head: true }).eq('statut', 'actif'),
      sb.from('users').select('*', { count: 'exact', head: true }),
      sb.from('prestataires').select('*', { count: 'exact', head: true }),
      sb.from('stands').select('*', { count: 'exact', head: true }),
    ]).then(([ev, us, pr, st]) => {
      setStats({
        actifs: String(ev.count ?? 0),
        users: String(us.count ?? 0),
        prestataires: String(pr.count ?? 0),
        stands: String(st.count ?? 0),
      })
    })
    sb.from('evenements').select('*').order('created_at', { ascending: false }).limit(5)
      .then(({ data }) => setEvents(data ?? []))
  }, [])

  return (
    <>
      <div className="page-header">
        <div className="page-title">Tableau de bord</div>
        <div className="page-subtitle">Vue d'ensemble de la plateforme</div>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-value">{stats.actifs}</div><div className="stat-label">Événements actifs</div></div>
        <div className="stat-card"><div className="stat-value">{stats.users}</div><div className="stat-label">Utilisateurs</div></div>
        <div className="stat-card"><div className="stat-value">{stats.prestataires}</div><div className="stat-label">Prestataires</div></div>
        <div className="stat-card"><div className="stat-value">{stats.stands}</div><div className="stat-label">Stands total</div></div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Événements récents</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <ExportButton onClick={exportFn} />
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/evenements')}>Voir tout</button>
          </div>
        </div>
        <div className="card-body">
          <DataTable
            data={events}
            exportFilename="evenements-recents"
            onExportReady={fn => setExportFn(() => fn)}
            onRowClick={e => navigate(`/evenements/${e.id}`)}
            emptyState={<div className="empty-state"><div className="empty-icon">◈</div><div>Aucun événement créé</div></div>}
            columns={[
              { key: 'nom', label: 'Nom', sortable: true, filterable: true, render: e => <span style={{ fontWeight: 600 }}>{e.nom}</span> },
              { key: 'lieu', label: 'Lieu', sortable: true, filterable: true },
              { key: 'dates', label: 'Dates', getValue: e => `${e.date_debut} ${e.date_fin}`, render: e => `${fmtDate(e.date_debut)} → ${fmtDate(e.date_fin)}` },
              { key: 'statut', label: 'Statut', sortable: true, filterable: true, options: [{ value: 'parametrage', label: 'Paramétrage' }, { value: 'actif', label: 'Actif' }, { value: 'termine', label: 'Terminé' }], render: e => <Badge statut={e.statut} /> },
            ]}
          />
        </div>
      </div>
    </>
  )
}
