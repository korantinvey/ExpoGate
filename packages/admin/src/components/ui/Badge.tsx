const LABELS: Record<string, string> = {
  parametrage: 'Paramétrage',
  actif: 'Actif',
  termine: 'Terminé',
  admin: 'Admin',
  organisateur: 'Utilisateur',
  prestataire: 'Prestataire',
}

export function Badge({ statut }: { statut: string }) {
  return (
    <span className={`badge badge-${statut}`}>
      {LABELS[statut] ?? statut}
    </span>
  )
}
