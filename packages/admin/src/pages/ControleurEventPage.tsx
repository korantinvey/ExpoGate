import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db, type LocalEvenement, type LocalStand } from '../lib/db'
import { downloadEvent, syncPending, getPendingCount } from '../lib/sync'
import { fmtDate } from '../lib/format'

const REFRESH_THRESHOLD_MS = 30 * 60 * 1000 // 30 min

interface StandProgress extends LocalStand {
  total: number
  done: number
  issues: number
}

function standColor(s: StandProgress) {
  if (s.total === 0 || s.done === 0) return 'var(--border)'
  if (s.issues > 0) return '#f97316'
  if (s.done === s.total) return 'var(--success)'
  return 'var(--accent)'
}

function HeaderRight({ pending, isOnline, syncing, downloading, onSync }: {
  pending: number; isOnline: boolean; syncing: boolean; downloading: boolean; onSync: () => void
}) {
  if (downloading) return <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>↓ Mise à jour…</span>
  if (syncing)     return <span style={{ fontSize: 12, color: 'var(--accent)' }}>⟳ Sync…</span>
  if (pending > 0) {
    return (
      <button
        onClick={onSync}
        disabled={!isOnline}
        style={{ background: isOnline ? 'var(--accent)' : 'var(--border)', color: isOnline ? '#fff' : 'var(--text-muted)', border: 'none', borderRadius: 12, padding: '3px 10px', fontSize: 12, cursor: isOnline ? 'pointer' : 'default', fontWeight: 600 }}
      >
        {isOnline ? `↑ ${pending}` : `📵 ${pending}`}
      </button>
    )
  }
  return <span style={{ fontSize: 12, color: isOnline ? 'var(--success)' : 'var(--text-muted)' }}>{isOnline ? '✓' : '📵'}</span>
}

export function ControleurEventPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const [ev, setEv] = useState<LocalEvenement | null>(null)
  const [stands, setStands] = useState<StandProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [pending, setPending] = useState(0)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [search, setSearch] = useState('')

  const loadLocal = useCallback(async () => {
    if (!eventId) return
    const [event, rawStands] = await Promise.all([
      db.evenements.get(eventId),
      db.stands.where('evenement_id').equals(eventId).toArray(),
    ])
    setEv(event ?? null)
    if (rawStands.length) {
      const withProgress = await Promise.all(rawStands.map(async s => {
        const prests = await db.prestations.where('stand_id').equals(s.id).toArray()
        return {
          ...s,
          total: prests.length,
          done: prests.filter(p => p.statut_conformite !== null).length,
          issues: prests.filter(p => p.statut_conformite === 'non_conforme' || p.statut_conformite === 'absent').length,
        }
      }))
      setStands(withProgress.sort((a, b) => a.numero.localeCompare(b.numero, 'fr', { numeric: true })))
    } else {
      setStands([])
    }
    setPending(await getPendingCount())
    setLoading(false)
    return event
  }, [eventId])

  const silentDownload = useCallback(async () => {
    if (!eventId || !navigator.onLine || downloading) return
    setDownloading(true)
    try {
      await downloadEvent(eventId)
      await loadLocal()
    } catch { /* silencieux */ } finally {
      setDownloading(false)
    }
  }, [eventId, downloading, loadLocal])

  const triggerSync = useCallback(async () => {
    if (!navigator.onLine || syncing) return
    setSyncing(true)
    try { await syncPending(); await loadLocal() } finally { setSyncing(false) }
  }, [syncing, loadLocal])

  useEffect(() => {
    async function init() {
      if (!eventId) return
      // Afficher les données locales immédiatement (0 latence)
      const cached = await loadLocal()
      // Télécharger en arrière-plan si en ligne et données absentes ou périmées
      if (navigator.onLine) {
        const stale = !cached?.downloaded_at ||
          Date.now() - new Date(cached.downloaded_at).getTime() > REFRESH_THRESHOLD_MS
        if (stale) await silentDownload()
      }
    }
    init()

    const onOnline = () => { setIsOnline(true); triggerSync() }
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [eventId])

  const filtered = stands.filter(s =>
    !search ||
    s.numero.toLowerCase().includes(search.toLowerCase()) ||
    (s.nom_exposant ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (s.hall ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const totalDone = stands.reduce((a, s) => a + s.done, 0)
  const totalPrests = stands.reduce((a, s) => a + s.total, 0)
  const globalPct = totalPrests ? Math.round((totalDone / totalPrests) * 100) : 0

  if (loading) {
    return (
      <div className="ctrl-shell">
        <div className="ctrl-header">
          <button className="ctrl-back" onClick={() => navigate('/')}>←</button>
          <span className="ctrl-title">Chargement…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="ctrl-shell">
      <div className="ctrl-header">
        <button className="ctrl-back" onClick={() => navigate('/')}>←</button>
        <span className="ctrl-title">{ev?.nom ?? 'Événement'}</span>
        <HeaderRight
          pending={pending}
          isOnline={isOnline}
          syncing={syncing}
          downloading={downloading}
          onSync={triggerSync}
        />
      </div>

      <div className="ctrl-content">
        {/* Aucune donnée hors ligne */}
        {!ev && !downloading && (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📵</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Données non disponibles hors ligne</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Connectez-vous au réseau pour charger cet événement.
            </div>
          </div>
        )}

        {/* Chargement initial */}
        {!ev && downloading && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⟳</div>
            <div style={{ fontSize: 15 }}>Téléchargement en cours…</div>
          </div>
        )}

        {/* Données disponibles */}
        {ev && (
          <>
            <div style={{ padding: '12px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
              {ev.date_debut && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                  {ev.lieu && `${ev.lieu} · `}{fmtDate(ev.date_debut)} → {fmtDate(ev.date_fin)}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {stands.length} stand{stands.length > 1 ? 's' : ''} · {totalPrests} prestation{totalPrests > 1 ? 's' : ''}
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, color: globalPct === 100 ? 'var(--success)' : 'var(--text)' }}>
                  {globalPct}%
                </span>
              </div>
              <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: globalPct === 100 ? 'var(--success)' : 'var(--accent)', borderRadius: 3, width: `${globalPct}%`, transition: 'width 0.4s ease' }} />
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher stand, exposant, hall…"
                  style={{ flex: 1 }}
                />
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={silentDownload}
                  disabled={downloading || !isOnline}
                  title="Forcer la mise à jour"
                >
                  {downloading ? '…' : '↻'}
                </button>
              </div>
            </div>

            <div>
              {filtered.length === 0 ? (
                <div className="empty-state">Aucun stand trouvé.</div>
              ) : filtered.map(s => {
                const color = standColor(s)
                const pct = s.total ? Math.round((s.done / s.total) * 100) : 0
                return (
                  <div key={s.id} className="ctrl-stand-item" onClick={() => navigate(`/controleur/${eventId}/${s.id}`)}>
                    <div className="ctrl-stand-color-bar" style={{ background: color }} />
                    <div className="ctrl-stand-body">
                      <div className="ctrl-stand-top">
                        <span className="ctrl-stand-numero">{s.numero}</span>
                        {s.hall && <span className="ctrl-stand-hall">{s.hall}</span>}
                      </div>
                      {s.nom_exposant && <div className="ctrl-stand-exposant">{s.nom_exposant}</div>}
                      {s.total > 0 && (
                        <div className="ctrl-stand-prog">
                          <div className="ctrl-stand-prog-track">
                            <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.3s' }} />
                          </div>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{s.done}/{s.total}</span>
                          {s.issues > 0 && <span style={{ fontSize: 12, color: '#f97316', flexShrink: 0, fontWeight: 600 }}>⚠ {s.issues}</span>}
                        </div>
                      )}
                    </div>
                    <span className="ctrl-stand-chevron">›</span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
