import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'EUR') {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat('es-ES').format(n)
}

export function formatPercent(n: number) {
  return `${n.toFixed(1)}%`
}

export function costPerContact(total: number, contacts: number) {
  return contacts > 0 ? total / contacts : 0
}
