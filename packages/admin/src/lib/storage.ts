import { sb } from './supabase'
import { compressImage } from './compressImage'

/**
 * Upload une image dans le bucket "Photos" et retourne son URL publique.
 * Nécessite une bucket policy INSERT pour les utilisateurs authentifiés.
 * Path format pour prestations : `${prestationId}/${uuid}.jpg`
 * Path format pour main courante : `main-courante/${mcId}/${uuid}.jpg`
 */
export async function uploadPhoto(blob: Blob, path: string): Promise<string> {
  const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' })
  let compressed: File
  try { compressed = await compressImage(file) } catch { compressed = file }

  const { error } = await sb.storage.from('Photos').upload(path, compressed, {
    contentType: 'image/jpeg',
    upsert: false,
  })
  if (error) throw error

  const { data } = sb.storage.from('Photos').getPublicUrl(path)
  return data.publicUrl
}
