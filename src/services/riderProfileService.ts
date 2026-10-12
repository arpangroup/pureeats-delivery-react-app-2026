import { apiClient } from '@/lib/apiClient'
import { mockDelay, nextMockId } from '@/lib/mockUtils'
import { IS_MOCK } from '@/config/env'
import { users } from '@/mocks/fixtures/users'
import { riderProfilesByUserId } from '@/mocks/fixtures/riderProfile'
import type { DocType, Gender, PartnerApplication, RiderDocument, RiderProfile } from '@/types/entities'

/** One group of document/payout fields to change (only what's sent changes). */
export interface DocumentChanges {
  licenseNumber?: string
  aadhaarNumber?: string
  panNumber?: string
  vehicleType?: 'BIKE' | 'CYCLE' | 'EV'
  payoutMethod?: 'BANK' | 'UPI'
  bankAccountHolder?: string
  bankAccountNumber?: string
  bankIfsc?: string
  upiId?: string
}

export interface RiderProfileInput {
  name?: string
  vehicleNumber: string
  age: number | null
  gender: Gender | null
  description: string
  photo?: File | null
}

export const DOC_LABELS: Record<DocType | 'PHOTO', string> = {
  LICENSE: 'Driving licence photo',
  AADHAAR_FRONT: 'Aadhaar (front)',
  AADHAAR_BACK: 'Aadhaar (back)',
  PAN: 'PAN card',
  RC: 'Vehicle RC',
  PASSBOOK: 'Bank passbook / cancelled cheque',
  PHOTO: 'Your photo',
}

function mergeMockDocuments(existing: RiderDocument[], files: Partial<Record<DocType, File>>): RiderDocument[] {
  const byType = new Map(existing.map((d) => [d.type, d]))
  for (const [type, file] of Object.entries(files) as [DocType, File][]) {
    if (file) byType.set(type, { type, label: DOC_LABELS[type], url: URL.createObjectURL(file), contentType: file.type, uploadedAt: new Date().toISOString() })
  }
  return [...byType.values()]
}

/** Everything but the last 4 characters hidden, like the server's masking. */
const maskTail = (v: string) => v.slice(-4).padStart(v.length, 'X')

export const riderProfileService = {
  async getMyProfile(userId: number): Promise<RiderProfile | null> {
    if (IS_MOCK) {
      await mockDelay()
      return riderProfilesByUserId[userId] ?? null
    }
    const { data } = await apiClient.get<{ data: RiderProfile }>('/users/me/rider-profile')
    return data.data
  },

  /** First-time onboarding - creates the rider profile and (mock mode) flips the in-memory user's
   * role to delivery-guy so a subsequent login issues a DELIVERY-role token, mirroring the real
   * backend's "role only appears in a fresh token" behavior (see RiderOnboardingPage). */
  async createProfile(userId: number, payload: RiderProfileInput): Promise<RiderProfile> {
    if (IS_MOCK) {
      await mockDelay()
      const user = users.find((u) => u.id === userId)
      const photo = payload.photo ? URL.createObjectURL(payload.photo) : null
      const profile: RiderProfile = {
        id: riderProfilesByUserId[userId]?.id ?? nextMockId(),
        userId,
        name: payload.name ?? riderProfilesByUserId[userId]?.name ?? user?.name ?? 'New Rider',
        email: user?.email ?? '',
        phone: user?.phone ?? '',
        photo: photo ?? riderProfilesByUserId[userId]?.photo ?? null,
        vehicleNumber: payload.vehicleNumber,
        age: payload.age,
        gender: payload.gender,
        description: payload.description,
        commissionRate: riderProfilesByUserId[userId]?.commissionRate ?? 80,
        maxAcceptDeliveryLimit: riderProfilesByUserId[userId]?.maxAcceptDeliveryLimit ?? 1,
        rating: riderProfilesByUserId[userId]?.rating ?? 0,
        isNotifiable: riderProfilesByUserId[userId]?.isNotifiable ?? true,
        isOnline: riderProfilesByUserId[userId]?.isOnline ?? false,
        isActive: true,
      }
      riderProfilesByUserId[userId] = profile
      if (user) {
        user.role = 'delivery-guy'
        if (payload.name) user.name = payload.name
      }
      return profile
    }
    // Plain JSON - the backend's RiderProfileRequest carries no photo field, since a photo is a
    // file, not JSON (see uploadPhoto below). Onboarding still lets the rider pick a photo in the
    // same form for a smooth UX, so if one was chosen, upload it as a second call right after the
    // profile itself is created.
    const { data } = await apiClient.post<{ data: RiderProfile }>('/users/me/rider-profile', {
      name: payload.name,
      vehicleNumber: payload.vehicleNumber,
      age: payload.age != null ? String(payload.age) : null,
      gender: payload.gender,
      description: payload.description,
    })
    if (payload.photo) return riderProfileService.uploadPhoto(payload.photo)
    return data.data
  },

  /** Partial update of the rider's own profile fields, post-onboarding - PUT to the same
   * resource, distinct from createProfile's POST (which the backend rejects once a profile
   * already exists). Photo, again, goes through uploadPhoto separately if one was picked. */
  async updateProfile(userId: number, payload: RiderProfileInput): Promise<RiderProfile> {
    if (IS_MOCK) {
      // createProfile's mock branch already upserts (no "already exists" rejection like the real
      // backend), and already turns payload.photo into an object-URL preview itself - reuse it
      // as-is rather than routing through the live-only uploadPhoto split.
      return riderProfileService.createProfile(userId, payload)
    }
    const { data } = await apiClient.put<{ data: RiderProfile }>('/users/me/rider-profile', {
      name: payload.name,
      vehicleNumber: payload.vehicleNumber,
      age: payload.age != null ? String(payload.age) : null,
      gender: payload.gender,
      description: payload.description,
    })
    if (payload.photo) return riderProfileService.uploadPhoto(payload.photo)
    return data.data
  },

  /**
   * Applies to become a delivery partner (or resubmits after a rejection): licence, ID proof, vehicle and
   * payout details, then the photo and every chosen document. The application waits for admin approval (PENDING).
   */
  async submitApplication(
    userId: number,
    application: PartnerApplication,
    documents: Partial<Record<DocType, File>>,
    resubmit: boolean,
    profilePhoto: File | null = null,
  ): Promise<RiderProfile> {
    const body = {
      name: application.name.trim(),
      vehicleNumber: application.vehicleNumber.trim(),
      licenseNumber: application.licenseNumber,
      aadhaarNumber: application.aadhaarNumber,
      panNumber: application.panNumber,
      vehicleType: application.vehicleType,
      payoutMethod: application.payoutMethod,
      bankAccountHolder: application.payoutMethod === 'BANK' ? application.bankAccountHolder : null,
      bankAccountNumber: application.payoutMethod === 'BANK' ? application.bankAccountNumber : null,
      bankIfsc: application.payoutMethod === 'BANK' ? application.bankIfsc : null,
      upiId: application.payoutMethod === 'UPI' ? application.upiId : null,
    }
    if (IS_MOCK) {
      await mockDelay()
      const user = users.find((u) => u.id === userId)
      const profile: RiderProfile = {
        ...(riderProfilesByUserId[userId] ?? {
          id: nextMockId(), userId, email: user?.email ?? '', phone: user?.phone ?? '', photo: null, age: null, gender: null, description: '',
          commissionRate: 0, maxAcceptDeliveryLimit: 1, rating: 0, isNotifiable: true, isOnline: false, isActive: true,
        }),
        name: body.name,
        vehicleNumber: body.vehicleNumber,
        approvalStatus: 'PENDING',
        rejectionReason: null,
        licenseNumber: body.licenseNumber,
        licensePhotoUrl: documents.LICENSE ? URL.createObjectURL(documents.LICENSE) : riderProfilesByUserId[userId]?.licensePhotoUrl ?? null,
        documents: mergeMockDocuments(riderProfilesByUserId[userId]?.documents ?? [], documents),
        missingDocuments: [],
        photo: profilePhoto ? URL.createObjectURL(profilePhoto) : riderProfilesByUserId[userId]?.photo ?? null,
        aadhaarNumberMasked: maskTail(body.aadhaarNumber.replace(/\s/g, '')),
        panNumberMasked: maskTail(body.panNumber.toUpperCase()),
        vehicleType: body.vehicleType,
        payoutMethod: body.payoutMethod,
        upiId: body.upiId,
        bankAccountHolder: body.bankAccountHolder,
        bankAccountNumberMasked: body.bankAccountNumber ? body.bankAccountNumber.slice(-4).padStart(body.bankAccountNumber.length, 'X') : null,
        bankIfsc: body.bankIfsc,
      }
      riderProfilesByUserId[userId] = profile
      if (user) user.role = 'delivery-guy'
      return profile
    }
    let saved: RiderProfile
    try {
      saved = resubmit
        ? (await apiClient.put<{ data: RiderProfile }>('/users/me/rider-profile', body)).data.data
        : (await apiClient.post<{ data: RiderProfile }>('/users/me/rider-profile', body)).data.data
    } catch (err) {
      // An earlier attempt already saved the details (e.g. its photo upload failed) - update them instead.
      if (!resubmit && (err as { status?: number })?.status === 409) {
        saved = (await apiClient.put<{ data: RiderProfile }>('/users/me/rider-profile', body)).data.data
      } else {
        throw err
      }
    }
    // Photos go up after the details are saved; a failed upload says so (the details are kept - Submit again retries).
    const upload = async (path: string, file: File, label: string) => {
      const form = new FormData()
      form.append('file', file)
      try {
        saved = (await apiClient.post<{ data: RiderProfile }>(path, form)).data.data
      } catch (err) {
        const reason = (err as { message?: string })?.message
        throw { message: `Your details are saved, but your ${label} didn't upload${reason && reason !== 'Network Error' ? ` (${reason})` : ''}. Tap Submit again to retry.` }
      }
    }
    if (profilePhoto) await upload('/users/me/rider-profile/photo', profilePhoto, 'photo')
    for (const [type, file] of Object.entries(documents) as [DocType, File][]) {
      if (file) await upload(`/users/me/rider-profile/documents/${type}`, file, DOC_LABELS[type])
    }
    return saved
  },

  /** One document (photo or PDF) - e.g. one that was missing after the application was sent. */
  async uploadDocument(profile: RiderProfile, type: DocType, file: File): Promise<RiderProfile> {
    if (IS_MOCK) {
      await mockDelay()
      const updated: RiderProfile = {
        ...profile,
        documents: mergeMockDocuments(profile.documents ?? [], { [type]: file }),
        missingDocuments: (profile.missingDocuments ?? []).filter((d) => d !== type),
      }
      riderProfilesByUserId[profile.userId] = updated
      return updated
    }
    const form = new FormData()
    form.append('file', file)
    const { data } = await apiClient.post<{ data: RiderProfile }>(`/users/me/rider-profile/documents/${type}`, form)
    return data.data
  },

  /** Changes one group of documents/payout details - allowed only when Settings -> Profile editing permits it. */
  async updateDocuments(profile: RiderProfile, changes: DocumentChanges): Promise<RiderProfile> {
    if (IS_MOCK) {
      await mockDelay()
      const { aadhaarNumber, panNumber, ...rest } = changes
      const updated: RiderProfile = {
        ...profile,
        ...rest,
        aadhaarNumberMasked: aadhaarNumber ? maskTail(aadhaarNumber.replace(/\s/g, '')) : profile.aadhaarNumberMasked,
        panNumberMasked: panNumber ? maskTail(panNumber.toUpperCase()) : profile.panNumberMasked,
      }
      riderProfilesByUserId[profile.userId] = updated
      return updated
    }
    const { data } = await apiClient.put<{ data: RiderProfile }>('/users/me/rider-profile', { vehicleNumber: profile.vehicleNumber, ...changes })
    return data.data
  },

  async uploadLicensePhoto(photo: File): Promise<RiderProfile> {
    if (IS_MOCK) {
      await mockDelay()
      throw { message: 'Licence photo upload needs the live backend.' }
    }
    const form = new FormData()
    form.append('file', photo)
    const { data } = await apiClient.post<{ data: RiderProfile }>('/users/me/rider-profile/license-photo', form)
    return data.data
  },

  /** Separate multipart action, mirroring the customer app's own profile-photo upload - a file is
   * never smuggled into a JSON profile-fields request. */
  async uploadPhoto(file: File): Promise<RiderProfile> {
    if (IS_MOCK) {
      await mockDelay()
      throw { message: 'uploadPhoto should not be called directly in mock mode - createProfile/updateProfile handle the mock photo preview themselves.' }
    }
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await apiClient.post<{ data: RiderProfile }>('/users/me/rider-profile/photo', formData)
    return data.data
  },
}
