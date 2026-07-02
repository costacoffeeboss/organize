// =====================================================================
//  Date helpers
//  We identify a day with a string like "2026-07-02" (local time).
//  Strings in this format sort correctly ("2026-07-02" < "2026-07-10"),
//  which makes comparing deadlines as easy as `a < b`.
// =====================================================================

export function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayKey() {
  return dateKey();
}

export function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dateKey(d);
}

// "2026-07-02" -> a real Date object (at local midnight).
export function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key, n) {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

// Add whole months, clamping the day (Jan 31 + 1 month = Feb 28).
export function addMonths(key, n) {
  const d = parseKey(key);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return dateKey(d);
}

// When does a recurring task come around again, counting from `fromKey`?
export function nextOccurrence(fromKey, recur) {
  if (recur === 'daily') return addDays(fromKey, 1);
  if (recur === 'weekly') return addDays(fromKey, 7);
  if (recur === 'fortnightly') return addDays(fromKey, 14);
  if (recur === 'monthly') return addMonths(fromKey, 1);
  return null;
}

export const RECUR_LABELS = {
  daily: 'daily',
  weekly: 'weekly',
  fortnightly: 'every 2 weeks',
  monthly: 'monthly',
};

// "Thursday 2 July"
export function niceDate(key = todayKey()) {
  return parseKey(key).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

// "Thu 2 Jul"
export function shortDate(key) {
  return parseKey(key).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

// "July 2026"
export function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString('en-GB', {
    month: 'long', year: 'numeric',
  });
}

// The cells of a month grid, Monday-first (UK style).
// Returns an array of { key } or null (blank leading cells), in weeks of 7.
export function monthCells(year, month) {
  const first = new Date(year, month, 1);
  const leadingBlanks = (first.getDay() + 6) % 7; // getDay(): Sun=0 → Mon-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ key: dateKey(new Date(year, month, d)), day: d });
  }
  while (cells.length % 7 !== 0) cells.push(null); // trailing blanks
  return cells;
}
