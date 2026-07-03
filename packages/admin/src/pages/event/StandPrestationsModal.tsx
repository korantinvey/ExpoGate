import { useEffect, useState } from 'react'
import { sb } from '../../lib/supabase'
import { db } from '../../lib/db'
import { Modal } from '../../components/ui/Modal'
import type { Stand, Prestation } from '../../types'
import { PrestationForm } from './PrestationForm'
import { STATUT_LABELS, STATUT_COLORS, conformiteBg } from './helpers'

export function StandPrestationsModal({ stand, evenementId, onClose, onEditPrestation }: {
  stand: Stand & { prestations?: Prestation[] }
  evenementId?: string
  onClose: () => void
  onEditPrestation?: (p: Prestation) => void
}) {
  const [prestations, setPrestations] = useState<Prestation[]>(stand.prestations ?? [])
  const [editing, setEditing] = useState<Prestation | null | 'new'>(null)

  function loadFromNetwork() {
    sb.from('prestations')
      .select('*, prestataires(raison_sociale)')
      .eq('stand_id', stand.id)
      .eq('deleted', false)
      .order('libelle')
      .then(({ data }) => { if (data) setPrestations(data) })
  }

  useEffect(() => {
    if (stand.prestations) return
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
        onSaved={() => { setEditing(null); loadFromNetwork() }}
        onGoToStands={() => setEditing(null)}
        initialStand={editing !== 'new' ? stand : undefined}
        canDelete
      />
    )
  }

  return (
    <Modal
      title={`Prestations — Stand ${stand.numero}${stand.nom_exposant ? ` · ${stand.nom_exposant}` : ''}`}
      confirmLabel="Fermer"
      onClose={onClose}
      onConfirm={async () => { onClose(); return true }}
      footer={!onEditPrestation && evenementId
        ? <button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>+ Prestation</button>
        : undefined
      }
    >
      {prestations.length === 0 ? (
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
      )}
    </Modal>
  )
}
