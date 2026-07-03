import { useEffect, useState } from 'react'
import { sb } from '../../lib/supabase'
import { Modal } from '../../components/ui/Modal'
import { Alert } from '../../components/ui/Alert'
import type { Prestataire, Stand, UserEvenement, RoleLocal } from '../../types'

export function EditAccesModal({ acces, onClose }: { acces: UserEvenement; onClose: () => void }) {
  const [prestataires, setPrestataires] = useState<Prestataire[]>([])
  const [stands, setStands] = useState<Stand[]>([])
  const [selectedStandIds, setSelectedStandIds] = useState<string[]>([])
  const [role, setRole] = useState<RoleLocal>(acces.role_local)
  const [prestaId, setPrestaId] = useState(acces.prestataire_id ?? '')
  const [error, setError] = useState('')

  useEffect(() => {
    sb.from('prestataires').select('*').order('raison_sociale').then(({ data }) => {
      setPrestataires(data ?? [])
      if (!acces.prestataire_id && data?.length) setPrestaId(data[0].id)
    })
    sb.from('stands').select('*').eq('evenement_id', acces.evenement_id).order('numero')
      .then(({ data }) => setStands(data ?? []))
    if (acces.role_local === 'controleur') {
      sb.from('controleur_stands').select('stand_id').eq('user_evenement_id', acces.id)
        .then(({ data }) => setSelectedStandIds((data ?? []).map((cs: { stand_id: string }) => cs.stand_id)))
    }
  }, [])

  function toggleStand(standId: string) {
    setSelectedStandIds(prev => prev.includes(standId) ? prev.filter(id => id !== standId) : [...prev, standId])
  }

  async function save(): Promise<boolean> {
    const { error } = await sb.from('user_evenements')
      .update({ role_local: role, prestataire_id: role === 'prestataire' ? prestaId : null })
      .eq('id', acces.id)
    if (error) { setError(error.message); return false }
    if (role === 'controleur') {
      await sb.from('controleur_stands').delete().eq('user_evenement_id', acces.id)
      if (selectedStandIds.length) {
        await sb.from('controleur_stands').insert(
          selectedStandIds.map(standId => ({ user_evenement_id: acces.id, stand_id: standId }))
        )
      }
    } else {
      await sb.from('controleur_stands').delete().eq('user_evenement_id', acces.id)
    }
    onClose(); return true
  }

  return (
    <Modal title={`Modifier l'accès — ${acces.users?.prenom} ${acces.users?.nom}`} confirmLabel="Enregistrer" onClose={onClose} onConfirm={save}>
      <Alert message={error} />
      <div className="form-group">
        <label>Rôle</label>
        <select value={role} onChange={e => setRole(e.target.value as RoleLocal)}>
          <option value="organisateur">Organisateur</option>
          <option value="controleur">Contrôleur</option>
          <option value="prestataire">Prestataire</option>
        </select>
      </div>
      {role === 'prestataire' && (
        <div className="form-group">
          <label>Société prestataire</label>
          <select value={prestaId} onChange={e => setPrestaId(e.target.value)}>
            {prestataires.map(p => <option key={p.id} value={p.id}>{p.raison_sociale}</option>)}
          </select>
        </div>
      )}
      {role === 'controleur' && (
        <div className="form-group">
          <label>Stands affectés</label>
          {stands.length === 0 ? (
            <div className="text-muted" style={{ fontSize: 13 }}>Aucun stand pour cet événement.</div>
          ) : (
            <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px' }}>
              {stands.map(s => (
                <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={selectedStandIds.includes(s.id)} onChange={() => toggleStand(s.id)} style={{ width: 'auto', margin: 0 }} />
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{s.numero}</span>
                  {s.nom_exposant && <span className="text-muted" style={{ fontSize: 12 }}>{s.nom_exposant}</span>}
                  {s.hall && <span className="text-muted" style={{ fontSize: 11 }}>· Hall {s.hall}</span>}
                </label>
              ))}
            </div>
          )}
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            {selectedStandIds.length} stand{selectedStandIds.length > 1 ? 's' : ''} sélectionné{selectedStandIds.length > 1 ? 's' : ''}
          </div>
        </div>
      )}
    </Modal>
  )
}
