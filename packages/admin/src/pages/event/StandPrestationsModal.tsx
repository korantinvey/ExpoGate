import { useEffect, useState } from 'react'
import { sb } from '../../lib/supabase'
import { db } from '../../lib/db'
import { Modal } from '../../components/ui/Modal'
import type { Stand, Prestation } from '../../types'
import { PrestationForm } from './PrestationForm'
import { StandForm } from './StandForm'
import { STATUT_LABELS, STATUT_COLORS, conformiteBg } from './helpers'

export function StandPrestationsModal({ stand: standProp, evenementId, onClose, onEditPrestation, showStandTab = true, onStandSaved }: {
  stand: Stand & { prestations?: Prestation[] }
  evenementId?: string
  onClose: () => void
  onEditPrestation?: (p: Prestation) => void
  showStandTab?: boolean
  onStandSaved?: () => void
}) {
  const [stand, setStand] = useState<Stand>(standProp)
  const [prestations, setPrestations] = useState<Prestation[]>(standProp.prestations ?? [])
  const [editing, setEditing] = useState<Prestation | null | 'new'>(null)
  const [editingStand, setEditingStand] = useState(false)
  const [tab, setTab] = useState<'prestations' | 'stand'>('prestations')

  function loadFromNetwork() {
    sb.from('prestations')
      .select('*, prestataires(raison_sociale)')
      .eq('stand_id', stand.id)
      .eq('deleted', false)
      .order('libelle')
      .then(({ data }) => { if (data) setPrestations(data) })
  }

  useEffect(() => {
    if (standProp.prestations) return
    async function load() {
      const local = await db.prestations.where('stand_id').equals(stand.id).toArray()
      if (local.length) setPrestations(local as unknown as Prestation[])
      try {
        const { data } = await sb.from('prestations')
          .select('*, prestataires(raison_sociale)')
          .eq('stand_id', stand.id)
          .eq('deleted', false)
          .order('libelle')
        if (data) setPrestations(data)
      } catch { /* données locales déjà affichées */ }
    }
    load()
  }, [stand.id])

  if (!onEditPrestation && editing !== null) {
    return (
      <PrestationForm
        prest={editing === 'new' ? null : editing}
        evenementId={evenementId!}
        onSaved={async () => {
          if (editing !== 'new') {
            const local = await db.prestations.get((editing as Prestation).id)
            if (local) setPrestations(prev => prev.map(p => p.id === local.id ? { ...p, ...local as unknown as Partial<Prestation> } : p))
          }
          setEditing(null)
          loadFromNetwork()
        }}
        onGoToStands={() => setEditing(null)}
        initialStand={editing !== 'new' ? stand : undefined}
        canDelete
      />
    )
  }

  if (editingStand && evenementId) {
    return (
      <StandForm
        stand={stand}
        evenementId={evenementId}
        onSaved={async () => {
          const { data } = await sb.from('stands').select('*').eq('id', stand.id).eq('deleted', false).single()
          if (data) {
            setStand(data)
            onStandSaved?.()
            setEditingStand(false)
          } else {
            onClose()
            onStandSaved?.()
          }
        }}
        canDelete
      />
    )
  }

  const canEditStand = showStandTab && !!evenementId && !onEditPrestation

  const tabBtn = (active: boolean) => ({
    padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 13, fontWeight: active ? 600 : 400,
    color: active ? 'var(--accent-dark)' : 'var(--text-muted)',
    borderBottom: active ? '2px solid var(--accent-dark)' : '2px solid transparent',
    marginBottom: -1,
  } as React.CSSProperties)

  return (
    <Modal
      title={`Stand ${stand.numero}${stand.nom_exposant ? ` · ${stand.nom_exposant}` : ''}`}
      confirmLabel="Fermer"
      onClose={onClose}
      onConfirm={async () => { onClose(); return true }}
      footer={!onEditPrestation && evenementId && tab === 'prestations'
        ? <button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>+ Prestation</button>
        : undefined
      }
    >
      {showStandTab && (
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 16, marginTop: -4 }}>
          <button style={tabBtn(tab === 'prestations')} onClick={() => setTab('prestations')}>Prestations</button>
          <button style={tabBtn(tab === 'stand')} onClick={() => setTab('stand')}>Stand</button>
        </div>
      )}

      {tab === 'prestations' && (
        prestations.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 0' }}>Aucune prestation sur ce stand.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {prestations.map(p => {
              const statut = p.statut_conformite
              const bg = conformiteBg(statut)
              const statutColor = statut ? STATUT_COLORS[statut] : undefined
              const statutLabel = statut ? STATUT_LABELS[statut] : null
              return (
                <div key={p.id}
                  style={{ borderRadius: 8, border: '1px solid var(--border)', padding: '10px 12px', cursor: 'pointer', ...bg }}
                  onClick={() => onEditPrestation ? onEditPrestation(p) : setEditing(p)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{p.libelle}</span>
                    {statutLabel && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: statutColor, background: `${statutColor}20`, padding: '2px 7px', borderRadius: 4, whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {statutLabel}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                    {p.categorie && <span>{p.categorie}</span>}
                    {p.quantite_attendue != null && <span>{p.quantite_attendue} unité{p.quantite_attendue > 1 ? 's' : ''}</span>}
                    {p.emplacement_prevu && <span>{p.emplacement_prevu}</span>}
                    {p.prestataires?.raison_sociale && <span>{p.prestataires.raison_sociale}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {tab === 'stand' && showStandTab && (
        <div>
          <div className="grid-2" style={{ marginBottom: canEditStand ? 16 : 0 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <div className="text-muted" style={{ fontSize: 12 }}>Exposant</div>
              <div style={{ marginTop: 2, fontWeight: 600 }}>{stand.nom_exposant ?? '—'}</div>
            </div>
            <div>
              <div className="text-muted" style={{ fontSize: 12 }}>Hall / Pavillon</div>
              <div style={{ marginTop: 2 }}>{stand.hall ?? '—'}</div>
            </div>
            <div>
              <div className="text-muted" style={{ fontSize: 12 }}>Numéro</div>
              <div style={{ marginTop: 2 }}>{stand.numero}</div>
            </div>
            <div>
              <div className="text-muted" style={{ fontSize: 12 }}>Surface (m²)</div>
              <div style={{ marginTop: 2 }}>{stand.surface != null ? stand.surface : '—'}</div>
            </div>
            <div>
              <div className="text-muted" style={{ fontSize: 12 }}>Angles</div>
              <div style={{ marginTop: 2 }}>{stand.angles != null ? stand.angles : '—'}</div>
            </div>
          </div>
          {canEditStand && (
            <button className="btn btn-secondary btn-sm" onClick={() => setEditingStand(true)}>Modifier le stand</button>
          )}
        </div>
      )}
    </Modal>
  )
}
