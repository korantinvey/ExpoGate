import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { sb } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { fmtDate } from '../lib/format'
import type { Evenement, RoleLocal } from '../types'

interface EvenementAvecRole extends Evenement {
  role_local: RoleLocal
}

const STATUT_LABEL: Record<string, string> = {
  parametrage: 'Paramétrage',
  actif: 'Actif',
  termine: 'Terminé',
}

export function EvenementsOrganisateurPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [evenements, setEvenements] = useState<EvenementAvecRole[]>([])

  useEffect(() => {
    if (!user) return
    async function load() {
      const { data: acces } = await sb.from('user_evenements')
        .select('evenement_id, role_local')
        .eq('user_id', user!.id)
      if (!acces?.length) return

      const ids = acces.map(a => a.evenement_id)
      const { data: evs } = await sb.from('evenements')
        .select('*')
        .in('id', ids)

      if (!evs) return
      const roleMap = Object.fromEntries(acces.map(a => [a.evenement_id, a.role_local as RoleLocal]))
      setEvenements(evs.filter(ev => ev.statut !== 'parametrage').map(ev => ({ ...ev, role_local: roleMap[ev.id] })))
    }
    load()
  }, [user])

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Mes événements</div>
        <div className="page-subtitle">Événements auxquels vous avez accès</div>
      </div>

      {evenements.length === 0 ? (
        <div className="empty-state">Aucun événement disponible.</div>
      ) : (
        <div className="events-grid">
          {evenements.map(ev => (
            <div key={ev.id} className="event-card" onClick={() => navigate(`/evenements/${ev.id}`)}>
              <div className="event-card-header">
                <div className="event-card-title">{ev.nom}</div>
                <span className={`badge badge-${ev.statut}`}>{STATUT_LABEL[ev.statut]}</span>
              </div>
              <div className="event-card-meta">
                {ev.lieu && <span>📍 {ev.lieu}</span>}
                <span>📅 {fmtDate(ev.date_debut)} → {fmtDate(ev.date_fin)}</span>
              </div>
              <div className="event-card-role">
                {ev.role_local === 'organisateur' ? '👤 Organisateur' : '🏢 Prestataire'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
