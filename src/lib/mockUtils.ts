import { MOCK_DELAY_MS } from '@/config/env'

/** Simulated network latency so loading states are visible in mock mode. */
export function mockDelay(ms: number = MOCK_DELAY_MS): Promise<void> {
  if (!ms) return Promise.resolve()
  return new Promise((resolve) => setTimeout(resolve, ms))
}

let nextId = 100000
/** Generates ids for records created in mock mode (session-scoped). */
export function nextMockId(): number {
  nextId += 1
  return nextId
}
