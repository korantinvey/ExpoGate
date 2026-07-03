import { sb, sbAdmin } from './supabase'
import { db } from './db'
import { compressImage } from './compressImage'

export async function downloadEvent(eventId: string, role_local?: string): Promise<void> {
  const [{ data: ev, error: evErr }, { data: stands, error: standsErr }, { data: epRows }] = await Promise.all([
    sb.from('evenements').select('id, nom, lieu, date_debut, date_fin, statut').eq('id', eventId).single(),
    sb.from('stands').select('id, evenement_id, nom_exposant, hall, numero, surface, angles').eq('evenement_id', eventId).eq('deleted', false).order('numero'),
    sb.from('evenement_prestataires').select('prestataires(id, raison_sociale, email_contact, telephone)').eq('evenement_id', eventId),
  ])
  if (evErr || !ev) throw new Error(evErr?.message ?? 'Événement introuvable')
  if (standsErr || !stands) throw new Error(standsErr?.message ?? 'Stands introuvables')

  // Met en cache les prestataires de l'événement pour les formulaires hors ligne
  const prestataires = (epRows ?? []).map(r => r.prestataires as unknown as { id: string; raison_sociale: string; email_contact: string | null; telephone: string | null }).filter(Boolean)
  if (prestataires.length) {
    db.prestataires.bulkPut(prestataires).catch(() => {})
  }

  const standIds = stands.map(s => s.id)
  const { data: rawPrestations, error: prestsErr } = standIds.length
    ? await sb.from('prestations')
        .select('id, stand_id, prestataire_id, libelle, categorie, quantite_attendue, emplacement_prevu, ajout_sur_site, commentaire_prestataire, statut_conformite, quantite_constatee, commentaire, controleur_id, date_controle')
        .in('stand_id', standIds)
        .eq('deleted', false)
    : { data: [], error: null }
  if (prestsErr) throw new Error(prestsErr.message)
  const prestations = rawPrestations ?? []

  await db.transaction('rw', [db.evenements, db.stands, db.prestations], async () => {
    await db.evenements.put({ ...ev, downloaded_at: new Date().toISOString(), role_local: role_local ?? null })
    const pendingStandIds = new Set(
      await db.stands.where('pending_sync').equals(1).primaryKeys()
    )
    const standsToWrite = stands
      .filter(s => !pendingStandIds.has(s.id))
      .map(s => ({ ...s, pending_sync: 0 as const }))
    if (standsToWrite.length) await db.stands.bulkPut(standsToWrite)
    const serverStandIds = new Set(stands.map(s => s.id))
    const localStandIds = await db.stands.where('evenement_id').equals(eventId).primaryKeys() as string[]
    const standsToDelete = localStandIds.filter(id => !serverStandIds.has(id) && !pendingStandIds.has(id))
    if (standsToDelete.length) await db.stands.bulkDelete(standsToDelete)
    const pendingIds = new Set(
      await db.prestations.where('pending_sync').equals(1).primaryKeys()
    )
    const toWrite = prestations
      .filter(p => !pendingIds.has(p.id))
      .map(p => ({ ...p, pending_sync: 0 as const }))
    if (toWrite.length) await db.prestations.bulkPut(toWrite)
    const serverIds = new Set(prestations.map(p => p.id))
    const localIds = await db.prestations.where('stand_id').anyOf(standIds).primaryKeys() as string[]
    const toDelete = localIds.filter(id => !serverIds.has(id) && !pendingIds.has(id))
    if (toDelete.length) await db.prestations.bulkDelete(toDelete)
  })
}

export async function syncPending(): Promise<number> {
  let count = 0

  // Sync des stands créés ou modifiés hors ligne
  const pendingStands = await db.stands.where('pending_sync').equals(1).toArray()
  await Promise.allSettled(pendingStands.map(async s => {
    const { error } = await sb.from('stands').upsert({
      id: s.id,
      evenement_id: s.evenement_id,
      nom_exposant: s.nom_exposant,
      hall: s.hall,
      numero: s.numero,
      surface: s.surface,
      angles: s.angles,
    }, { onConflict: 'id' })
    if (!error) {
      await db.stands.update(s.id, { pending_sync: 0 })
      count++
    }
  }))

  // Sync des prestations créées ou modifiées hors ligne
  const pending = await db.prestations.where('pending_sync').equals(1).toArray()
  await Promise.allSettled(pending.map(async p => {
    const { error } = await sb.from('prestations').upsert({
      id: p.id,
      stand_id: p.stand_id,
      prestataire_id: p.prestataire_id,
      libelle: p.libelle,
      categorie: p.categorie,
      quantite_attendue: p.quantite_attendue,
      emplacement_prevu: p.emplacement_prevu,
      ajout_sur_site: p.ajout_sur_site,
      commentaire_prestataire: p.commentaire_prestataire,
      statut_conformite: p.statut_conformite,
      quantite_constatee: p.quantite_constatee,
      commentaire: p.commentaire,
      controleur_id: p.controleur_id,
      date_controle: p.date_controle,
    }, { onConflict: 'id' })
    if (!error) {
      await db.prestations.update(p.id, { pending_sync: 0 })
      count++
    }
  }))

  // Envoi des notifications différées (non-conformité/absent saisies hors ligne)
  const pendingNotifs = await db.pending_notifications.toArray()
  if (pendingNotifs.length) {
    const { data: { session } } = await sb.auth.getSession()
    if (session?.access_token) {
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
      const notifUrl = `${import.meta.env.VITE_SUPABASE_URL as string}/functions/v1/notify-non-conformite`
      for (const notif of pendingNotifs) {
        const p = await db.prestations.get(notif.prestation_id)
        if (p?.pending_sync === 1) continue
        try {
          const res = await fetch(notifUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
              'apikey': anonKey,
            },
            body: JSON.stringify({ prestation_id: notif.prestation_id }),
          })
          if (res.ok) await db.pending_notifications.delete(notif.prestation_id)
        } catch { /* sera réessayé à la prochaine sync */ }
      }
    }
  }

  // Sync des entrées main courante créées/modifiées hors ligne
  const pendingMcs = await db.main_courante.where('pending_sync').equals(1).toArray()
  await Promise.allSettled(pendingMcs.map(async mc => {
    const { error } = await sb.from('main_courante').upsert({
      id: mc.id,
      evenement_id: mc.evenement_id,
      stand_id: mc.stand_id,
      titre: mc.titre,
      descriptif: mc.descriptif,
      etat: mc.etat,
      created_at: mc.created_at,
      created_by: mc.created_by,
    }, { onConflict: 'id' })
    if (!error) {
      await db.main_courante.update(mc.id, { pending_sync: 0 })
      count++
    }
  }))

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE as string

  // Sync des photos prises hors ligne (prestations)
  const pendingPhotos = await db.photos.where('synced').equals(0).toArray()
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

  // Sync des photos main courante prises hors ligne
  const pendingMcPhotos = await db.mc_photos.where('synced').equals(0).toArray()
  for (const photo of pendingMcPhotos) {
    try {
      const file = new File([photo.blob], 'photo.jpg', { type: 'image/jpeg' })
      const compressed = await compressImage(file)
      const path = `main-courante/${photo.main_courante_id}/${crypto.randomUUID()}.jpg`
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
        await sbAdmin.from('main_courante_photos').insert({ main_courante_id: photo.main_courante_id, url: publicUrl })
        await db.mc_photos.update(photo.id!, { synced: 1, remote_url: publicUrl })
        count++
      }
    } catch {
      // Sera réessayé à la prochaine sync
    }
  }

  return count
}

export async function getPendingCount(): Promise<number> {
  const [stands, prests, photos, mcs, mcPhotos] = await Promise.all([
    db.stands.where('pending_sync').equals(1).count(),
    db.prestations.where('pending_sync').equals(1).count(),
    db.photos.where('synced').equals(0).count(),
    db.main_courante.where('pending_sync').equals(1).count(),
    db.mc_photos.where('synced').equals(0).count(),
  ])
  return stands + prests + photos + mcs + mcPhotos
}
