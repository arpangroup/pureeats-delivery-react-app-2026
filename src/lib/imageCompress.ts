/** Longest edge of an uploaded document photo - plenty to read a licence, and well under the server's 5MB limit. */
const MAX_EDGE_PX = 1600

/**
 * Shrinks a camera photo to a JPEG of at most {@link MAX_EDGE_PX} on the long edge. Phone cameras produce
 * 5-15MB images (and iPhones HEIC), which the server rejects - the upload used to fail with a bare
 * "Network Error". Throws a readable message when the browser can't decode the file.
 */
export async function compressImage(file: File, quality = 0.85): Promise<File> {
  let bitmap: Awaited<ReturnType<typeof window.createImageBitmap>>
  try {
    bitmap = await window.createImageBitmap(file)
  } catch {
    throw { message: "Couldn't read this photo. Please take the picture again with your camera (JPEG/PNG)." }
  }
  const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  if (!blob) throw { message: "Couldn't process this photo. Please try again." }
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
}
