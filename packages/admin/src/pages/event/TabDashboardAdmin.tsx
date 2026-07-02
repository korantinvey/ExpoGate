import { useEffect, useState } from 'react'
import { sb } from '../../lib/supabase'
import type { Evenement } from '../../types'

export function TabDashboard({ ev }: { ev: Evenement }) {
  const [stats, setStats] = useState<{
    nbStands: number; total: number
    conforme: number; non_conforme: number; absent: number; a_verifier: number; non_controlees: number
    standsConforme: number; standsAControler: number; standsNonConforme: number
  } | null>(null)

  useEffect(() => {
    async function load() {
      const { data: standsRaw } = await sb.from('stands').select('id').eq('evenement_id', ev.id).eq('deleted', false)
      const standIds = (standsRaw ?? []).map(s => s.id)
      const prestsRaw = standIds.length
        ? (await sb.from('prestations').select('stand_id, statut_conformite').in('stand_id', standIds).eq('deleted', false)).data ?? []
        : []
      let standsConforme = 0, standsAControler = 0, standsNonConforme = 0
      for (const sid of standIds) {
        const p = prestsRaw.filter(x => x.stand_id === sid)
        if (p.some(x => x.statut_conformite === 'non_conforme' || x.statut_conformite === 'absent')) standsNonConforme++
        else if (p.length > 0 && p.every(x => x.statut_conformite === 'conforme')) standsConforme++
        else standsAControler++
      }
      setStats({
        nbStands: standIds.length,
        total: prestsRaw.length,
        conforme: prestsRaw.filter(p => p.statut_conformite === 'conforme').length,
        non_conforme: prestsRaw.filter(p => p.statut_conformite === 'non_conforme').length,
        absent: prestsRaw.filter(p => p.statut_conformite === 'absent').length,
        a_verifier: prestsRaw.filter(p => p.statut_conformite === 'a_verifier').length,
        non_controlees: prestsRaw.filter(p => !p.statut_conformite).length,
        standsConforme, standsAControler, standsNonConforme,
      })
    }
    load()
  }, [ev.id])

  if (!stats) return <div className="empty-state">Chargement…</div>

  const controlled = stats.conforme + stats.non_conforme + stats.absent + stats.a_verifier
  const pct = (n: number) => stats.total > 0 ? Math.round(n / stats.total * 100) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        {([
          {
            total: stats.nbStands, label: 'Stands',
            sub: [
              { label: 'Conf.', count: stats.standsConforme, color: 'var(--success)' },
              { label: 'À ctrl.', count: stats.standsAControler, color: 'var(--text-muted)' },
              { label: 'NC', count: stats.standsNonConforme, color: '#f97316' },
            ],
          },
          {
            total: stats.total, label: 'Prestations',
            sub: [
              { label: 'Conf.', count: stats.conforme, color: 'var(--success)' },
              { label: 'À vér.', count: stats.a_verifier, color: 'var(--text-muted)' },
              { label: 'NC', count: stats.non_conforme + stats.absent, color: '#f97316' },
            ],
          },
        ]).map(({ total, label, sub }) => (
          <div key={label} className="stat-card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <div className="stat-value">{total}</div>
              <div className="stat-label">{label}</div>
            </div>
            <div style={{ display: 'flex', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              {sub.map(({ label: sl, count, color }, i, arr) => (
                <div key={sl} style={{ flex: 1, textAlign: 'center', borderRight: i < arr.length - 1 ? '1px solid var(--border)' : undefined }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color, lineHeight: 1 }}>{count}</div>
                  <div style={{ fontSize: 9, color, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 3, opacity: 0.85 }}>{sl}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Avancement du contrôle</div>
          <span className="text-muted" style={{ fontSize: 13 }}>{controlled} / {stats.total} contrôlées</span>
        </div>
        <div className="card-body" style={{ padding: 24 }}>
          {stats.total === 0 ? (
            <div className="empty-state" style={{ padding: '16px 0' }}>Aucune prestation sur cet événement.</div>
          ) : (
            <>
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Progression globale</span>
                  <strong>{pct(controlled)}%</strong>
                </div>
                <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct(controlled)}%`, background: 'var(--accent)', borderRadius: 4, transition: 'width 0.3s' }} />
                </div>
              </div>
              {([
                { label: 'Conformes', count: stats.conforme, color: 'var(--success)' },
                { label: 'Non conformes', count: stats.non_conforme, color: '#f97316' },
                { label: 'Absentes', count: stats.absent, color: 'var(--danger)' },
                { label: 'À vérifier', count: stats.a_verifier, color: 'var(--text-muted)' },
                { label: 'Non contrôlées', count: stats.non_controlees, color: 'var(--text-muted)' },
              ] as const).map(({ label, count, color }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
                  <span style={{ width: 130, fontSize: 13, color: 'var(--text)' }}>{label}</span>
                  <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct(count)}%`, background: color, borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color, minWidth: 28, textAlign: 'right' }}>{count}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 38, textAlign: 'right' }}>{pct(count)}%</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
