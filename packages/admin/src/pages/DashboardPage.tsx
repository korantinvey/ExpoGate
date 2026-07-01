import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { sb } from '../lib/supabase'
import { Badge } from '../components/ui/Badge'
import { DataTable } from '../components/ui/DataTable'
import { ExportButton } from '../components/ui/ExportButton'
import { fmtDate } from '../lib/format'
import type { Evenement } from '../types'

interface EvStat {
  id: string
  nom: string
  total: number
  conforme: number
  non_conforme: number
  absent: number
  a_verifier: number
}

function ProgressBar({ value, max, color = 'var(--accent)' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round(value / max * 100)) : 0
  return (
    <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.3s' }} />
    </div>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ actifs: '—', users: '—', prestataires: '—', stands: '—', mcs: '—', mcs_ouvertes: '—' })
  const [conformite, setConformite] = useState({ total: 0, conforme: 0, non_conforme: 0, absent: 0, a_verifier: 0 })
  const [evStats, setEvStats] = useState<EvStat[]>([])
  const [events, setEvents] = useState<Evenement[]>([])
  const [exportFn, setExportFn] = useState<(() => void) | null>(null)
  const [recentMcs, setRecentMcs] = useState<{ id: string; titre: string; etat: string; created_at: string; evenement_id: string; evenements: { nom: string } | null }[]>([])

  useEffect(() => {
    Promise.all([
      sb.from('evenements').select('*', { count: 'exact', head: true }).eq('statut', 'actif'),
      sb.from('users').select('*', { count: 'exact', head: true }),
      sb.from('prestataires').select('*', { count: 'exact', head: true }),
      sb.from('stands').select('*', { count: 'exact', head: true }),
      sb.from('main_courante').select('*', { count: 'exact', head: true }),
      sb.from('main_courante').select('*', { count: 'exact', head: true }).in('etat', ['a_traiter', 'pris_en_charge']),
    ]).then(([ev, us, pr, st, mc, mco]) => {
      setStats({
        actifs: String(ev.count ?? 0),
        users: String(us.count ?? 0),
        prestataires: String(pr.count ?? 0),
        stands: String(st.count ?? 0),
        mcs: String(mc.count ?? 0),
        mcs_ouvertes: String(mco.count ?? 0),
      })
    })

    Promise.all([
      sb.from('prestations').select('*', { count: 'exact', head: true }),
      sb.from('prestations').select('*', { count: 'exact', head: true }).eq('statut_conformite', 'conforme'),
      sb.from('prestations').select('*', { count: 'exact', head: true }).eq('statut_conformite', 'non_conforme'),
      sb.from('prestations').select('*', { count: 'exact', head: true }).eq('statut_conformite', 'absent'),
      sb.from('prestations').select('*', { count: 'exact', head: true }).eq('statut_conformite', 'a_verifier'),
    ]).then(([tot, conf, nc, abs, av]) => {
      setConformite({
        total: tot.count ?? 0,
        conforme: conf.count ?? 0,
        non_conforme: nc.count ?? 0,
        absent: abs.count ?? 0,
        a_verifier: av.count ?? 0,
      })
    })

    type RawEv = { id: string; nom: string; stands: { prestations: { statut_conformite: string | null }[] }[] }
    sb.from('evenements')
      .select('id, nom, stands(prestations(statut_conformite))')
      .eq('statut', 'actif')
      .then(({ data }) => {
        if (!data) return
        setEvStats((data as unknown as RawEv[]).map(ev => {
          const prests = ev.stands.flatMap(s => s.prestations)
          return {
            id: ev.id,
            nom: ev.nom,
            total: prests.length,
            conforme: prests.filter(p => p.statut_conformite === 'conforme').length,
            non_conforme: prests.filter(p => p.statut_conformite === 'non_conforme').length,
            absent: prests.filter(p => p.statut_conformite === 'absent').length,
            a_verifier: prests.filter(p => p.statut_conformite === 'a_verifier').length,
          }
        }))
      })

    sb.from('evenements').select('*').order('created_at', { ascending: false }).limit(5)
      .then(({ data }) => setEvents(data ?? []))

    sb.from('main_courante')
      .select('id, titre, etat, created_at, evenement_id, evenements(nom)')
      .in('etat', ['a_traiter', 'pris_en_charge'])
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setRecentMcs((data ?? []) as unknown as typeof recentMcs))
  }, [])

  const ctrl = conformite.conforme + conformite.non_conforme + conformite.absent + conformite.a_verifier
  const pct = (n: number) => conformite.total > 0 ? Math.round(n / conformite.total * 100) : 0

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
        <div className="stat-card" style={Number(stats.mcs_ouvertes) > 0 ? { borderColor: '#f97316', background: 'rgba(249,115,22,0.04)' } : undefined}>
          <div className="stat-value" style={Number(stats.mcs_ouvertes) > 0 ? { color: '#f97316' } : undefined}>{stats.mcs_ouvertes}</div>
          <div className="stat-label">MC ouvertes</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{stats.mcs} au total</div>
        </div>
      </div>

      {conformite.total > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Conformité globale</div>
            <span className="text-muted" style={{ fontSize: 13 }}>{conformite.total} prestations au total</span>
          </div>
          <div className="card-body" style={{ padding: 24 }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>Prestations contrôlées</span>
                <strong>{pct(ctrl)}% ({ctrl} / {conformite.total})</strong>
              </div>
              <ProgressBar value={ctrl} max={conformite.total} />
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {([
                { label: 'Conformes', count: conformite.conforme, color: 'var(--success)', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.25)' },
                { label: 'Non conformes', count: conformite.non_conforme, color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.25)' },
                { label: 'Absentes', count: conformite.absent, color: 'var(--danger)', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)' },
                { label: 'À vérifier', count: conformite.a_verifier, color: 'var(--text-muted)', bg: 'var(--bg)', border: 'var(--border)' },
                { label: 'Non contrôlées', count: conformite.total - ctrl, color: 'var(--text-muted)', bg: 'var(--bg)', border: 'var(--border)' },
              ] as const).map(({ label, count, color, bg, border }) => (
                <div key={label} style={{ flex: 1, minWidth: 120, background: bg, border: `1px solid ${border}`, borderRadius: 'var(--radius)', padding: '14px 16px' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color }}>{count}</div>
                  <div style={{ fontSize: 11, color, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.04em', opacity: 0.9 }}>{label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{pct(count)}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {evStats.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Avancement par événement actif</div>
          </div>
          <div className="card-body">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    {(['Événement', 'Total', 'Conformes', 'Non conf.', 'Absentes', 'Progression'] as const).map((h, i) => (
                      <th key={h} style={{ textAlign: i === 0 ? 'left' : i === 5 ? 'left' : 'right', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '6px 8px 10px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {evStats.map(ev => {
                    const controlled = ev.conforme + ev.non_conforme + ev.absent + ev.a_verifier
                    const evPct = ev.total > 0 ? Math.round(controlled / ev.total * 100) : 0
                    return (
                      <tr key={ev.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => navigate(`/evenements/${ev.id}`)}>
                        <td style={{ padding: '12px 8px', fontWeight: 600 }}>{ev.nom}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', color: 'var(--text-muted)' }}>{ev.total}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', color: 'var(--success)', fontWeight: 600 }}>{ev.conforme}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', color: '#f97316', fontWeight: 600 }}>{ev.non_conforme}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', color: 'var(--danger)', fontWeight: 600 }}>{ev.absent}</td>
                        <td style={{ padding: '12px 8px 12px 16px', minWidth: 140 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1 }}>
                              <ProgressBar value={controlled} max={ev.total} />
                            </div>
                            <span style={{ color: 'var(--text-muted)', minWidth: 36 }}>{evPct}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {recentMcs.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Main courante — incidents ouverts</div>
            <span style={{ fontSize: 12, color: '#f97316', fontWeight: 600 }}>{stats.mcs_ouvertes} ouverte{Number(stats.mcs_ouvertes) > 1 ? 's' : ''}</span>
          </div>
          <div className="card-body">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {(['Événement', 'Titre', 'État', 'Date'] as const).map((h, i) => (
                    <th key={h} style={{ textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '6px 8px 10px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', ...(i > 1 ? { hideOnMobile: true } : {}) }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentMcs.map(mc => (
                  <tr key={mc.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => navigate(`/evenements/${mc.evenement_id}`)}>
                    <td style={{ padding: '10px 8px', color: 'var(--text-muted)', fontSize: 12 }}>{mc.evenements?.nom ?? '—'}</td>
                    <td style={{ padding: '10px 8px', fontWeight: 600 }}>{mc.titre}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <span style={{
                        ...({ a_traiter: { background: 'rgba(239,68,68,0.12)', color: '#dc2626' }, pris_en_charge: { background: 'rgba(59,130,246,0.12)', color: '#2563eb' }, resolu: { background: 'rgba(34,197,94,0.12)', color: '#16a34a' } }[mc.etat] ?? {}),
                        borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap',
                      }}>
                        {{ a_traiter: 'À traiter', pris_en_charge: 'Pris en charge', resolu: 'Résolu' }[mc.etat] ?? mc.etat}
                      </span>
                    </td>
                    <td style={{ padding: '10px 8px', color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {new Date(mc.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
              { key: 'lieu', label: 'Lieu', sortable: true, filterable: true, hideOnMobile: true },
              { key: 'dates', label: 'Dates', hideOnMobile: true, getValue: e => `${e.date_debut} ${e.date_fin}`, render: e => `${fmtDate(e.date_debut)} → ${fmtDate(e.date_fin)}` },
              { key: 'statut', label: 'Statut', sortable: true, filterable: true, options: [{ value: 'parametrage', label: 'Paramétrage' }, { value: 'actif', label: 'Actif' }, { value: 'termine', label: 'Terminé' }], render: e => <Badge statut={e.statut} /> },
            ]}
          />
        </div>
      </div>
    </>
  )
}
