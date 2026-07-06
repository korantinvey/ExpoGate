import { useState } from 'react'
import { sb } from '../lib/supabase'
import { Modal } from './ui/Modal'
import { Alert } from './ui/Alert'
import { DateInput } from './ui/DateInput'
import type { Evenement, EvenementStatut } from '../types'

interface EvenementFormProps {
  ev: Evenement | null
  onSaved: () => void
  /** Si false, masque l'option "Paramétrage" (utilisé côté organisateur) */
  showParametrage?: boolean
}

export function EvenementForm({ ev, onSaved, showParametrage = true }: EvenementFormProps) {
  const [nom, setNom] = useState(ev?.nom ?? '')
  const [lieu, setLieu] = useState(ev?.lieu ?? '')
  const [debut, setDebut] = useState(ev?.date_debut ?? '')
  const [fin, setFin] = useState(ev?.date_fin ?? '')
  const [statut, setStatut] = useState<EvenementStatut>(ev?.statut ?? 'parametrage')
  const [error, setError] = useState('')

  async function save(): Promise<boolean> {
    if (!nom || !debut || !fin) { setError('Nom et dates sont obligatoires.'); return false }
    const payload = { nom, lieu: lieu || null, date_debut: debut, date_fin: fin, statut }
    const { error: err } = ev
      ? await sb.from('evenements').update(payload).eq('id', ev.id)
      : await sb.from('evenements').insert(payload)
    if (err) { setError(err.message); return false }
    onSaved()
    return true
  }

  return (
    <Modal
      title={ev ? "Modifier l'événement" : 'Nouvel événement'}
      confirmLabel={ev ? 'Enregistrer' : 'Créer'}
      onClose={onSaved}
      onConfirm={save}
    >
      <Alert message={error} />
      <div className="grid-2">
        <div className="form-group" style={{ gridColumn: '1/-1' }}>
          <label>Nom de l'événement</label>
          <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Ex: Salon du Meuble Paris 2025" />
        </div>
        <div className="form-group">
          <label>Date de début</label>
          <DateInput value={debut} onChange={setDebut} />
        </div>
        <div className="form-group">
          <label>Date de fin</label>
          <DateInput value={fin} onChange={setFin} defaultMonth={debut} />
        </div>
        <div className="form-group" style={{ gridColumn: '1/-1' }}>
          <label>Lieu</label>
          <input value={lieu} onChange={e => setLieu(e.target.value)} placeholder="Ex: Paris Expo Porte de Versailles" />
        </div>
        <div className="form-group" style={{ gridColumn: '1/-1' }}>
          <label>Statut</label>
          <select value={statut} onChange={e => setStatut(e.target.value as EvenementStatut)}>
            {showParametrage && <option value="parametrage">Paramétrage</option>}
            <option value="actif">Actif</option>
            <option value="termine">Terminé</option>
          </select>
        </div>
      </div>
    </Modal>
  )
}
