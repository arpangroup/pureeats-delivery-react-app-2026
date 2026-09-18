import type { WalletTransaction } from '@/types/entities'

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString()
}

export const walletBalanceByUser: Record<number, number> = {
  501: 1840,
}

export const walletTransactionsByUser: Record<number, WalletTransaction[]> = {
  501: [
    { id: 1, type: 'credit', amount: 62, note: 'Payout for order PE-2026-000901', createdAt: hoursAgo(2) },
    { id: 2, type: 'credit', amount: 45, note: 'Payout for order PE-2026-000888', createdAt: hoursAgo(6) },
    { id: 3, type: 'debit', amount: 200, note: 'Withdrawal to bank account', createdAt: hoursAgo(30) },
    { id: 4, type: 'credit', amount: 58, note: 'Payout for order PE-2026-000850', createdAt: hoursAgo(28) },
    { id: 5, type: 'credit', amount: 500, note: 'Weekly incentive bonus', createdAt: hoursAgo(96) },
  ],
}
