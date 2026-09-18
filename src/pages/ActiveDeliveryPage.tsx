import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Store, MapPin, Navigation, Phone, PackageCheck, Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { LoadingBlock, EmptyState, Badge } from '@/components/ui/Feedback'
import { TextInput } from '@/components/ui/FormControls'
import { deliveryOrderService } from '@/services/deliveryOrderService'
import { formatCurrency } from '@/lib/format'
import type { ActiveDelivery } from '@/types/entities'

/** Deep-links out to the phone's own maps app instead of embedding a map - this app has no
 * @react-google-maps/api dependency. */
function mapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
}

export default function ActiveDeliveryPage() {
  const navigate = useNavigate()
  const [delivery, setDelivery] = useState<ActiveDelivery | null | undefined>(undefined)
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    deliveryOrderService.getActiveDelivery().then((d) => {
      if (!cancelled) setDelivery(d)
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function handlePickup() {
    if (!delivery) return
    setBusy(true)
    setError(null)
    try {
      const updated = await deliveryOrderService.pickup(delivery.id)
      setDelivery(updated)
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Could not mark as picked up.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDeliver(e: FormEvent) {
    e.preventDefault()
    if (!delivery) return
    setBusy(true)
    setError(null)
    try {
      const updated = await deliveryOrderService.deliver(delivery.id, pin)
      setDelivery(updated)
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Incorrect PIN.')
    } finally {
      setBusy(false)
    }
  }

  if (delivery === undefined) {
    return (
      <div>
        <PageHeader title="Active delivery" />
        <LoadingBlock />
      </div>
    )
  }

  if (!delivery) {
    return (
      <div>
        <PageHeader title="Active delivery" />
        <EmptyState
          title="No active delivery"
          description="Accept an order to see it here."
          icon={<PackageCheck size={22} />}
          action={
            <button className="btn-primary mt-3" onClick={() => navigate('/orders/available')}>
              Browse orders
            </button>
          }
        />
      </div>
    )
  }

  if (delivery.status === 'DELIVERED') {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15">
          <PackageCheck size={32} />
        </span>
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Delivered!</h2>
        <p className="max-w-xs text-sm text-slate-500 dark:text-slate-400">
          You earned {formatCurrency(delivery.payoutEstimate)} for order {delivery.uniqueOrderId}.
        </p>
        <button className="btn-primary w-full max-w-xs" onClick={() => navigate('/', { replace: true })}>
          Back to home
        </button>
      </div>
    )
  }

  const isHeadingToRestaurant = delivery.status === 'RIDER_ASSIGNED'

  return (
    <div>
      <PageHeader title="Active delivery" />
      <div className="space-y-4 px-4 py-4 pb-8">
        <div className="flex items-center justify-between">
          <Badge tone="brand">{isHeadingToRestaurant ? 'Heading to restaurant' : 'Heading to customer'}</Badge>
          <span className="text-xs text-slate-400">{delivery.uniqueOrderId}</span>
        </div>

        {delivery.mockDeliveryPinHint && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
            Mock mode - test PIN: <span className="font-mono font-semibold">{delivery.mockDeliveryPinHint}</span>. In a live delivery the
            customer reads this out to you; the app never shows it.
          </p>
        )}

        <div className="card p-4">
          <div className="flex gap-3">
            <div className="flex flex-col items-center pt-1">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-500/15">
                <Store size={16} />
              </span>
              <span className="my-1 h-8 w-px border-l border-dashed border-slate-200 dark:border-slate-700" />
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-500/15">
                <MapPin size={16} />
              </span>
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Pickup</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{delivery.restaurantName}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{delivery.restaurantAddress}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Drop</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{delivery.customerName}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{delivery.customerAddress}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <a
            href={isHeadingToRestaurant ? mapsUrl(delivery.restaurantLat, delivery.restaurantLng) : mapsUrl(delivery.customerLat, delivery.customerLng)}
            target="_blank"
            rel="noreferrer"
            className="btn-secondary flex items-center justify-center gap-2"
          >
            <Navigation size={16} /> {isHeadingToRestaurant ? 'Go to restaurant' : 'Go to customer'}
          </a>
          <a
            href={`tel:${isHeadingToRestaurant ? delivery.restaurantContactNumber : delivery.customerPhone}`}
            className="btn-secondary flex items-center justify-center gap-2"
          >
            <Phone size={16} /> Call
          </a>
        </div>

        <div className="card p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Items ({delivery.items.reduce((sum, item) => sum + item.quantity, 0)})
          </p>
          <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
            {delivery.items.map((item, index) => (
              <li key={index}>
                {item.quantity} x {item.name}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400">Your payout</span>
            <span className="font-bold text-slate-800 dark:text-slate-100">{formatCurrency(delivery.payoutEstimate)}</span>
          </div>
        </div>

        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{error}</p>}

        {delivery.status === 'RIDER_ASSIGNED' && (
          <button className="btn-primary flex w-full items-center justify-center gap-2" onClick={handlePickup} disabled={busy}>
            {busy && <Loader2 size={16} className="animate-spin" />}
            {busy ? 'Marking picked up...' : 'Mark picked up'}
          </button>
        )}

        {delivery.status === 'PICKED_UP' && (
          <form onSubmit={handleDeliver} className="card space-y-3 p-4">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Ask the customer for their delivery PIN</p>
            <TextInput
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="1234"
              inputMode="numeric"
              maxLength={4}
              className="text-center text-xl tracking-[0.5em]"
              autoFocus
            />
            <button type="submit" className="btn-primary w-full" disabled={busy || pin.length !== 4}>
              {busy ? 'Confirming...' : 'Confirm delivery'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
