import { type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { classNames } from '@/lib/format'

interface FieldWrapperProps {
  label?: string
  htmlFor?: string
  hint?: string
  error?: string
  required?: boolean
  children: ReactNode
}

export function Field({ label, htmlFor, hint, error, required, children }: FieldWrapperProps) {
  return (
    <div>
      {label && (
        <label htmlFor={htmlFor} className="label">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      {error && <p className="mt-1 text-xs text-rose-500">{error}</p>}
    </div>
  )
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props
  return <input className={classNames('input', className)} {...rest} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className, ...rest } = props
  return <textarea className={classNames('input min-h-[90px]', className)} {...rest} />
}
