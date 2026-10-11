import type { DocType, PayoutMethod, VehicleType } from '@/types/entities'

/** Documents an application needs - the same rule as the server (RiderDocuments.required). */
export function requiredDocuments(vehicleType: VehicleType, payoutMethod: PayoutMethod): DocType[] {
  const docs: DocType[] = ['LICENSE', 'AADHAAR_FRONT', 'AADHAAR_BACK', 'PAN']
  if (vehicleType !== 'CYCLE') docs.push('RC')
  if (payoutMethod === 'BANK') docs.push('PASSBOOK')
  return docs
}

/** What to photograph for each document - shown under its upload tile. */
export const DOC_TIPS: Record<DocType, string> = {
  LICENSE: 'Front of your driving licence - the side with your photo and DL number.',
  AADHAAR_FRONT: 'Front of your Aadhaar - your photo, name, date of birth and the 12-digit number.',
  AADHAAR_BACK: 'Back of your Aadhaar - the side with your address.',
  PAN: 'Front of your PAN card - name and the 10-character PAN must be readable.',
  RC: 'Your vehicle RC - the registration number must match the one you entered.',
  PASSBOOK: 'First page of your passbook (or a cancelled cheque) showing your name, account number and IFSC.',
}
