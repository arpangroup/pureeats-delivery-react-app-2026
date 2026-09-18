/** Decodes a JWT's payload segment client-side. Display only - no signature verification. */
export function decodeJwtPayload<T>(token: string): T | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=')
    return JSON.parse(atob(base64)) as T
  } catch {
    return null
  }
}

/** Builds an unsigned, JWT-shaped token from claims so mock tokens decode via the same path as real ones. */
export function buildMockJwt(claims: Record<string, unknown>): string {
  const encode = (obj: unknown) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const header = encode({ alg: 'none', typ: 'JWT' })
  const payload = encode(claims)
  return `${header}.${payload}.mocksig`
}
