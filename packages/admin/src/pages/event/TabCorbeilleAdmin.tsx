import { useEffect, useState } from 'react'
import { sb } from '../../lib/supabase'
import type { Evenement, Stand, Prestation } from '../../types'

export function TabCorbeille({ ev }: { ev: Evenement }) {
  const [stands, setStands] = useState<Stand[]>([])
  const [prestations, setPrestations] = useState<Prestation[]>([])
  const [section, setSection] = useState<'stands' | 'prestations'>('stands')

  async function load() {
    const [{ data: deletedStands }, { data: activeStands }] = await Promise.all([
      sb.from('stands').select('*').eq('evenement_id', ev.id).eq('deleted', true).order('numero'),
      sb.from('stands').select('id').eq('evenement_id', ev.id).eq('deleted', false),
    ])
    setStands(deletedStands ?? [])
    const allStandIds = [
      ...(deletedStands ?? []).map(s => s.id),
      ...(activeStands ?? []).map(s => s.id),
    ]
    if (allStandIds.length) {
      const { data: p } = await sb.from('prestations')
        .select('*, stands(numero, nom_exposant)')
        .in('stand_id', allStandIds)
        .eq('deleted', true)
        .order('libelle')
      setPrestations(p ?? [])
    } else {
      setPrestations([])
    }
  }

  async function restoreStand(id: string) {
    await sb.from('stands').update({ deleted: false }).eq('id', id)
    load()
  }

  async function restorePrestation(id: string) {
    await sb.from('prestations').update({ deleted: false }).eq('id', id)
    load()
  }

  useEffect(() => { load() }, [ev.id])

  const nbStands = stands.length
  const nbPrests = prestations.length

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Corbeille</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Les éléments supprimés peuvent être restaurés</div>
      </div>
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', padding: '0 20px' }}>
        {([
          { key: 'stands' as const, label: 'Stands', count: nbStands },
          { key: 'prestations' as const, label: 'Prestations', count: nbPrests },
        ]).map(({ key, label, count }) => (
          <button key={key} onClick={() => setSection(key)} style={{
            padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: section === key ? 600 : 400,
            color: section === key ? 'var(--accent-dark)' : 'var(--text-muted)',
            borderBottom: section === key ? '2px solid var(--accent-dark)' : '2px solid transparent',
            marginBottom: -1,
          }}>
            {label} <span style={{ marginLeft: 4, fontSize: 12, background: count > 0 ? '#fee2e2' : 'var(--border)', color: count > 0 ? '#dc2626' : undefined, borderRadius: 10, padding: '1px 7px' }}>{count}</span>
          </button>
        ))}
      </div>
      <div className="card-body">
        {section === 'stands' && (
          stands.length === 0 ? (
            <div className="empty-state">Aucun stand dans la corbeille.</div>
          ) : (
            <table style={{ width: '100%', fontSize: 14 }}>
              <thead><tr><th>N°</th><th>Exposant</th><th>Hall</th><th></th></tr></thead>
              <tbody>
                {stands.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{s.numero}</td>
                    <td>{s.nom_exposant ?? '—'}</td>
                    <td>{s.hall ?? '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => restoreStand(s.id)}>Restaurer</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
        {section === 'prestations' && (
          prestations.length === 0 ? (
            <div className="empty-state">Aucune prestation dans la corbeille.</div>
          ) : (
            <table style={{ width: '100%', fontSize: 14 }}>
              <thead><tr><th>Libellé</th><th>Stand</th><th>Catégorie</th><th></th></tr></thead>
              <tbody>
                {prestations.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.libelle}</td>
                    <td>{(p.stands as Stand | undefined)?.numero ?? '—'}</td>
                    <td>{p.categorie ?? '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => restorePrestation(p.id)}>Restaurer</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  )
}
