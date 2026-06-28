import { sb, sbAdmin } from './supabase'
import { db } from './db'
import { compressImage } from './compressImage'

export async function downloadEvent(eventId: string): Promise<void> {
  const [{ data: ev, error: evErr }, { data: stands, error: standsErr }] = await Promise.all([
    sb.from('evenements').select('id, nom, lieu, date_debut, date_fin, statut').eq('id', eventId).single(),
    sb.from('stands').select('id, evenement_id, nom_exposant, hall, numero').eq('evenement_id', eventId).order('numero'),
  ])
  if (evErr || !ev) throw new Error(evErr?.message ?? 'Événement introuvable')
  if (standsErr || !stands) throw new Error(standsErr?.message ?? 'Stands introuvables')

  const standIds = stands.map(s => s.id)
  const { data: prestations } = standIds.length
    ? await sb.from('prestations')
        .select('id, stand_id, libelle, categorie, quantite_attendue, emplacement_prevu, ajout_sur_site, statut_conformite, quantite_constatee, commentaire, controleur_id, date_controle')
        .in('stand_id', standIds)
    : { data: [] }

  await db.transaction('rw', [db.evenements, db.stands, db.prestations], async () => {
    await db.evenements.put({ ...ev, downloaded_at: new Date().toISOString() })
    await db.stands.bulkPut(stands)
    if (prestations?.length) {
      // Ne pas écraser les prestations avec des changements locaux non synchronisés
      const pendingIds = new Set(
        await db.prestations.where('pending_sync').equals(1).primaryKeys()
      )
      const toWrite = prestations
        .filter(p => !pendingIds.has(p.id))
        .map(p => ({ ...p, pending_sync: 0 as const }))
      await db.prestations.bulkPut(toWrite)
    }
  })
}

export async function syncPending(): Promise<number> {
  let count = 0

  // Sync des prestations modifiées hors ligne
  const pending = await db.prestations.where('pending_sync').equals(1).toArray()
  await Promise.allSettled(pending.map(async p => {
    const { error } = await sb.from('prestations').update({
      statut_conformite: p.statut_conformite,
      quantite_constatee: p.quantite_constatee,
      commentaire: p.commentaire,
      controleur_id: p.controleur_id,
      date_controle: p.date_controle,
    }).eq('id', p.id)
    if (!error) {
      await db.prestations.update(p.id, { pending_sync: 0 })
      count++
    }
  }))

  // Sync des photos prises hors ligne
  const pendingPhotos = await db.photos.where('synced').equals(0).toArray()
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE as string

  for (const photo of pendingPhotos) {
    try {
      const file = new File([photo.blob], 'photo.jpg', { type: 'image/jpeg' })
      const compressed = await compressImage(file)
      const path = `${photo.prestation_id}/${crypto.randomUUID()}.jpg`
      const res = await fetch(`${supabaseUrl}/storage/v1/object/Photos/${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'image/jpeg',
          'x-upsert': 'false',
        },
        body: compressed,
      })
      if (res.ok) {
        const publicUrl = `${supabaseUrl}/storage/v1/object/public/Photos/${path}`
        await sbAdmin.from('photos').insert({ prestation_id: photo.prestation_id, url: publicUrl, synced: true })
        await db.photos.update(photo.id!, { synced: 1, remote_url: publicUrl })
        count++
      }
    } catch {
      // Sera réessayé à la prochaine sync
    }
  }

  return count
}

export async function getPendingCount(): Promise<number> {
  const [prests, photos] = await Promise.all([
    db.prestations.where('pending_sync').equals(1).count(),
    db.photos.where('synced').equals(0).count(),
  ])
  return prests + photos
}
