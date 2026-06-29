import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { sb } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { fmtDate } from '../lib/format'
import { downloadEvent } from '../lib/sync'
import { db } from '../lib/db'
import type { Evenement, RoleLocal } from '../types'

interface EvenementAvecRole extends Evenement {
  role_local: RoleLocal
}

const STATUT_LABEL: Record<string, string> = {
  parametrage: 'Paramétrage',
  actif: 'Actif',
  termine: 'Terminé',
}

const ROLE_LABEL: Record<string, string> = {
  organisateur: 'Organisateur',
  prestataire: 'Prestataire',
}

export function EvenementsOrganisateurPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [evenements, setEvenements] = useState<EvenementAvecRole[]>([])
  const [syncMap, setSyncMap] = useState<Record<string, string | null>>({})

  const refreshSyncMap = useCallback(async (ids: string[]) => {
    const locals = await db.evenements.bulkGet(ids)
    const map: Record<string, string | null> = {}
    ids.forEach((id, i) => { map[id] = locals[i]?.downloaded_at ?? null })
    setSyncMap(map)
  }, [])

  useEffect(() => {
    if (!user) return
    async function loadFromCache() {
      const localEvs = await db.evenements.filter(ev => !!ev.downloaded_at).toArray()
      const liste = localEvs.map(ev => ({ ...ev, created_at: '', role_local: (ev.role_local ?? 'organisateur') as RoleLocal })) as EvenementAvecRole[]
      setEvenements(liste)
      await refreshSyncMap(liste.map(ev => ev.id))
    }

    async function load() {
      // Affiche le cache immédiatement (0 latence perçue)
      await loadFromCache()
      if (!navigator.onLine) return
      try {
        const { data: acces, error: accesErr } = await sb.from('user_evenements')
          .select('evenement_id, role_local')
          .eq('user_id', user!.id)

        if (accesErr) throw accesErr
        if (!acces?.length) return

        const ids = acces.map(a => a.evenement_id)
        const { data: evs, error: evsErr } = await sb.from('evenements')
          .select('*')
          .in('id', ids)

        if (evsErr || !evs) throw evsErr ?? new Error('no data')

        const roleMap = Object.fromEntries(acces.map(a => [a.evenement_id, a.role_local as RoleLocal]))
        const liste = evs.filter(ev => ev.statut !== 'parametrage').map(ev => ({ ...ev, role_local: roleMap[ev.id] }))
        setEvenements(liste)

        await refreshSyncMap(liste.map(ev => ev.id))

        // Téléchargement silencieux en arrière-plan de tous les événements actifs
        const actifs = liste.filter(ev => ev.statut === 'actif')
        await Promise.all(actifs.map(ev => downloadEvent(ev.id, roleMap[ev.id]).catch(() => {})))
        await refreshSyncMap(liste.map(ev => ev.id))
      } catch { /* cache déjà affiché */ }
    }
    load()
  }, [user, refreshSyncMap])

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
            <div
              key={ev.id}
              className="event-card"
              onClick={() => navigate(`/evenements/${ev.id}`)}
            >
              <div className="event-card-header">
                <div className="event-card-title">{ev.nom}</div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <span className={`badge badge-${ev.statut}`}>{STATUT_LABEL[ev.statut]}</span>
                  {ev.statut === 'actif' && (
                    syncMap[ev.id]
                      ? <span className="badge badge-actif">✓</span>
                      : <span className="badge" style={{ background: 'var(--border)', color: 'var(--text-muted)', fontSize: 11 }}>↓</span>
                  )}
                </div>
              </div>
              <div className="event-card-meta">
                {ev.lieu && <span>📍 {ev.lieu}</span>}
                <span>📅 {fmtDate(ev.date_debut)} → {fmtDate(ev.date_fin)}</span>
              </div>
              <div className="event-card-role">
                {ev.role_local === 'organisateur' ? '👤 ' : '🏢 '}
                {ROLE_LABEL[ev.role_local] ?? ev.role_local}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
