import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useIncomingOrder } from '@/context/IncomingOrderContext'
import { useLocationReporting } from '@/hooks/useLocationReporting'
import { usePlatformSettings } from '@/hooks/usePlatformSettings'
import { useOnResume } from '@/hooks/useOnResume'
import { deliveryStatusService } from '@/services/deliveryStatusService'
import { deliveryOrderService } from '@/services/deliveryOrderService'
import { installAudioUnlock, startRinging, stopRinging, unlockAudio } from '@/lib/orderSound'
import { readStorage, writeStorage } from '@/lib/storage'
import type { Coordinates, GeolocationPermissionState } from '@/lib/geolocation'
import type { ActiveDelivery } from '@/types/entities'
import { showErrorToast } from '@/lib/errorToast'

const ONLINE_STORAGE_KEY = 'pureeats.rider.isOnline'
/** Assignment ids the rider has already seen (accepted themself, or acknowledged the "assigned to you" alert for). */
const ACKNOWLEDGED_ASSIGNMENTS_KEY = 'pureeats.rider.acknowledgedAssignments'
const AVAILABLE_POLL_MS = 9000
const ACTIVE_POLL_MS = 15000
const STATUS_SYNC_MS = 60000

interface RiderSessionValue {
  isOnline: boolean
  isSaving: boolean
  error: string | null
  toggle: () => Promise<void>
  /** Shown on Home when the server changed the rider's status behind their back (inactivity auto-offline, or an admin). */
  statusNotice: string | null
  dismissStatusNotice: () => void
  locationTrackingEnabled: boolean
  platformSettingsLoaded: boolean
  lastPosition: Coordinates | null
  permissionState: GeolocationPermissionState
  locationError: string | null
  /** Every order assigned to this rider and not yet finished, oldest first (null until first load). */
  activeDeliveries: ActiveDelivery[] | null
  refreshActiveDeliveries: () => Promise<void>
  /** Record an order the rider accepted themself, so it never raises the "assigned to you" alert. */
  markSelfAccepted: (orderId: number) => void
  /** An order an admin assigned to this rider that they haven't acknowledged yet. */
  assignedAlert: ActiveDelivery | null
  acknowledgeAssignedAlert: () => void
}

const RiderSessionContext = createContext<RiderSessionValue | undefined>(undefined)

function readAcknowledged(): number[] {
  return readStorage<number[]>(ACKNOWLEDGED_ASSIGNMENTS_KEY, [])
}

function addAcknowledged(orderId: number) {
  const next = [orderId, ...readAcknowledged().filter((id) => id !== orderId)].slice(0, 100)
  writeStorage(ACKNOWLEDGED_ASSIGNMENTS_KEY, next)
}

/**
 * Everything that has to keep running for as long as a rider is signed in, regardless of which
 * tab/page is open: the online/offline state (synced with the server), GPS pings, polling for new
 * available orders, and watching for orders assigned to this rider (including ones an admin
 * assigned directly). This all used to live inside HomePage, so it silently stopped the moment the
 * rider switched to another tab - no pings (so the backend's inactivity sweep forced them offline),
 * no new-order alerts, and admin assignments never surfaced at all.
 *
 * Also re-syncs on resume ({@link useOnResume}): when the app comes back from the background it
 * immediately re-checks the server status, pings location, and re-polls orders, rather than
 * waiting for throttled timers to fire.
 */
export function RiderSessionProvider({ children }: { children: ReactNode }) {
  const { user, isRider } = useAuth()
  const active = !!user && isRider
  const { showIncomingOrder } = useIncomingOrder()

  const [isOnline, setIsOnlineState] = useState(() => readStorage(ONLINE_STORAGE_KEY, false))
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusNotice, setStatusNotice] = useState<string | null>(null)
  const [activeDeliveries, setActiveDeliveries] = useState<ActiveDelivery[] | null>(null)
  const [assignedAlert, setAssignedAlert] = useState<ActiveDelivery | null>(null)

  const { locationTrackingEnabled, loaded: platformSettingsLoaded } = usePlatformSettings()
  const { lastPosition, permissionState, error: locationError, reportNow } = useLocationReporting(active && isOnline, locationTrackingEnabled)

  const isOnlineRef = useRef(isOnline)
  isOnlineRef.current = isOnline
  const previousAvailableIds = useRef<Set<number> | null>(null)

  const setIsOnline = useCallback((next: boolean) => {
    setIsOnlineState(next)
    writeStorage(ONLINE_STORAGE_KEY, next)
  }, [])

  useEffect(() => {
    installAudioUnlock()
  }, [])

  const toggle = useCallback(async () => {
    if (!user) return
    unlockAudio() // this tap is a user gesture - make sure later alerts are audible
    const next = !isOnlineRef.current
    setIsOnline(next)
    setIsSaving(true)
    setError(null)
    setStatusNotice(null)
    try {
      await deliveryStatusService.setOnline(user.id, next)
    } catch (err) {
      setIsOnline(!next) // revert the optimistic flip on failure
      const message = (err as { message?: string })?.message ?? 'Could not update your status.'
      setError(message)
      showErrorToast(message)
    } finally {
      setIsSaving(false)
    }
  }, [user, setIsOnline])

  /** Adopts the server's view of online/offline - it wins, since the inactivity sweep or an admin can change it while this app is asleep. */
  const syncServerStatus = useCallback(async () => {
    try {
      const status = await deliveryStatusService.getStatus()
      if (status.isOnline === isOnlineRef.current) return
      setIsOnline(status.isOnline)
      if (!status.isOnline && status.offlineReason === 'INACTIVITY') {
        setStatusNotice('You were set offline automatically because the app stopped reporting your location for a while (it was in the background). Go online again to keep receiving orders.')
      } else if (!status.isOnline && status.offlineReason === 'ADMIN') {
        setStatusNotice('An admin set you offline.')
      }
    } catch {
      // Network blip / token refresh in flight - keep the local state and retry next sync.
    }
  }, [setIsOnline])

  const refreshActiveDeliveries = useCallback(async () => {
    try {
      const list = await deliveryOrderService.getActiveDeliveries()
      setActiveDeliveries(list)
      const acknowledged = new Set(readAcknowledged())
      const unseenAdminAssignment = list.find((d) => d.assignedBy === 'ADMIN' && !acknowledged.has(d.id))
      if (unseenAdminAssignment) {
        setAssignedAlert((current) => current ?? unseenAdminAssignment)
      }
    } catch {
      // transient - retried on the next tick / resume
    }
  }, [])

  const markSelfAccepted = useCallback(
    (orderId: number) => {
      addAcknowledged(orderId)
      refreshActiveDeliveries()
    },
    [refreshActiveDeliveries],
  )

  const acknowledgeAssignedAlert = useCallback(() => {
    setAssignedAlert((current) => {
      if (current) addAcknowledged(current.id)
      return null
    })
  }, [])

  // Ring while an admin assignment is waiting to be acknowledged.
  useEffect(() => {
    if (!assignedAlert) return
    startRinging(5000)
    return () => stopRinging()
  }, [assignedAlert])

  const hasActiveDelivery = (activeDeliveries?.length ?? 0) > 0

  const pollAvailable = useCallback(async () => {
    try {
      const orders = await deliveryOrderService.listAvailable()
      const previous = previousAvailableIds.current
      // First poll after (re)starting establishes the baseline silently - only orders that appear
      // on a LATER poll count as "new". IncomingOrderContext additionally de-dupes against push.
      const freshOnes = previous ? orders.filter((o) => !previous.has(o.id)) : []
      previousAvailableIds.current = new Set(orders.map((o) => o.id))
      if (freshOnes.length > 0) {
        const newest = [...freshOnes].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0]
        showIncomingOrder(newest)
      }
    } catch {
      // transient network error - just try again next tick
    }
  }, [showIncomingOrder])

  // Initial load + server status sync whenever a rider signs in.
  useEffect(() => {
    if (!active) {
      setActiveDeliveries(null)
      return
    }
    syncServerStatus()
    refreshActiveDeliveries()
    const statusTimer = setInterval(syncServerStatus, STATUS_SYNC_MS)
    const activeTimer = setInterval(refreshActiveDeliveries, ACTIVE_POLL_MS)
    return () => {
      clearInterval(statusTimer)
      clearInterval(activeTimer)
    }
  }, [active, user?.id, syncServerStatus, refreshActiveDeliveries])

  // New-order polling - always on while online and free, even when push is configured: a push that
  // lands while the app is backgrounded goes to the service worker, never to the page, so polling
  // is what actually surfaces those orders once the rider is back.
  useEffect(() => {
    if (!active || !isOnline || hasActiveDelivery) {
      previousAvailableIds.current = null
      return
    }
    pollAvailable()
    const id = setInterval(pollAvailable, AVAILABLE_POLL_MS)
    return () => clearInterval(id)
  }, [active, isOnline, hasActiveDelivery, pollAvailable])

  useOnResume(() => {
    if (!active) return
    syncServerStatus()
    refreshActiveDeliveries()
    if (isOnlineRef.current) {
      reportNow()
      pollAvailable()
    }
  })

  const value = useMemo<RiderSessionValue>(
    () => ({
      isOnline,
      isSaving,
      error,
      toggle,
      statusNotice,
      dismissStatusNotice: () => setStatusNotice(null),
      locationTrackingEnabled,
      platformSettingsLoaded,
      lastPosition,
      permissionState,
      locationError,
      activeDeliveries,
      refreshActiveDeliveries,
      markSelfAccepted,
      assignedAlert,
      acknowledgeAssignedAlert,
    }),
    [isOnline, isSaving, error, toggle, statusNotice, locationTrackingEnabled, platformSettingsLoaded, lastPosition, permissionState, locationError, activeDeliveries, refreshActiveDeliveries, markSelfAccepted, assignedAlert, acknowledgeAssignedAlert],
  )

  return <RiderSessionContext.Provider value={value}>{children}</RiderSessionContext.Provider>
}

export function useRiderSession(): RiderSessionValue {
  const ctx = useContext(RiderSessionContext)
  if (!ctx) throw new Error('useRiderSession must be used within RiderSessionProvider')
  return ctx
}
