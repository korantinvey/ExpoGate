import { useEffect, useState } from 'react'
import { sb } from '../../lib/supabase'
import { db } from '../../lib/db'
import type { Evenement } from '../../types'

interface GlobalStats {
  nbStands: number; total: number
  conforme: number; non_conforme: number; absent: number; a_verifier: number; non_controlees: number
  standsConforme: number; standsAControler: number; standsNonConforme: number
}

interface PrestataireStat {
  id: string
  nom: string
  total: number
  tauxAnomalie: number
  delaiMoyenMs: number | null
}

function formatDuree(ms: number): string {
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (h >= 24) { const j = Math.floor(h / 24); const hr = h % 24; return hr > 0 ? `${j}j ${hr}h` : `${j}j` }
  return h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ''}` : `${m}min`
}

export function TabDashboard({ ev }: { ev: Evenement }) {
  const [stats, setStats] = useState<GlobalStats | null>(null)
  const [prestatairesStats, setPrestatairesStats] = useState<PrestataireStat[]>([])

  useEffect(() => {
    function classifyStands<S extends { id: string }, P extends { stand_id: string; statut_conformite: string | null }>(
      stands: S[], prests: P[]
    ) {
      let standsConforme = 0, standsAControler = 0, standsNonConforme = 0
      for (const stand of stands) {
        const sp = prests.filter(p => p.stand_id === stand.id)
        if (sp.some(p => p.statut_conformite === 'non_conforme' || p.statut_conformite === 'absent')) standsNonConforme++
        else if (sp.length > 0 && sp.every(p => p.statut_conformite === 'conforme')) standsConforme++
        else standsAControler++
      }
      return { standsConforme, standsAControler, standsNonConforme }
    }

    function computePrestaStats(
      prests: { prestataire_id?: string | null; anomalie?: boolean | null; date_anomalie?: string | null; date_retour_a_verifier?: string | null }[],
      nomMap: Map<string, string>
    ): PrestataireStat[] {
      const byId = new Map<string, typeof prests[number][]>()
      for (const p of prests) {
        if (!p.prestataire_id) continue
        if (!byId.has(p.prestataire_id)) byId.set(p.prestataire_id, [])
        byId.get(p.prestataire_id)!.push(p)
      }
      const result: PrestataireStat[] = []
      for (const [id, ps] of byId) {
        const total = ps.length
        const avecAnomalie = ps.filter(p => p.anomalie).length
        const tauxAnomalie = Math.round(avecAnomalie / total * 100)
        const delais = ps
          .filter(p => p.date_anomalie && p.date_retour_a_verifier)
          .map(p => new Date(p.date_retour_a_verifier!).getTime() - new Date(p.date_anomalie!).getTime())
        const delaiMoyenMs = delais.length > 0 ? delais.reduce((a, b) => a + b, 0) / delais.length : null
        result.push({ id, nom: nomMap.get(id) ?? id, total, tauxAnomalie, delaiMoyenMs })
      }
      return result.sort((a, b) => b.tauxAnomalie - a.tauxAnomalie || a.nom.localeCompare(b.nom, 'fr'))
    }

    async function loadFromCache() {
      const localStands = await db.stands.where('evenement_id').equals(ev.id).toArray()
      const localPrests = await db.prestations.where('stand_id').anyOf(localStands.map(s => s.id)).toArray()
      const localPrestataires = await db.prestataires.toArray()
      const nomMap = new Map(localPrestataires.map(p => [p.id, p.raison_sociale]))
      setStats({
        nbStands: localStands.length,
        total: localPrests.length,
        conforme: localPrests.filter(p => p.statut_conformite === 'conforme').length,
        non_conforme: localPrests.filter(p => p.statut_conformite === 'non_conforme').length,
        absent: localPrests.filter(p => p.statut_conformite === 'absent').length,
        a_verifier: localPrests.filter(p => p.statut_conformite === 'a_verifier').length,
        non_controlees: localPrests.filter(p => !p.statut_conformite).length,
        ...classifyStands(localStands, localPrests),
      })
      setPrestatairesStats(computePrestaStats(localPrests, nomMap))
    }

    async function load() {
      await loadFromCache()
      try {
        const { data: standsRaw, error: sErr } = await sb.from('stands').select('id').eq('evenement_id', ev.id).eq('deleted', false)
        if (sErr) throw sErr
        const standIds = (standsRaw ?? []).map(s => s.id)
        if (!standIds.length) {
          setStats({ nbStands: 0, total: 0, conforme: 0, non_conforme: 0, absent: 0, a_verifier: 0, non_controlees: 0, standsConforme: 0, standsAControler: 0, standsNonConforme: 0 })
          setPrestatairesStats([])
          return
        }
        const [prestsRes, epRes] = await Promise.all([
          sb.from('prestations')
            .select('stand_id, statut_conformite, prestataire_id, anomalie, date_anomalie, date_retour_a_verifier')
            .in('stand_id', standIds)
            .eq('deleted', false),
          sb.from('evenement_prestataires')
            .select('prestataire_id, prestataires(id, raison_sociale)')
            .eq('evenement_id', ev.id),
        ])
        const prestsRaw = prestsRes.data ?? []
        const nomMap = new Map<string, string>()
        for (const ep of epRes.data ?? []) {
          const p = ep.prestataires as unknown as { id: string; raison_sociale: string } | null
          if (p) nomMap.set(p.id, p.raison_sociale)
        }
        setStats({
          nbStands: standIds.length,
          total: prestsRaw.length,
          conforme: prestsRaw.filter(p => p.statut_conformite === 'conforme').length,
          non_conforme: prestsRaw.filter(p => p.statut_conformite === 'non_conforme').length,
          absent: prestsRaw.filter(p => p.statut_conformite === 'absent').length,
          a_verifier: prestsRaw.filter(p => p.statut_conformite === 'a_verifier').length,
          non_controlees: prestsRaw.filter(p => !p.statut_conformite).length,
          ...classifyStands(standsRaw ?? [], prestsRaw),
        })
        setPrestatairesStats(computePrestaStats(prestsRaw, nomMap))
      } catch { /* données locales déjà affichées */ }
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

      {prestatairesStats.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Prestataires</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 16px', color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', fontWeight: 500 }}>Prestataire</th>
                  <th style={{ textAlign: 'right', padding: '10px 16px', color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', fontWeight: 500 }}>Prestations</th>
                  <th style={{ textAlign: 'right', padding: '10px 16px', color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', fontWeight: 500 }}>Taux anomalie</th>
                  <th style={{ textAlign: 'right', padding: '10px 16px', color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', fontWeight: 500 }}>Délai moy. résolution</th>
                </tr>
              </thead>
              <tbody>
                {prestatairesStats.map((p, i) => {
                  const anomalieColor = p.tauxAnomalie === 0 ? 'var(--success)' : p.tauxAnomalie > 50 ? 'var(--danger)' : '#f97316'
                  return (
                    <tr key={p.id} style={{ borderBottom: i < prestatairesStats.length - 1 ? '1px solid var(--border)' : undefined }}>
                      <td style={{ padding: '10px 16px', fontWeight: 600 }}>{p.nom}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text-muted)' }}>{p.total}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: anomalieColor }}>{p.tauxAnomalie}%</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text-muted)' }}>
                        {p.delaiMoyenMs !== null ? formatDuree(p.delaiMoyenMs) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
