import { defineMessages, type Locale } from '@shared/i18n'

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

export const DATE_MESSAGES = defineMessages(
  {
    justNow: 'zojuist',
    minuteAgo: '{count} minuut geleden',
    minutesAgo: '{count} minuten geleden',
    today: 'vandaag om {time}',
    yesterday: 'gisteren om {time}',
    daysAgo: '{count} dagen geleden',
    months: 'jan feb mrt apr mei jun jul aug sep okt nov dec',
    day: '{day} {month}',
    dayYear: '{day} {month} {year}'
  },
  {
    en: {
      justNow: 'just now',
      minuteAgo: '{count} minute ago',
      minutesAgo: '{count} minutes ago',
      today: 'today at {time}',
      yesterday: 'yesterday at {time}',
      daysAgo: '{count} days ago',
      months: 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec',
      day: '{month} {day}',
      dayYear: '{month} {day}, {year}'
    }
  }
)

/**
 * "zojuist", "5 minuten geleden", "vandaag om 14:05", "gisteren om 09:30", "3 dagen geleden",
 * "12 okt"; in het Engels "just now", …, "Oct 12".
 */
export function relativeDate(ms: number, now = Date.now(), locale: Locale = 'nl'): string {
  const t = DATE_MESSAGES.in(locale)
  const minutes = Math.floor((now - ms) / 60_000)
  if (minutes < 1) return t('justNow')
  if (minutes < 60) return t(minutes === 1 ? 'minuteAgo' : 'minutesAgo', { count: minutes })

  const date = new Date(ms)
  const today = new Date(now)
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOfDay(today) - startOfDay(date)) / 86_400_000)
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  if (days === 0) return t('today', { time })
  if (days === 1) return t('yesterday', { time })
  if (days < 7) return t('daysAgo', { count: days })
  const month = t('months').split(' ')[date.getMonth()]
  const params = { day: date.getDate(), month, year: date.getFullYear() }
  return t(date.getFullYear() === today.getFullYear() ? 'day' : 'dayYear', params)
}
