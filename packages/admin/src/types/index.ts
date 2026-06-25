export type EvenementStatut = 'parametrage' | 'actif' | 'termine'
export type RoleLocal = 'organisateur' | 'prestataire'
export type ControleStatut = 'conforme' | 'non_conforme' | 'absent' | 'a_verifier'

export interface Evenement {
  id: string
  nom: string
  lieu: string | null
  date_debut: string
  date_fin: string
  statut: EvenementStatut
  created_at: string
}

export interface User {
  id: string
  email: string
  nom: string
  prenom: string
  is_admin: boolean
  created_at: string
}

export interface Prestataire {
  id: string
  raison_sociale: string
  email_contact: string | null
  telephone: string | null
  created_at: string
}

export interface PrestataireContact {
  id: string
  user_id: string
  prestataire_id: string
  users?: Pick<User, 'id' | 'nom' | 'prenom' | 'email'>
}

export interface Stand {
  id: string
  evenement_id: string
  nom_exposant: string | null
  hall: string | null
  numero: string
  surface: number | null
  angles: number | null
}

export interface Prestation {
  id: string
  stand_id: string
  prestataire_id: string | null
  libelle: string
  categorie: string | null
  quantite_attendue: number
  emplacement_prevu: string | null
  ajout_sur_site: boolean
  // Conformité
  statut_conformite: ControleStatut | null
  quantite_constatee: number | null
  commentaire: string | null
  commentaire_prestataire: string | null
  controleur_id: string | null
  date_controle: string | null
  // Jointures
  stands?: Pick<Stand, 'numero' | 'nom_exposant'>
  prestataires?: Pick<Prestataire, 'raison_sociale'>
  users?: Pick<User, 'nom' | 'prenom'>
}

export interface Photo {
  id: string
  prestation_id: string
  url: string | null
  url_local: string | null
  synced: boolean
  prise_le: string
}

export interface UserEvenement {
  id: string
  user_id: string
  evenement_id: string
  role_local: RoleLocal
  prestataire_id: string | null
  users?: Pick<User, 'nom' | 'prenom' | 'email'>
  prestataires?: Pick<Prestataire, 'raison_sociale'>
}
