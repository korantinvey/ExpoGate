import { useEffect, useState } from 'react'
import { sb, sbAdmin } from '../../lib/supabase'
import { db } from '../../lib/db'
import { Modal } from '../../components/ui/Modal'
import { Alert } from '../../components/ui/Alert'
import type { Stand } from '../../types'

type Responsable = { id: string; role_local: string; users: { nom: string; prenom: string } | null }

export function StandForm({ stand, evenementId, onSaved, canDelete = true }: { stand: Stand | null; evenementId: string; onSaved: () => void; canDelete?: boolean }) {
  const [exposant, setExposant] = useState(stand?.nom_exposant ?? '')
  const [hall, setHall] = useState(stand?.hall ?? '')
  const [numero, setNumero] = useState(stand?.numero ?? '')
  const [surface, setSurface] = useState(stand?.surface != null ? String(stand.surface) : '')
  const [angles, setAngles] = useState(stand?.angles != null ? String(stand.angles) : '')
  const [error, setError] = useState('')
  const [responsables, setResponsables] = useState<Responsable[]>([])
  const [assignedUeId, setAssignedUeId] = useState<string>('')

  useEffect(() => {
    sb.from('user_evenements')
      .select('id, role_local, users(nom, prenom)')
      .eq('evenement_id', evenementId)
      .in('role_local', ['organisateur', 'controleur'])
      .then(({ data }) => setResponsables((data ?? []).map(r => ({
        id: r.id as string,
        role_local: r.role_local as string,
        users: Array.isArray(r.users) ? (r.users[0] ?? null) : (r.users as { nom: string; prenom: string } | null),
      }))))

    if (stand?.id) {
      sb.from('controleur_stands')
        .select('user_evenement_id')
        .eq('stand_id', stand.id)
        .limit(1)
        .maybeSingle()
        .then(({ data }) => { if (data) setAssignedUeId(data.user_evenement_id) })
    }
  }, [evenementId, stand?.id])

  async function saveAssignment(standId: string) {
    await sbAdmin.from('controleur_stands').delete().eq('stand_id', standId)
    if (assignedUeId) {
      await sbAdmin.from('controleur_stands').insert({ user_evenement_id: assignedUeId, stand_id: standId })
    }
  }

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

    if (stand) {
      const { error } = await sb.from('stands').update(payload).eq('id', stand.id)
      if (error) { setError(error.message); return false }
      await saveAssignment(stand.id)
    } else {
      const { data, error } = await sb.from('stands').insert(payload).select('id').single()
      if (error || !data) { setError(error?.message ?? 'Erreur création stand'); return false }
      await saveAssignment(data.id)
    }

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
        {responsables.length > 0 && (
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label>Responsable</label>
            <select value={assignedUeId} onChange={e => setAssignedUeId(e.target.value)}>
              <option value="">— Aucun —</option>
              {responsables.map(r => (
                <option key={r.id} value={r.id}>
                  {r.users?.prenom} {r.users?.nom}{r.role_local === 'controleur' ? ' (contrôleur)' : ' (organisateur)'}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </Modal>
  )
}
