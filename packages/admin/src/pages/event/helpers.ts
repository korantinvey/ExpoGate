import type { Stand, ControleStatut } from '../../types'

export type StandAvecStatut = Stand & { _statut: 'valide' | 'a_valider' | 'sans_prestation' }

export function categoriserStand(stand: Stand, prestsByStand: Record<string, { statut_conformite: string | null }[]>): StandAvecStatut {
  const prests = prestsByStand[stand.id] ?? []
  if (prests.length === 0) return { ...stand, _statut: 'sans_prestation' }
  return { ...stand, _statut: prests.every(p => p.statut_conformite === 'conforme') ? 'valide' : 'a_valider' }
}

export type BulkStandField = 'hall' | 'nom_exposant' | 'surface' | 'angles'
export type BulkPrestaField = 'prestataire_id' | 'categorie' | 'emplacement_prevu' | 'ajout_sur_site'

export type UnknownPresta = { value: string; action: 'create' | 'map'; mappedId: string }

export const STATUT_LABELS: Record<ControleStatut, string> = {
  conforme: 'Conforme',
  non_conforme: 'Non conforme',
  absent: 'Absent',
  a_verifier: 'À vérifier',
}

export const STATUT_COLORS: Record<ControleStatut, string> = {
  conforme: 'var(--success)',
  non_conforme: '#f97316',
  absent: 'var(--danger)',
  a_verifier: 'var(--text-muted)',
}

const STATUT_ROW_BG: Partial<Record<ControleStatut, string>> = {
  conforme: 'rgba(34,197,94,0.12)',
  non_conforme: 'rgba(249,115,22,0.12)',
  absent: 'rgba(239,68,68,0.12)',
}

export function conformiteBg(statut: ControleStatut | null | undefined): { background: string } | undefined {
  if (!statut) return undefined
  const bg = STATUT_ROW_BG[statut]
  return bg ? { background: bg } : undefined
}
