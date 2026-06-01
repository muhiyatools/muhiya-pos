import { supabase } from './supabase'

export interface UploadImageOptions {
  file: File
  bucket: string
  path: string
  maxWidth?: number
  maxHeight?: number
  quality?: number
}

export interface UploadResult {
  publicUrl: string
  storagePath: string
  error: Error | null
}

/**
 * Compress and resize image client-side before upload
 * Max 1200px on longest side, quality 0.82
 */
export async function compressImage(
  file: File,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.82
): Promise<Blob> {
  // Preserve PNG format for transparency (logos etc.)
  const isPng = file.type === 'image/png'
  const outputType = isPng ? 'image/png' : 'image/jpeg'

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (e) => {
      const img = new Image()
      img.src = e.target?.result as string
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height

        // Calculate new dimensions maintaining aspect ratio
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width)
          width = maxWidth
        }
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height)
          height = maxHeight
        }

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }

        // For PNG: clear canvas to preserve transparency
        if (isPng) {
          ctx.clearRect(0, 0, width, height)
        }

        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob)
            else reject(new Error('Failed to compress image'))
          },
          outputType,
          isPng ? undefined : quality
        )
      }
      img.onerror = () => reject(new Error('Failed to load image'))
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
  })
}

/**
 * Upload image to Supabase Storage with compression
 */
export async function uploadImage({
  file,
  bucket,
  path,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.82,
}: UploadImageOptions): Promise<UploadResult> {
  try {
    // Compress image
    const compressedBlob = await compressImage(file, maxWidth, maxHeight, quality)

    // Preserve PNG for transparency, otherwise use JPEG
    const isPng = file.type === 'image/png'
    const ext = isPng ? '.png' : '.jpg'
    const contentType = isPng ? 'image/png' : 'image/jpeg'

    // Create new file with compressed data
    const compressedFile = new File([compressedBlob], file.name.replace(/\.[^/.]+$/, ext), {
      type: contentType,
    })

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, compressedFile, {
        contentType,
        cacheControl: '3600',
        upsert: true,
      })

    if (error) throw error

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path)

    return {
      publicUrl: urlData.publicUrl,
      storagePath: data.path,
      error: null,
    }
  } catch (err) {
    return {
      publicUrl: '',
      storagePath: '',
      error: err instanceof Error ? err : new Error('Unknown error during upload'),
    }
  }
}

/**
 * Delete image from Supabase Storage
 */
export async function deleteImage(bucket: string, path: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.storage.from(bucket).remove([path])
  return { error: error instanceof Error ? error : null }
}

/**
 * Generate initials from name for placeholder
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n.charAt(0))
    .join('')
    .toUpperCase()
}
