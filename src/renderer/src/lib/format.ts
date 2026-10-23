/** 75.5 → "1:15.5" */
export function formatTime(seconds: number | undefined | null, decimals = 0): string {
  if (seconds === undefined || seconds === null || !Number.isFinite(seconds)) return '–'
  const sign = seconds < 0 ? '-' : ''
  const abs = Math.abs(seconds)
  const m = Math.floor(abs / 60)
  const s = abs - m * 60
  const secs =
    decimals > 0
      ? s.toFixed(decimals).padStart(3 + decimals, '0')
      : String(Math.floor(s)).padStart(2, '0')
  return `${sign}${m}:${secs}`
}

/** "1:15.5", "75.5" of "" → seconden (undefined voor leeg/ongeldig). */
export function parseTime(text: string): number | undefined {
  const t = text.trim().replace(',', '.')
  if (t === '') return undefined
  const parts = t.split(':')
  if (parts.length > 2) return undefined
  const nums = parts.map(Number)
  if (nums.some((n) => !Number.isFinite(n) || n < 0)) return undefined
  return nums.length === 2 ? nums[0] * 60 + nums[1] : nums[0]
}

export function percent(value: number): string {
  return `${Math.round(value * 100)}%`
}

const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

/** "zojuist", "5 minuten geleden", "vandaag om 14:05", "gisteren om 09:30", "3 dagen geleden", "12 okt". */
export function relativeDate(ms: number, now = Date.now()): string {
  const minutes = Math.floor((now - ms) / 60_000)
  if (minutes < 1) return 'zojuist'
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minuut' : 'minuten'} geleden`

  const date = new Date(ms)
  const today = new Date(now)
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOfDay(today) - startOfDay(date)) / 86_400_000)
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  if (days === 0) return `vandaag om ${time}`
  if (days === 1) return `gisteren om ${time}`
  if (days < 7) return `${days} dagen geleden`
  const day = `${date.getDate()} ${MONTHS[date.getMonth()]}`
  return date.getFullYear() === today.getFullYear() ? day : `${day} ${date.getFullYear()}`
}
