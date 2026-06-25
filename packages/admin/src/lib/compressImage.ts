const MAX_SIZE_BYTES = 900 * 1024 // 900 Ko — marge par rapport à la limite Supabase
const MAX_DIMENSION = 1920             // px — côté le plus long
const INITIAL_QUALITY = 0.82

export async function compressImage(file: File): Promise<File> {
  // Pas d'image ou déjà sous le seuil et pas trop grande → on vérifie quand même la dimension
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      let { width, height } = img

      // Redimensionner si nécessaire en conservant le ratio
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width >= height) {
          height = Math.round((height / width) * MAX_DIMENSION)
          width = MAX_DIMENSION
        } else {
          width = Math.round((width / height) * MAX_DIMENSION)
          height = MAX_DIMENSION
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)

      // Compression progressive : on descend la qualité jusqu'à passer sous 1 Mo
      let quality = INITIAL_QUALITY
      const tryCompress = () => {
        canvas.toBlob(blob => {
          if (!blob) { reject(new Error('Compression échouée')); return }
          if (blob.size <= MAX_SIZE_BYTES || quality <= 0.4) {
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
          } else {
            quality -= 0.08
            tryCompress()
          }
        }, 'image/jpeg', quality)
      }
      tryCompress()
    }
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Image invalide')) }
    img.src = objectUrl
  })
}
