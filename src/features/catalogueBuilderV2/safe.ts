export const safeArray = <T = unknown,>(value: unknown): T[] =>
  Array.isArray(value) ? (value as T[]) : []

export const safeString = (value: unknown, fallback = ''): string => {
  if (value === undefined || value === null) return fallback
  return String(value)
}

export const safeNumber = (value: unknown, fallback = 0): number => {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : fallback
}

export const safeDate = (value: unknown): Date | null => {
  if (!value) return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  ) {
    const date = (value as { toDate: () => unknown }).toDate()
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { seconds?: unknown }).seconds === 'number'
  ) {
    const date = new Date(Number((value as { seconds: number }).seconds) * 1000)
    return Number.isNaN(date.getTime()) ? null : date
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  return null
}

export const safeBoolean = (value: unknown, fallback = false): boolean => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', 'yes', '1', 'active', 'enabled'].includes(normalized)) return true
    if (['false', 'no', '0', 'inactive', 'disabled'].includes(normalized)) return false
  }
  if (typeof value === 'number') return value !== 0
  return fallback
}
