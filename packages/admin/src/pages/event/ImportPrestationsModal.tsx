import { useState } from 'react'
import { sb } from '../../lib/supabase'
import { Modal } from '../../components/ui/Modal'
import { Alert } from '../../components/ui/Alert'
import { ImportZone } from '../../components/ui/ImportZone'
import { downloadTemplate } from '../../lib/excel'
import type { Prestataire } from '../../types'
import type { UnknownPresta } from './helpers'

export function ImportPrestationsModal({ evenementId, onDone }: { evenementId: string; onDone: () => void }) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [error, setError] = useState('')
  const [step, setStep] = useState<'upload' | 'resolve' | 'done'>('upload')
  const [unknowns, setUnknowns] = useState<UnknownPresta[]>([])
  const [allPrestataires, setAllPrestataires] = useState<Prestataire[]>([])
  const [allStands, setAllStands] = useState<{ id: string; numero: string; hall: string | null }[]>([])

  async function doImport(): Promise<boolean> {
    if (step === 'done') { onDone(); return true }
    return step === 'upload' ? handleUpload() : handleResolve()
  }

  async function handleUpload(): Promise<boolean> {
    if (!rows.length) { setError('Veuillez sélectionner un fichier.'); return false }
    const [{ data: stands }, { data: prestas }] = await Promise.all([
      sb.from('stands').select('id, numero, hall').eq('evenement_id', evenementId).eq('deleted', false),
      sb.from('prestataires').select('*').order('raison_sociale'),
    ])
    const s = stands ?? []; const p = prestas ?? []
    setAllStands(s); setAllPrestataires(p)
    const prestaMap = new Map(p.map(pr => [pr.raison_sociale.trim().toLowerCase(), pr.id]))

    const seen = new Set<string>()
    const unknownList: UnknownPresta[] = []
    rows.forEach(r => {
      const v = String(r.raison_sociale_prestataire ?? '').trim()
      if (v && !prestaMap.has(v.toLowerCase()) && !seen.has(v.toLowerCase())) {
        seen.add(v.toLowerCase()); unknownList.push({ value: v, action: 'create', mappedId: p[0]?.id ?? '' })
      }
    })
    if (unknownList.length) { setUnknowns(unknownList); setError(''); setStep('resolve'); return false }
    return doInsert(s, prestaMap, {})
  }

  async function handleResolve(): Promise<boolean> {
    const prestaMap = new Map(allPrestataires.map(p => [p.raison_sociale.trim().toLowerCase(), p.id]))
    const resolvedMap: Record<string, string | null> = {}
    for (const u of unknowns) {
      if (u.action === 'map') {
        if (!u.mappedId) { setError(`Choisissez un prestataire pour « ${u.value} ».`); return false }
        resolvedMap[u.value.toLowerCase()] = u.mappedId
      } else {
        const { data: newP, error: createErr } = await sb.from('prestataires').insert({ raison_sociale: u.value }).select('id').single()
        if (createErr || !newP) { setError(`Impossible de créer « ${u.value} » : ${createErr?.message}`); return false }
        resolvedMap[u.value.toLowerCase()] = newP.id
      }
    }
    return doInsert(allStands, prestaMap, resolvedMap)
  }

  async function doInsert(
    stands: { id: string; numero: string; hall: string | null }[],
    prestaMap: Map<string, string>,
    resolvedMap: Record<string, string | null>
  ): Promise<boolean> {
    const standMapFull = Object.fromEntries(stands.map(s => [`${String(s.hall ?? '').trim().toLowerCase()}|${String(s.numero).trim().toLowerCase()}`, s.id]))
    const standMapNum = Object.fromEntries(stands.map(s => [String(s.numero).trim().toLowerCase(), s.id]))
    const toInsert: object[] = []; const erreurs: string[] = []
    rows.forEach((r, i) => {
      const numStand = String(r.numero_stand ?? '').trim()
      const hallStand = String(r.hall_stand ?? '').trim()
      const libelle = String(r.libelle ?? '').trim()
      if (!numStand || !libelle) return
      const standId = hallStand ? standMapFull[`${hallStand.toLowerCase()}|${numStand.toLowerCase()}`] : standMapNum[numStand.toLowerCase()]
      const raisonSociale = String(r.raison_sociale_prestataire ?? '').trim()
      const prestaId = raisonSociale ? (resolvedMap[raisonSociale.toLowerCase()] ?? prestaMap.get(raisonSociale.toLowerCase()) ?? null) : null
      if (!standId) { erreurs.push(`Ligne ${i + 2} : stand "${hallStand ? hallStand + ' / ' : ''}${numStand}" introuvable`); return }
      toInsert.push({ stand_id: standId, libelle, categorie: (r.categorie as string) || null, quantite_attendue: Math.max(1, parseInt(String(r.quantite)) || 0), emplacement_prevu: (r.position as string) || null, prestataire_id: prestaId })
    })
    if (!toInsert.length) { setError(erreurs.length ? `Aucune ligne valide. ${erreurs.slice(0, 5).join(' · ')}` : 'Aucune ligne valide.'); return false }
    const { error } = await sb.from('prestations').insert(toInsert)
    if (error) { setError(error.message); return false }
    if (erreurs.length) {
      setError(`${toInsert.length} prestation(s) importée(s). ${erreurs.length} ligne(s) ignorée(s) : ${erreurs.slice(0, 5).join(' · ')}`)
      setStep('done')
      return false
    }
    onDone(); return true
  }

  return (
    <Modal title="Importer les prestations" confirmLabel={step === 'done' ? 'Fermer' : step === 'resolve' ? 'Importer' : 'Continuer'} onClose={onDone} onConfirm={doImport}>
      <Alert message={error} />
      {step === 'upload' ? (
        <>
          <p className="text-muted" style={{ marginBottom: 12 }}>
            Colonnes : <strong>numero_stand</strong>, <strong>libelle</strong>, categorie, quantite, emplacement, <strong>raison_sociale_prestataire</strong>.
          </p>
          <button className="btn btn-secondary btn-sm" style={{ marginBottom: 16 }} onClick={() => downloadTemplate('prestations')}>
            ↓ Télécharger le modèle Excel
          </button>
          <ImportZone expectedCols={['numero_stand', 'hall_stand', 'libelle', 'categorie', 'quantite', 'position', 'raison_sociale_prestataire']} onRows={setRows} />
        </>
      ) : (
        <>
          <p style={{ fontSize: 14, marginBottom: 16, color: 'var(--text-muted)' }}>
            {unknowns.length} prestataire{unknowns.length > 1 ? 's' : ''} non reconnu{unknowns.length > 1 ? 's' : ''} dans la base. Choisissez comment les traiter :
          </p>
          {unknowns.map((u, i) => (
            <div key={u.value} style={{ marginBottom: 12, padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>« {u.value} »</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 8, cursor: 'pointer' }}>
                <input type="radio" checked={u.action === 'create'} onChange={() => setUnknowns(prev => prev.map((x, j) => j === i ? { ...x, action: 'create' } : x))} />
                Créer comme nouveau prestataire
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                <input type="radio" checked={u.action === 'map'} onChange={() => setUnknowns(prev => prev.map((x, j) => j === i ? { ...x, action: 'map' } : x))} />
                Associer à un prestataire existant
              </label>
              {u.action === 'map' && (
                <select value={u.mappedId} onChange={e => setUnknowns(prev => prev.map((x, j) => j === i ? { ...x, mappedId: e.target.value } : x))} style={{ marginTop: 8, marginLeft: 26, fontSize: 13, padding: '4px 8px' }}>
                  <option value="">— Choisir —</option>
                  {allPrestataires.map(p => <option key={p.id} value={p.id}>{p.raison_sociale}</option>)}
                </select>
              )}
            </div>
          ))}
        </>
      )}
    </Modal>
  )
}
