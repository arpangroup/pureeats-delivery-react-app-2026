import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Camera, CheckCircle2, Eye, FileText, Upload } from 'lucide-react'
import { classNames } from '@/lib/format'
import { compressImage } from '@/lib/imageCompress'
import { DOC_LABELS } from '@/services/riderProfileService'
import type { DocType, RiderDocument } from '@/types/entities'
import { DocumentExample } from './DocumentExample'
import { DOC_TIPS } from '@/lib/riderDocuments'

/** Same limit as the server (pureeats.media.max-size-bytes). */
const MAX_BYTES = 5 * 1024 * 1024

/**
 * One document: take a photo or upload a file (JPG, PNG or PDF), with a preview, a replace option and an
 * example of what to photograph - shown next to the empty tile so it's never missed. Photos are shrunk before
 * upload; a PDF goes as it is.
 */
export function DocumentUpload({
  type,
  file,
  existing,
  onPick,
  error,
  disabled,
}: {
  type: DocType
  /** Chosen in this form, not uploaded yet. */
  file: File | null
  /** Already on file (from an earlier submission). */
  existing?: RiderDocument | null
  onPick: (file: File) => void
  error?: string
  disabled?: boolean
}) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [showExample, setShowExample] = useState(false)
  const [pickError, setPickError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    if (!file || file.type === 'application/pdf') {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0]
    e.target.value = ''
    if (!chosen) return
    setPickError(null)
    try {
      const isPdf = chosen.type === 'application/pdf' || chosen.name.toLowerCase().endsWith('.pdf')
      if (isPdf) {
        if (chosen.size > MAX_BYTES) throw { message: 'This PDF is over 5MB - upload a smaller scan or a photo instead.' }
        onPick(chosen.type ? chosen : new File([chosen], chosen.name, { type: 'application/pdf' }))
      } else {
        onPick(await compressImage(chosen))
      }
    } catch (err) {
      setPickError((err as { message?: string })?.message ?? "Couldn't use this file.")
    }
  }

  const isPdf = file ? file.type === 'application/pdf' : existing?.contentType === 'application/pdf'
  const imageUrl = preview ?? (!file && existing && !isPdf ? existing.url : null)
  const has = !!file || !!existing
  const shownError = pickError ?? error

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {DOC_LABELS[type]} <span className="text-rose-500">*</span>
        </p>
        <button type="button" onClick={() => setShowExample((v) => !v)} className="flex items-center gap-1 text-xs font-semibold text-brand-600">
          <Eye size={13} /> {showExample ? 'Hide example' : 'See example'}
        </button>
      </div>

      <div
        className={classNames(
          'flex items-center gap-3 rounded-xl border border-dashed p-3',
          shownError ? 'border-rose-300 bg-rose-50/40 dark:border-rose-500/40 dark:bg-rose-500/5' : has ? 'border-emerald-300 bg-emerald-50/40 dark:border-emerald-500/30 dark:bg-emerald-500/5' : 'border-slate-300 dark:border-slate-700',
        )}
      >
        <span className="relative flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-slate-400 dark:bg-slate-800">
          {imageUrl ? (
            <img src={imageUrl} alt={DOC_LABELS[type]} className="h-full w-full object-cover" />
          ) : has && isPdf ? (
            <FileText size={24} className="text-brand-600" />
          ) : (
            // Nothing yet: the example sits where the photo will go, so it's obvious what's expected.
            <span className="w-full opacity-70">
              <DocumentExample type={type} />
            </span>
          )}
          {has && <CheckCircle2 size={16} className="absolute right-1 top-1 rounded-full bg-white text-emerald-600" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
            {file ? (isPdf ? file.name : 'New photo selected') : existing ? 'On file - replace if needed' : DOC_TIPS[type]}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            <button type="button" disabled={disabled} onClick={() => cameraRef.current?.click()} className="flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-brand-600 disabled:opacity-50">
              <Camera size={13} /> {has ? 'Retake' : 'Take photo'}
            </button>
            <button type="button" disabled={disabled} onClick={() => fileRef.current?.click()} className="flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-brand-600 disabled:opacity-50">
              <Upload size={13} /> {has ? 'Replace' : 'Upload file'}
            </button>
          </div>
        </div>
      </div>
      {shownError && <p className="text-xs text-rose-500">{shownError}</p>}
      {showExample && (
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
          <DocumentExample type={type} />
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{DOC_TIPS[type]} Keep all four corners in the frame, no glare or blur.</p>
        </div>
      )}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="hidden" onChange={pick} />
    </div>
  )
}
