/**
 * Bulletproof Date and Time Utilities for INSITEZ Salud
 * Prevents "RangeError: Invalid time value" across all browsers, environments and input types.
 */

/**
 * Returns a guaranteed valid fallback Date object.
 */
function getValidFallback(fallback?: Date): Date {
  if (fallback instanceof Date && !isNaN(fallback.getTime())) {
    return new Date(fallback.getTime());
  }
  return new Date();
}

/**
 * Parses any date value (string, number, Date object, ISO string, DD/MM/YYYY, corrupt strings)
 * into a guaranteed-valid Date object. NEVER returns an Invalid Date or throws RangeError.
 */
export function safeParseDate(val: any, fallback?: Date): Date {
  const safeFallback = getValidFallback(fallback);
  if (!val) return safeFallback;

  if (val instanceof Date) {
    return isNaN(val.getTime()) ? safeFallback : new Date(val.getTime());
  }

  if (typeof val === 'number') {
    if (isNaN(val) || !isFinite(val)) return safeFallback;
    const d = new Date(val);
    return isNaN(d.getTime()) ? safeFallback : d;
  }

  let str = String(val).trim();
  if (!str) return safeFallback;

  // Corrupted object string like "{newDate=2026-08-21}" or "newDate: 2026-08-21"
  if (str.startsWith('{') || str.includes('newDate=') || str.includes('newDate:')) {
    const match = str.match(/newDate[=:]\s*["']?([^,"'}]+)/i);
    if (match && match[1]) {
      str = match[1].trim();
    }
  }

  // 1. Match YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss or YYYY/MM/DD
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10) - 1;
    const d = parseInt(isoMatch[3], 10);
    const hh = isoMatch[4] ? parseInt(isoMatch[4], 10) : 12;
    const mm = isoMatch[5] ? parseInt(isoMatch[5], 10) : 0;
    const ss = isoMatch[6] ? parseInt(isoMatch[6], 10) : 0;
    if (y >= 1900 && y <= 2100 && m >= 0 && m <= 11 && d >= 1 && d <= 31) {
      return new Date(y, m, d, hh, mm, ss);
    }
  }

  // 2. Match DD/MM/YYYY or DD-MM-YYYY
  const latinMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (latinMatch) {
    const d = parseInt(latinMatch[1], 10);
    const m = parseInt(latinMatch[2], 10) - 1;
    const y = parseInt(latinMatch[3], 10);
    const hh = latinMatch[4] ? parseInt(latinMatch[4], 10) : 12;
    const mm = latinMatch[5] ? parseInt(latinMatch[5], 10) : 0;
    const ss = latinMatch[6] ? parseInt(latinMatch[6], 10) : 0;
    if (y >= 1900 && y <= 2100 && m >= 0 && m <= 11 && d >= 1 && d <= 31) {
      return new Date(y, m, d, hh, mm, ss);
    }
  }

  // 3. Fallback standard Date constructor
  try {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  } catch {
    // Ignore error
  }

  return safeFallback;
}

/**
 * Returns a standardized "YYYY-MM-DD" string from any date input.
 * Always produces a valid, non-empty 10-character string. Never throws.
 */
export function safeFormatISO(val: any): string {
  try {
    const d = safeParseDate(val);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
}

/**
 * Formats a date to localized human string safely without crashing. Never throws.
 */
export function safeFormatLocaleDate(
  val: any,
  options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' },
  locale: string = 'es-ES'
): string {
  try {
    const d = safeParseDate(val);
    if (isNaN(d.getTime())) {
      return String(val || '');
    }
    return d.toLocaleDateString(locale, options);
  } catch {
    return String(val || '');
  }
}

/**
 * Safely extracts day number (1-31). Never throws.
 */
export function safeGetDayNum(val: any): number {
  try {
    const d = safeParseDate(val);
    return isNaN(d.getTime()) ? new Date().getDate() : d.getDate();
  } catch {
    return new Date().getDate();
  }
}

/**
 * Safely extracts month name (e.g. "agosto" or "ago"). Never throws.
 */
export function safeGetMonthName(val: any, format: 'short' | 'long' = 'long'): string {
  try {
    const d = safeParseDate(val);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('es-ES', { month: format });
  } catch {
    return '';
  }
}

/**
 * Safely extracts weekday name (e.g. "viernes"). Never throws.
 */
export function safeGetWeekdayName(val: any, format: 'short' | 'long' = 'long'): string {
  try {
    const d = safeParseDate(val);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('es-ES', { weekday: format });
  } catch {
    return '';
  }
}
