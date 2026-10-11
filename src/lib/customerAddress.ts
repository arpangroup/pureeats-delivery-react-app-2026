/** The drop address once the server shares it (after pickup); a hint before that. */
export function dropAddress(address: string | null | undefined): string {
  return address && address.trim() ? address : 'Customer address is shown after you pick up the order'
}
