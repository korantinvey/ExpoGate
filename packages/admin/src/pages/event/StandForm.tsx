import { useState } from 'react'
import { sb } from '../../lib/supabase'
import { db } from '../../lib/db'
import { Modal } from '../../components/ui/Modal'
import { Alert } from '../../components/ui/Alert'
import type { Stand } from '../../types'

export function StandForm({ stand, evenementId, onSaved, canDelete = true }: { stand: Stand | null; evenementId: string; onSaved: () => void; canDelete?: boolean }) {
  const [exposant, setExposant] = useState(stand?.nom_exposant ?? '')
  const [hall, setHall] = useState(stand?.hall ?? '')
  const [numero, setNumero] = useState(stand?.numero ?? '')
  const [surface, setSurface] = useState(stand?.surface != null ? String(stand.surface) : '')
  const [angles, setAngles] = useState(stand?.angles != null ? String(stand.angles) : '')
  const [error, setError] = useState('')

  async function save(): Promise<boolean> {
    if (!numero) { setError('Le numéro de stand est obligatoire.'); return false }
    const surfaceVal = surface !== '' ? parseFloat(surface) : null
    const anglesVal = angles !== '' ? parseInt(angles) : null

    if (!navigator.onLine) {
      if (stand?.id) {
        await db.stands.update(stand.id, {
          nom_exposant: exposant || null,
          hall: hall || null,
          numero,
          surface: surfaceVal,
          angles: anglesVal,
          pending_sync: 1,
        })
      } else {
        await db.stands.add({
          id: crypto.randomUUID(),
          evenement_id: evenementId,
          nom_exposant: exposant || null,
          hall: hall || null,
          numero,
          surface: surfaceVal,
          angles: anglesVal,
          pending_sync: 1,
        })
      }
      onSaved(); return true
    }

    const payload = {
      evenement_id: evenementId,
      nom_exposant: exposant || null,
      hall: hall || null,
      numero,
      surface: surfaceVal,
      angles: anglesVal,
    }
    const { error } = stand
      ? await sb.from('stands').update(payload).eq('id', stand.id)
      : await sb.from('stands').insert(payload)
    if (error) { setError(error.message); return false }
    onSaved(); return true
  }

  async function softDelete() {
    if (!confirm(`Supprimer le stand ${stand!.numero} ? Il sera placé dans la corbeille et pourra être restauré.`)) return
    await sb.from('stands').update({ deleted: true }).eq('id', stand!.id)
    onSaved()
  }

  return (
    <Modal title={stand ? 'Modifier le stand' : 'Nouveau stand'} confirmLabel={stand ? 'Enregistrer' : 'Créer'} onClose={onSaved} onConfirm={save}
      footer={canDelete && stand ? <button className="btn btn-danger btn-sm" style={{ marginRight: 'auto' }} onClick={softDelete}>Supprimer</button> : undefined}
    >
      <Alert message={error} />
      <div className="grid-2">
        <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Exposant</label><input value={exposant} onChange={e => setExposant(e.target.value)} /></div>
        <div className="form-group"><label>Hall / Pavillon</label><input value={hall} onChange={e => setHall(e.target.value)} placeholder="Ex: Hall 3" /></div>
        <div className="form-group"><label>Numéro de stand</label><input value={numero} onChange={e => setNumero(e.target.value)} placeholder="Ex: A12" /></div>
        <div className="form-group"><label>Surface (m²)</label><input type="number" min="0" step="0.01" value={surface} onChange={e => setSurface(e.target.value)} placeholder="Ex: 24.50" /></div>
        <div className="form-group"><label>Angles</label><input type="number" min="0" max="4" step="1" value={angles} onChange={e => setAngles(e.target.value)} placeholder="0 – 4" /></div>
      </div>
    </Modal>
  )
}
