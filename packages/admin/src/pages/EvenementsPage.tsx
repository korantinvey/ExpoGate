import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { sb } from '../lib/supabase'
import { db } from '../lib/db'
import { Modal } from '../components/ui/Modal'
import { Alert } from '../components/ui/Alert'
import { DateInput } from '../components/ui/DateInput'
import { fmtDate } from '../lib/format'
import type { Evenement, EvenementStatut } from '../types'

const STATUT_LABEL: Record<string, string> = {
  parametrage: 'Paramétrage',
  actif: 'Actif',
  termine: 'Terminé',
}

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
            <div
              key={ev.id}
              className="event-card"
              onClick={() => navigate(`/evenements/${ev.id}`)}
            >
              <div className="event-card-header">
                <div className="event-card-title">{ev.nom}</div>
                <span className={`badge badge-${ev.statut}`}>{STATUT_LABEL[ev.statut]}</span>
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
