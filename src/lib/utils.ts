import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format a number with 2 decimal places and thousands comma separator */
export function formatNumber(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/** Format currency — reads symbol from global state or defaults to ج.م */
export function formatCurrency(amount: number, symbol?: string): string {
  const sym = symbol || (typeof window !== 'undefined' ? (window as any).__currencySymbol : null) || 'ج.م'
  return `${formatNumber(amount)} ${sym}`
}

/** Legacy alias for EGP — uses global currency symbol if set */
export function formatEGP(amount: number, symbol?: string): string {
  return formatCurrency(amount, symbol)
}

/** Play a short beep sound (Web Audio API — no files needed) */
export function playBeep(frequency = 800, duration = 150, volume = 0.3) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.frequency.value = frequency
    oscillator.type = 'sine'
    gain.gain.value = volume
    oscillator.start()
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000)
    oscillator.stop(ctx.currentTime + duration / 1000)
  } catch { /* audio context may not be available */ }
}

/** Error beep — lower pitch, longer duration */
export function playErrorBeep() {
  playBeep(300, 250, 0.3)
}
