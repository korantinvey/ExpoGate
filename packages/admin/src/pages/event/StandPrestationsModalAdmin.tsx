import { useEffect, useState } from 'react'
import { sb } from '../../lib/supabase'
import { Modal } from '../../components/ui/Modal'
import type { Stand, Prestation } from '../../types'
import { PrestationFormAdmin } from './PrestationFormAdmin'

export function StandPrestationsModal({ stand, evenementId, onClose }: { stand: Stand; evenementId: string; onClose: () => void }) {
  const [prestations, setPrestations] = useState<Prestation[]>([])
  const [editing, setEditing] = useState<Prestation | null | 'new'>(null)

  function load() {
    sb.from('prestations')
      .select('*, prestataires(raison_sociale)')
      .eq('stand_id', stand.id)
      .eq('deleted', false)
      .order('libelle')
      .then(({ data }) => setPrestations(data ?? []))
  }

  useEffect(() => { load() }, [stand.id])

  if (editing !== null) {
    return (
      <PrestationFormAdmin
        prest={editing === 'new' ? null : editing}
        evenementId={evenementId}
        onSaved={() => { setEditing(null); load() }}
        onGoToStands={() => setEditing(null)}
      />
    )
  }

  return (
    <Modal
      title={`Prestations — Stand ${stand.numero}${stand.nom_exposant ? ` · ${stand.nom_exposant}` : ''}`}
      confirmLabel="Fermer"
      onClose={onClose}
      onConfirm={async () => { onClose(); return true }}
      footer={<button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>+ Prestation</button>}
    >
      {prestations.length === 0 ? (
        <div className="empty-state" style={{ padding: '24px 0' }}>Aucune prestation sur ce stand.</div>
      ) : (
        <table style={{ width: '100%', fontSize: 14 }}>
          <thead>
            <tr>
              <th>Libellé</th>
              <th>Catégorie</th>
              <th>Qté</th>
              <th>Emplacement</th>
              <th>Prestataire</th>
            </tr>
          </thead>
          <tbody>
            {prestations.map(p => (
              <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => setEditing(p)}>
                <td style={{ fontWeight: 600 }}>{p.libelle}</td>
                <td>{p.categorie ?? '—'}</td>
                <td>{p.quantite_attendue}</td>
                <td>{p.emplacement_prevu ?? '—'}</td>
                <td>{p.prestataires?.raison_sociale ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  )
}
