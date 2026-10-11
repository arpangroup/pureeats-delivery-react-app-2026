import type { ReactNode } from 'react'
import type { DocType } from '@/types/entities'

/**
 * Illustrated examples of each document, so a partner knows exactly which side to photograph and that the whole
 * card must be visible. Deliberately generic drawings with placeholder data and a SAMPLE stamp - not copies of
 * real government documents.
 */

const INK = '#334155'
const MUTED = '#94a3b8'
const LINE = '#cbd5e1'

function Card({ tint, title, children }: { tint: string; title: string; children: ReactNode }) {
  return (
    <svg viewBox="0 0 320 200" role="img" aria-label={`Sample ${title}`} className="h-auto w-full">
      <rect x="2" y="2" width="316" height="196" rx="14" fill="#ffffff" stroke={LINE} strokeWidth="2" />
      <rect x="2" y="2" width="316" height="34" rx="14" fill={tint} />
      <rect x="2" y="22" width="316" height="14" fill={tint} />
      <text x="16" y="25" fontSize="13" fontWeight="700" fill="#ffffff" fontFamily="system-ui, sans-serif">
        {title}
      </text>
      {children}
      <g transform="rotate(-18 230 150)">
        <rect x="178" y="132" width="104" height="30" rx="6" fill="none" stroke="#e11d48" strokeWidth="2.5" opacity="0.75" />
        <text x="230" y="153" textAnchor="middle" fontSize="16" fontWeight="800" fill="#e11d48" opacity="0.75" fontFamily="system-ui, sans-serif" letterSpacing="3">
          SAMPLE
        </text>
      </g>
    </svg>
  )
}

function Field({ x, y, label, value, w = 150 }: { x: number; y: number; label: string; value: string; w?: number }) {
  return (
    <g fontFamily="system-ui, sans-serif">
      <text x={x} y={y} fontSize="8" fill={MUTED}>
        {label}
      </text>
      <text x={x} y={y + 12} fontSize="11" fontWeight="600" fill={INK}>
        {value}
      </text>
      <line x1={x} y1={y + 16} x2={x + w} y2={y + 16} stroke={LINE} strokeWidth="1" />
    </g>
  )
}

function Photo({ x, y, w = 62, h = 76 }: { x: number; y: number; w?: number; h?: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="6" fill="#e2e8f0" />
      <circle cx={x + w / 2} cy={y + h * 0.38} r={w * 0.2} fill={MUTED} />
      <path d={`M ${x + w * 0.18} ${y + h * 0.9} Q ${x + w / 2} ${y + h * 0.52} ${x + w * 0.82} ${y + h * 0.9} Z`} fill={MUTED} />
    </g>
  )
}

function Qr({ x, y, s = 60 }: { x: number; y: number; s?: number }) {
  const cells: ReactNode[] = []
  const n = 9
  const c = s / n
  // Deterministic "QR-like" pattern - decoration only.
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if ((i * 7 + j * 3 + i * j) % 3 === 0) cells.push(<rect key={`${i}-${j}`} x={x + i * c} y={y + j * c} width={c} height={c} fill={INK} />)
  return (
    <g>
      <rect x={x - 4} y={y - 4} width={s + 8} height={s + 8} fill="#fff" stroke={LINE} />
      {cells}
    </g>
  )
}

const EXAMPLES: Record<DocType, () => ReactNode> = {
  AADHAAR_FRONT: () => (
    <Card tint="#f97316" title="Aadhaar - FRONT side">
      <Photo x={16} y={50} />
      <Field x={92} y={54} label="Name" value="Ravi Kumar" />
      <Field x={92} y={82} label="Date of birth" value="01/01/1995" w={70} />
      <Field x={172} y={82} label="Gender" value="Male" w={70} />
      <text x="92" y="146" fontSize="17" fontWeight="800" fill={INK} fontFamily="ui-monospace, monospace" letterSpacing="2">
        1234 5678 9012
      </text>
      <text x="92" y="160" fontSize="8" fill={MUTED} fontFamily="system-ui, sans-serif">
        12-digit Aadhaar number
      </text>
    </Card>
  ),
  AADHAAR_BACK: () => (
    <Card tint="#f97316" title="Aadhaar - BACK side (address)">
      <text x="16" y="56" fontSize="8" fill={MUTED} fontFamily="system-ui, sans-serif">
        Address
      </text>
      {['S/O Suresh Kumar, 12 MG Road,', 'Shivaji Nagar, Bengaluru,', 'Karnataka - 560001'].map((l, i) => (
        <text key={l} x="16" y={72 + i * 15} fontSize="11" fontWeight="600" fill={INK} fontFamily="system-ui, sans-serif">
          {l}
        </text>
      ))}
      <Qr x={232} y={52} />
      <text x="16" y="168" fontSize="13" fontWeight="800" fill={INK} fontFamily="ui-monospace, monospace" letterSpacing="2">
        1234 5678 9012
      </text>
    </Card>
  ),
  PAN: () => (
    <Card tint="#2563eb" title="PAN card">
      <Field x={16} y={50} label="Name" value="RAVI KUMAR" />
      <Field x={16} y={78} label="Father's name" value="SURESH KUMAR" />
      <Field x={16} y={106} label="Date of birth" value="01/01/1995" w={80} />
      <text x="16" y="150" fontSize="8" fill={MUTED} fontFamily="system-ui, sans-serif">
        Permanent Account Number
      </text>
      <text x="16" y="168" fontSize="18" fontWeight="800" fill={INK} fontFamily="ui-monospace, monospace" letterSpacing="2">
        ABCDE1234F
      </text>
      <Photo x={238} y={48} />
    </Card>
  ),
  LICENSE: () => (
    <Card tint="#0d9488" title="Driving licence - FRONT">
      <Photo x={16} y={50} />
      <Field x={92} y={50} label="DL number" value="KA05 20190001234" w={160} />
      <Field x={92} y={78} label="Name" value="Ravi Kumar" w={160} />
      <Field x={92} y={106} label="Valid till" value="31/12/2039" w={80} />
      <Field x={182} y={106} label="Class" value="MCWG" w={70} />
    </Card>
  ),
  RC: () => (
    <Card tint="#7c3aed" title="Vehicle Registration Certificate (RC)">
      <Field x={16} y={50} label="Registration no." value="KA-05-HH-1234" w={130} />
      <Field x={164} y={50} label="Vehicle class" value="Motor cycle" w={130} />
      <Field x={16} y={80} label="Owner's name" value="Ravi Kumar" w={130} />
      <Field x={164} y={80} label="Fuel" value="Petrol / EV" w={130} />
      <Field x={16} y={110} label="Chassis no." value="MBLXXXXXXXX12345" w={130} />
      <Field x={164} y={110} label="Registered on" value="15/06/2021" w={80} />
    </Card>
  ),
  PASSBOOK: () => (
    <Card tint="#475569" title="Bank passbook - first page">
      <text x="16" y="56" fontSize="12" fontWeight="700" fill={INK} fontFamily="system-ui, sans-serif">
        Your Bank Ltd - Branch
      </text>
      <Field x={16} y={66} label="Account holder" value="Ravi Kumar" />
      <Field x={16} y={94} label="Account number" value="123456789012" />
      <Field x={16} y={122} label="IFSC" value="SBIN0001234" w={100} />
      <text x="16" y="172" fontSize="8" fill={MUTED} fontFamily="system-ui, sans-serif">
        Or a cancelled cheque showing the same details
      </text>
      <Photo x={238} y={50} w={60} h={70} />
    </Card>
  ),
}

export function DocumentExample({ type }: { type: DocType }) {
  return <>{EXAMPLES[type]()}</>
}
