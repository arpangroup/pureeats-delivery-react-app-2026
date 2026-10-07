import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Camera, CameraOff, Loader2, X } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { LoadingBlock } from '@/components/ui/Feedback'
import { OrderIdTag } from '@/components/order/OrderMeta'
import { deliveryOrderService, MAX_PICKUP_PHOTOS } from '@/services/deliveryOrderService'
import { useRiderSession } from '@/context/RiderSessionContext'
import { showErrorToast } from '@/lib/errorToast'
import type { PickupPhoto } from '@/types/entities'

/** Longest edge of an uploaded shot - keeps uploads well under the backend's 5MB image limit. */
const MAX_EDGE_PX = 1600

/**
 * Pickup photos of the packed order - camera only (a live camera preview, no file picker, so no
 * gallery or documents), up to 3. The order's items are listed under the camera so the partner can
 * check each one while shooting. At least one photo is required before the order can be marked
 * picked up; the photos show on the admin order details page.
 */
export default function PickupPhotosPage() {
  const { orderId } = useParams()
  const id = Number(orderId)
  const navigate = useNavigate()
  const { activeDeliveries, refreshActiveDeliveries } = useRiderSession()
  const delivery = activeDeliveries?.find((d) => d.id === id)

  const videoRef = useRef<ComponentRef<'video'>>(null)
  const streamRef = useRef<Awaited<ReturnType<typeof navigator.mediaDevices.getUserMedia>> | null>(null)
  const [cameraState, setCameraState] = useState<'starting' | 'ready' | 'unavailable'>('starting')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [photos, setPhotos] = useState<PickupPhoto[] | null>(null)
  const [uploading, setUploading] = useState(false)
  const [removingId, setRemovingId] = useState<number | null>(null)

  const loadPhotos = useCallback(async () => {
    try {
      setPhotos(await deliveryOrderService.listPickupPhotos(id))
    } catch (err) {
      showErrorToast(err, 'Could not load the photos.')
      setPhotos([])
    }
  }, [id])

  useEffect(() => {
    loadPhotos()
  }, [loadPhotos])

  useEffect(() => {
    let cancelled = false
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraState('unavailable')
        setCameraError('This browser has no camera access. Open the app in Chrome on your phone to take pickup photos.')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => undefined)
        }
        setCameraState('ready')
      } catch (err) {
        if (cancelled) return
        setCameraState('unavailable')
        const name = (err as { name?: string })?.name
        setCameraError(
          name === 'NotAllowedError'
            ? 'Camera permission is blocked. Allow camera access for this site in your browser settings, then come back.'
            : 'Could not start the camera.',
        )
      }
    }
    start()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  const count = photos?.length ?? 0
  const full = count >= MAX_PICKUP_PHOTOS

  async function capture() {
    const video = videoRef.current
    if (!video || !video.videoWidth || full) return
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(video.videoWidth, video.videoHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    if (!blob) return
    setUploading(true)
    try {
      await deliveryOrderService.uploadPickupPhoto(id, blob)
      await loadPhotos()
      refreshActiveDeliveries()
    } catch (err) {
      showErrorToast(err, 'Could not save the photo - try again.')
    } finally {
      setUploading(false)
    }
  }

  async function remove(photoId: number) {
    setRemovingId(photoId)
    try {
      await deliveryOrderService.deletePickupPhoto(id, photoId)
      await loadPhotos()
      refreshActiveDeliveries()
    } catch (err) {
      showErrorToast(err, 'Could not remove the photo.')
    } finally {
      setRemovingId(null)
    }
  }

  const totalItems = delivery?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0

  return (
    <div>
      <PageHeader title="Pickup photos" />
      <div className="space-y-4 px-4 py-4 pb-8">
        <div className="flex items-center justify-between">
          {delivery && <OrderIdTag id={delivery.uniqueOrderId} />}
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {count}/{MAX_PICKUP_PHOTOS} photos
          </span>
        </div>

        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-slate-900">
          <video ref={videoRef} playsInline muted autoPlay className="h-full w-full object-cover" />
          {cameraState === 'starting' && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">
              <Loader2 size={20} className="mr-2 animate-spin" /> Starting camera...
            </div>
          )}
          {cameraState === 'unavailable' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-sm text-white/80">
              <CameraOff size={28} />
              {cameraError}
            </div>
          )}
          {cameraState === 'ready' && (
            <button
              type="button"
              onClick={capture}
              disabled={uploading || full}
              aria-label="Take photo"
              className="absolute bottom-4 left-1/2 flex h-16 w-16 -translate-x-1/2 items-center justify-center rounded-full border-4 border-white bg-white/30 text-white backdrop-blur disabled:opacity-50"
            >
              {uploading ? <Loader2 size={24} className="animate-spin" /> : <Camera size={24} />}
            </button>
          )}
          {full && cameraState === 'ready' && (
            <p className="absolute left-3 right-3 top-3 rounded-lg bg-slate-900/70 px-3 py-1.5 text-center text-xs text-white">
              {MAX_PICKUP_PHOTOS} photos taken - remove one to retake it.
            </p>
          )}
        </div>

        {photos === null ? (
          <LoadingBlock />
        ) : (
          count > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((p) => (
                <div key={p.id} className="relative aspect-square overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                  <img src={p.url} alt="Pickup" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => remove(p.id)}
                    disabled={removingId !== null}
                    aria-label="Remove photo"
                    className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/70 text-white"
                  >
                    {removingId === p.id ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                  </button>
                </div>
              ))}
            </div>
          )
        )}

        {delivery && (
          <div className="card p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Check the items</p>
            <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
              {delivery.items.map((item, index) => (
                <li key={index}>
                  {item.quantity} x {item.name}
                </li>
              ))}
            </ul>
            <p className="mt-2 border-t border-slate-100 pt-2 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:text-slate-200">
              Total items: {totalItems}
            </p>
          </div>
        )}

        <button className="btn-primary w-full" onClick={() => navigate('/deliveries/active')} disabled={uploading}>
          {count > 0 ? 'Done' : 'Back'}
        </button>
      </div>
    </div>
  )
}
