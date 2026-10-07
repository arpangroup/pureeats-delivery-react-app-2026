import { useEffect, useState } from 'react'
import { platformSettingsService, type PlatformSettings } from '@/services/platformSettingsService'

/**
 * The admin-controlled Delivery app settings (payout visibility, which profile fields are editable).
 * Kept fresh by usePlatformSettings' 60s poll in RiderSessionProvider; this just subscribes to the latest values.
 */
export function useDriverSettings(): PlatformSettings {
  const [settings, setSettings] = useState(platformSettingsService.current())
  useEffect(() => {
    const unsubscribe = platformSettingsService.subscribe(setSettings)
    setSettings(platformSettingsService.current())
    return () => {
      unsubscribe()
    }
  }, [])
  return settings
}
