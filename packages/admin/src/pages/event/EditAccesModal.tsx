import { useEffect, useState } from 'react'
import { sb } from '../../lib/supabase'
import { Modal } from '../../components/ui/Modal'
import { Alert } from '../../components/ui/Alert'
import type { Prestataire, UserEvenement, RoleLocal } from '../../types'

export function EditAccesModal({ acces, onClose }: { acces: UserEvenement; onClose: () => void }) {
  const [prestataires, setPrestataires] = useState<Prestataire[]>([])
  const [role, setRole] = useState<RoleLocal>(acces.role_local)
  const [prestaId, setPrestaId] = useState(acces.prestataire_id ?? '')
  const [error, setError] = useState('')

  useEffect(() => {
    sb.from('prestataires').select('*').order('raison_sociale').then(({ data }) => {
      setPrestataires(data ?? [])
      if (!acces.prestataire_id && data?.length) setPrestaId(data[0].id)
    })
  }, [])

  async function save(): Promise<boolean> {
    const { error } = await sb.from('user_evenements')
      .update({ role_local: role, prestataire_id: role === 'prestataire' ? prestaId : null })
      .eq('id', acces.id)
    if (error) { setError(error.message); return false }
    onClose(); return true
  }

  return (
    <Modal title={`Modifier l'accès — ${acces.users?.prenom} ${acces.users?.nom}`} confirmLabel="Enregistrer" onClose={onClose} onConfirm={save}>
      <Alert message={error} />
      <div className="form-group">
        <label>Rôle</label>
        <select value={role} onChange={e => setRole(e.target.value as RoleLocal)}>
          <option value="organisateur">Utilisateur</option>
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
    </Modal>
  )
}
