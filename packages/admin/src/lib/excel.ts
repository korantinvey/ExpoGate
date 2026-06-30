import * as XLSX from 'xlsx'

const TEMPLATES = {
  stands: {
    filename: 'modele_stands.xlsx',
    sheetName: 'Stands',
    headers: ['nom_exposant', 'hall', 'numero', 'surface', 'angles'],
    example: [
      ['Société Dupont Mobilier', 'Hall 3', 'A12', 24.50, 2],
      ['Tech Innovations SARL', 'Hall 3', 'A13', 18, 1],
    ],
  },
  prestations: {
    filename: 'modele_prestations.xlsx',
    sheetName: 'Prestations',
    headers: ['numero_stand', 'hall_stand', 'libelle', 'categorie', 'quantite', 'position', 'raison_sociale_prestataire'],
    example: [
      ['A12', 'Hall 3', 'Mange-debout haut', 'Mobilier', 4, 'Fond de stand', 'Carpentier Décoration SARL'],
      ['A12', 'Hall 3', 'Spot LED orientable', 'Éclairage', 6, '', 'Elec Events'],
    ],
  },
}

export function downloadTemplate(kind: 'stands' | 'prestations') {
  const t = TEMPLATES[kind]
  const ws = XLSX.utils.aoa_to_sheet([t.headers, ...t.example])
  ws['!cols'] = t.headers.map(h => ({ wch: Math.max(h.length + 4, 16) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, t.sheetName)
  XLSX.writeFile(wb, t.filename)
}
