import { useState } from 'react'
import { sb } from '../../lib/supabase'
import { Modal } from '../../components/ui/Modal'
import { Alert } from '../../components/ui/Alert'
import { normalizeNom, normalizePrenom } from '../../lib/normalize'
import type { UserEvenement } from '../../types'

export function EditMembreModal({ membre, onClose }: { membre: UserEvenement; onClose: () => void }) {
  const [prenom, setPrenom] = useState(membre.users?.prenom ?? '')
  const [nom, setNom] = useState(membre.users?.nom ?? '')
  const [error, setError] = useState('')

  async function save(): Promise<boolean> {
    if (!prenom || !nom) { setError('Prénom et nom sont obligatoires.'); return false }
    const { error } = await sb.from('users').update({ prenom, nom }).eq('id', membre.user_id)
    if (error) { setError(error.message); return false }
    onClose(); return true
  }

  return (
    <Modal title={`Modifier — ${membre.users?.prenom} ${membre.users?.nom}`} confirmLabel="Enregistrer" onClose={onClose} onConfirm={save}>
      <Alert message={error} />
      <div className="grid-2">
        <div className="form-group"><label>Prénom</label><input value={prenom} onChange={e => setPrenom(e.target.value)} onBlur={() => setPrenom(normalizePrenom(prenom))} /></div>
        <div className="form-group"><label>Nom</label><input value={nom} onChange={e => setNom(e.target.value)} onBlur={() => setNom(normalizeNom(nom))} /></div>
      </div>
      <div className="form-group">
        <label>Email</label>
        <input value={membre.users?.email ?? ''} disabled />
      </div>
    </Modal>
  )
}
