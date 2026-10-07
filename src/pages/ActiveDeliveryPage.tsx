import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Store, MapPin, Navigation, Phone, PackageCheck, Camera, ChefHat, Banknote } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { LoadingBlock, EmptyState } from '@/components/ui/Feedback'
import { TextInput } from '@/components/ui/FormControls'
import { SwipeToAcceptButton } from '@/components/ui/SwipeToAcceptButton'
import { OrderIdTag, OrderStatusBadge, PaymentBadge, PickupCountdown } from '@/components/order/OrderMeta'
import { deliveryOrderService, MAX_PICKUP_PHOTOS, paymentLabel } from '@/services/deliveryOrderService'
import { useRiderSession } from '@/context/RiderSessionContext'
import { useDriverSettings } from '@/hooks/useDriverSettings'
import { formatCurrency } from '@/lib/format'
import type { ActiveDelivery, OrderStatus } from '@/types/entities'
import { showErrorToast } from '@/lib/errorToast'

/** Deep-links out to the phone's own maps app instead of embedding a map - this app has no
 * @react-google-maps/api dependency. */
function mapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
}

/** Statuses after the food has left the restaurant. */
const OUT_FOR_DELIVERY: OrderStatus[] = ['PICKED_UP', 'ON_THE_WAY', 'ARRIVED']
/** While waiting for the kitchen, re-check readiness this often (the app-wide poll is slower). */
const READY_POLL_MS = 5000

export default function ActiveDeliveryPage() {
  const navigate = useNavigate()
  const { activeDeliveries, refreshActiveDeliveries } = useRiderSession()
  const { showPayout } = useDriverSettings()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  /** Local copy of the delivery being worked - kept after completion so the "Delivered!" screen can show, even though it has left activeDeliveries. */
  const [completed, setCompleted] = useState<ActiveDelivery | null>(null)
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    refreshActiveDeliveries()
  }, [refreshActiveDeliveries])

  const delivery: ActiveDelivery | null | undefined =
    completed ?? (activeDeliveries === null ? undefined : activeDeliveries.find((d) => d.id === selectedId) ?? activeDeliveries[0] ?? null)

  const waitingForKitchen = !!delivery && !OUT_FOR_DELIVERY.includes(delivery.status) && delivery.status !== 'DELIVERED' && !delivery.foodReady
  useEffect(() => {
    if (!waitingForKitchen) return
    const id = setInterval(refreshActiveDeliveries, READY_POLL_MS)
    return () => clearInterval(id)
  }, [waitingForKitchen, refreshActiveDeliveries])

  async function run(action: () => Promise<unknown>, fallback: string) {
    setBusy(true)
    setError(null)
    try {
      await action()
      await refreshActiveDeliveries()
    } catch (err) {
      showErrorToast(err)
      setError((err as { message?: string })?.message ?? fallback)
      await refreshActiveDeliveries()
    } finally {
      setBusy(false)
    }
  }

  async function handleDeliver() {
    if (!delivery) return
    setBusy(true)
    setError(null)
    try {
      await deliveryOrderService.deliver(delivery.id, pin)
      setCompleted({ ...delivery, status: 'DELIVERED', deliveredAt: new Date().toISOString() })
      setPin('')
      refreshActiveDeliveries()
    } catch (err) {
      showErrorToast(err)
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
          {showPayout
            ? `You earned ${formatCurrency(delivery.payoutEstimate + (delivery.tipAmount ?? 0))} for order ${delivery.uniqueOrderId}.`
            : `Order ${delivery.uniqueOrderId} is complete.`}
        </p>
        {(activeDeliveries?.length ?? 0) > 0 ? (
          <button className="btn-primary w-full max-w-xs" onClick={() => setCompleted(null)}>
            Next delivery
          </button>
        ) : (
          <button className="btn-primary w-full max-w-xs" onClick={() => navigate('/', { replace: true })}>
            Back to home
          </button>
        )}
      </div>
    )
  }

  const pickedUp = OUT_FOR_DELIVERY.includes(delivery.status)
  const isHeadingToRestaurant = !pickedUp
  const photoCount = delivery.pickupPhotoCount ?? 0
  const deliveryPhotoCount = delivery.deliveryPhotoCount ?? 0
  const canPickUp = !!delivery.foodReady && photoCount > 0
  const totalItems = delivery.items.reduce((sum, item) => sum + item.quantity, 0)
  const isCod = paymentLabel(delivery.paymentMode) === 'COD'

  return (
    <div>
      <PageHeader title="Active delivery" />
      <div className="space-y-4 px-4 py-4 pb-8">
        {activeDeliveries && activeDeliveries.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {activeDeliveries.map((d) => (
              <button
                key={d.id}
                onClick={() => {
                  setSelectedId(d.id)
                  setPin('')
                  setError(null)
                }}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                  d.id === delivery.id ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {d.uniqueOrderId}
              </button>
            ))}
          </div>
        )}

        {delivery.assignedBy === 'ADMIN' && (
          <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">Assigned to you by an admin.</p>
        )}

        <div className="card space-y-2 p-4">
          <div className="flex items-center justify-between gap-2">
            <OrderIdTag id={delivery.uniqueOrderId} />
            <PaymentBadge mode={delivery.paymentMode} />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <OrderStatusBadge status={delivery.status} />
            {!pickedUp && <PickupCountdown dueAt={delivery.pickupDueAt} />}
          </div>
          {isCod && delivery.payable != null && (
            <p className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              <Banknote size={16} /> Collect {formatCurrency(delivery.payable)} in cash
            </p>
          )}
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
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Items</p>
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
          {showPayout && (
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400">Your payout</span>
              <span className="font-bold text-slate-800 dark:text-slate-100">{formatCurrency(delivery.payoutEstimate)}</span>
            </div>
          )}
          {(delivery.tipAmount ?? 0) > 0 && (
            <>
              <div className="mt-1 flex items-center justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">Customer tip</span>
                <span className="font-bold text-amber-700 dark:text-amber-400">+ {formatCurrency(delivery.tipAmount!)}</span>
              </div>
              {showPayout && (
                <div className="mt-1 flex items-center justify-between border-t border-slate-100 pt-2 text-sm dark:border-slate-800">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">You earn</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{formatCurrency(delivery.payoutEstimate + (delivery.tipAmount ?? 0))}</span>
                </div>
              )}
            </>
          )}
        </div>

        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{error}</p>}

        {!pickedUp && (
          <div className="card space-y-3 p-4">
            {!delivery.foodReady && (
              <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                <ChefHat size={16} className="mt-0.5 shrink-0" />
                The restaurant is still preparing this order. You can mark it picked up once the store marks it ready.
              </p>
            )}
            <Link
              to={`/deliveries/${delivery.id}/photos/pickup`}
              className={`flex items-center justify-between rounded-xl border px-3 py-3 text-sm font-semibold ${
                photoCount > 0
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400'
                  : 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400'
              }`}
            >
              <span className="flex items-center gap-2">
                <Camera size={18} /> {photoCount > 0 ? 'Pickup photos' : 'Take pickup photos'}
              </span>
              <span className="text-xs">
                {photoCount}/{MAX_PICKUP_PHOTOS}
              </span>
            </Link>
            {photoCount === 0 && <p className="text-xs text-slate-500 dark:text-slate-400">At least one photo of the packed order is needed before pickup.</p>}
            <SwipeToAcceptButton
              key={`pickup-${delivery.id}`}
              label={busy ? 'Marking picked up...' : !delivery.foodReady ? 'Waiting for the food' : photoCount === 0 ? 'Take a photo first' : 'Slide to mark picked up'}
              doneLabel="Picked up!"
              onAccept={() => run(() => deliveryOrderService.pickup(delivery.id), 'Could not mark as picked up.')}
              disabled={busy || !canPickUp}
            />
          </div>
        )}

        {(delivery.status === 'PICKED_UP' || delivery.status === 'ON_THE_WAY') && (
          <div className="card space-y-2 p-4">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">At the customer's location?</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">We'll tell the customer you've arrived.</p>
            <SwipeToAcceptButton
              key={`arrived-${delivery.id}`}
              label={busy ? 'Updating...' : 'Slide when you arrive'}
              doneLabel="Customer notified"
              onAccept={() => run(() => deliveryOrderService.arrived(delivery.id), 'Could not update the status.')}
              disabled={busy}
            />
          </div>
        )}

        {delivery.status === 'ARRIVED' && (
          <div className="card space-y-3 p-4">
            <Link
              to={`/deliveries/${delivery.id}/photos/delivery`}
              className={`flex items-center justify-between rounded-xl border px-3 py-3 text-sm font-semibold ${
                deliveryPhotoCount > 0
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400'
                  : 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400'
              }`}
            >
              <span className="flex items-center gap-2">
                <Camera size={18} /> {deliveryPhotoCount > 0 ? 'Delivery photo' : 'Take delivery photo'}
              </span>
              <span className="text-xs">
                {deliveryPhotoCount}/{MAX_PICKUP_PHOTOS}
              </span>
            </Link>
            {deliveryPhotoCount === 0 && <p className="text-xs text-slate-500 dark:text-slate-400">Take a photo as you hand over the order before confirming delivery.</p>}
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Ask the customer for their delivery PIN</p>
            <TextInput
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="1234"
              inputMode="numeric"
              maxLength={4}
              className="text-center text-xl tracking-[0.5em]"
            />
            <SwipeToAcceptButton
              key={`deliver-${delivery.id}`}
              label={busy ? 'Confirming...' : deliveryPhotoCount === 0 ? 'Take a photo first' : pin.length !== 4 ? 'Enter the 4-digit PIN' : 'Slide to confirm delivery'}
              doneLabel="Delivered!"
              onAccept={handleDeliver}
              disabled={busy || pin.length !== 4 || deliveryPhotoCount === 0}
            />
          </div>
        )}
      </div>
    </div>
  )
}
