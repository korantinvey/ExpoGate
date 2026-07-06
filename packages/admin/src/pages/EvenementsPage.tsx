import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { sb } from '../lib/supabase'
import { db } from '../lib/db'
import { fmtDate } from '../lib/format'
import { EVENEMENT_STATUT_LABEL } from '../lib/constants'
import { EvenementForm } from '../components/EvenementForm'
import type { Evenement } from '../types'

export function EvenementsPage() {
  const navigate = useNavigate()
  const [events, setEvents] = useState<Evenement[]>([])
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<Evenement | null | 'new'>(null)

  async function load() {
    const localEvs = await db.evenements.toArray()
    if (localEvs.length) {
      let cached = localEvs as unknown as Evenement[]
      if (filter) cached = cached.filter(e => e.statut === filter)
      setEvents(cached.sort((a, b) => b.date_debut.localeCompare(a.date_debut)))
    }
    try {
      let q = sb.from('evenements').select('*').order('date_debut', { ascending: false })
      if (filter) q = q.eq('statut', filter)
      const { data, error } = await q
      if (error) throw error
      setEvents(data ?? [])
    } catch { /* données locales déjà affichées */ }
  }

  useEffect(() => { load() }, [filter])

  const displayed = useMemo(() => {
    if (!search.trim()) return events
    const q = search.trim().toLowerCase()
    return events.filter(e =>
      e.nom.toLowerCase().includes(q) ||
      (e.lieu ?? '').toLowerCase().includes(q)
    )
  }, [events, search])

  return (
    <>
      <div className="page-header">
        <div className="page-title">Événements</div>
        <div className="page-subtitle">Créer et gérer les salons</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <input
          type="search"
          placeholder="Rechercher un événement…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: '1 1 200px', minWidth: 180, maxWidth: 360, padding: '7px 12px', fontSize: 14, border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)' }}
        />
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {[{ v: '', l: 'Tous' }, { v: 'parametrage', l: 'Paramétrage' }, { v: 'actif', l: 'Actif' }, { v: 'termine', l: 'Terminé' }].map(({ v, l }) => (
            <button key={v} onClick={() => setFilter(v)} style={{ padding: '4px 10px', fontSize: 12, borderRadius: 20, border: '1px solid var(--border)', cursor: 'pointer', background: filter === v ? 'var(--accent)' : 'var(--surface)', color: filter === v ? '#fff' : 'var(--text)', fontWeight: filter === v ? 600 : 400 }}>{l}</button>
          ))}
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setModal('new')} style={{ marginLeft: 'auto' }}>+ Nouvel événement</button>
      </div>

      {displayed.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">◈</div>
          <div>Aucun événement trouvé</div>
          <div className="mt-4"><button className="btn btn-primary" onClick={() => setModal('new')}>Créer un événement</button></div>
        </div>
      ) : (
        <div className="events-grid">
          {displayed.map(ev => (
            <div key={ev.id} className="event-card" onClick={() => navigate(`/evenements/${ev.id}`)}>
              <div className="event-card-header">
                <div className="event-card-title">{ev.nom}</div>
                <span className={`badge badge-${ev.statut}`}>{EVENEMENT_STATUT_LABEL[ev.statut]}</span>
              </div>
              <div className="event-card-meta">
                {ev.lieu && <span>📍 {ev.lieu}</span>}
                <span>📅 {fmtDate(ev.date_debut)} → {fmtDate(ev.date_fin)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal !== null && (
        <EvenementForm
          ev={modal === 'new' ? null : modal}
          onSaved={() => { setModal(null); load() }}
        />
      )}
    </>
  )
}
