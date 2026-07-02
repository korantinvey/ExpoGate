import { useState } from 'react'
import { sb } from '../../lib/supabase'
import { Modal } from '../../components/ui/Modal'
import { Alert } from '../../components/ui/Alert'
import { ImportZone } from '../../components/ui/ImportZone'
import { downloadTemplate } from '../../lib/excel'

export function ImportStandsModal({ evenementId, nomEvenement, onDone }: { evenementId: string; nomEvenement: string; onDone: () => void }) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [error, setError] = useState('')

  async function doImport(): Promise<boolean> {
    if (!rows.length) { setError('Veuillez sélectionner un fichier.'); return false }
    const payload = rows.map(r => ({
      evenement_id: evenementId,
      nom_exposant: (r.nom_exposant as string) || null,
      hall: (r.hall as string) || null,
      numero: String(r.numero ?? '').trim(),
      surface: r.surface != null && r.surface !== '' ? parseFloat(String(r.surface)) : null,
      angles: r.angles != null && r.angles !== '' ? parseInt(String(r.angles)) : null,
    })).filter(r => r.numero)
    if (!payload.length) { setError('Aucune ligne valide (colonne "numero" requise).'); return false }

    const { data: existing } = await sb.from('stands').select('id, numero').eq('evenement_id', evenementId).eq('deleted', false)
    const existingByNumero = new Map((existing ?? []).map(s => [s.numero, s.id]))
    const toInsert = payload.filter(r => !existingByNumero.has(r.numero))
    const toUpdate = payload.filter(r => existingByNumero.has(r.numero))

    if (toInsert.length) {
      const { error } = await sb.from('stands').insert(toInsert)
      if (error) { setError(error.message); return false }
    }
    for (const row of toUpdate) {
      const { error } = await sb.from('stands').update(row).eq('id', existingByNumero.get(row.numero)!)
      if (error) { setError(error.message); return false }
    }
    onDone(); return true
  }

  return (
    <Modal title={`Importer les stands — ${nomEvenement}`} confirmLabel="Importer" onClose={onDone} onConfirm={doImport}>
      <Alert message={error} />
      <p className="text-muted" style={{ marginBottom: 12 }}>
        Colonnes attendues : <strong>Numéro de stand</strong>, nom_exposant, hall, surface, angles.
      </p>
      <button className="btn btn-secondary btn-sm" style={{ marginBottom: 16 }} onClick={() => downloadTemplate('stands')}>
        ↓ Télécharger le modèle Excel
      </button>
      <ImportZone expectedCols={['nom_exposant', 'hall', 'numero', 'surface', 'angles']} colLabels={{ numero: 'Numéro de stand' }} onRows={setRows} />
    </Modal>
  )
}
