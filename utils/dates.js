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

// Whole days between two keys (b - a).
export function diffDays(a, b) {
  return Math.round((parseKey(b) - parseKey(a)) / 86400000);
}

// Monday-first weekday index: Mon=0 … Sun=6 (the app is UK-style).
export function weekdayIndex(key) {
  return (parseKey(key).getDay() + 6) % 7;
}

export function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

// The date `day`-of-month lands on in a given year+month, clamped so
// "the 31st" still works in February (→ Feb 28/29).
function clampedKey(year, month, day) {
  return dateKey(new Date(year, month, Math.min(day, daysInMonth(year, month))));
}

// =====================================================================
//  Repeats
//  A to-do's repeat is null or one of:
//    { type: 'weekly',   days: [0..6] }            Mon=0 … Sun=6
//    { type: 'interval', every: 14 | 28, start }   every 2 / 4 weeks
//    { type: 'monthly',  day: 1..31 }              same date each month
// =====================================================================

export const WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
export const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Does this repeat land on the given day?
export function repeatOccursOn(repeat, key) {
  if (!repeat) return false;
  if (repeat.type === 'weekly') {
    return repeat.days.includes(weekdayIndex(key));
  }
  if (repeat.type === 'interval') {
    if (key < repeat.start) return false;
    return diffDays(repeat.start, key) % repeat.every === 0;
  }
  if (repeat.type === 'monthly') {
    const d = parseKey(key);
    return key === clampedKey(d.getFullYear(), d.getMonth(), repeat.day);
  }
  return false;
}

// The first day >= `from` that the repeat lands on.
export function nextOccurrence(repeat, from) {
  if (!repeat) return null;
  if (repeat.type === 'weekly') {
    for (let i = 0; i < 7; i++) {
      const k = addDays(from, i);
      if (repeat.days.includes(weekdayIndex(k))) return k;
    }
    return null; // empty days array — shouldn't happen
  }
  if (repeat.type === 'interval') {
    if (from <= repeat.start) return repeat.start;
    const gap = diffDays(repeat.start, from);
    const steps = Math.ceil(gap / repeat.every);
    return addDays(repeat.start, steps * repeat.every);
  }
  if (repeat.type === 'monthly') {
    const d = parseKey(from);
    const thisMonth = clampedKey(d.getFullYear(), d.getMonth(), repeat.day);
    if (thisMonth >= from) return thisMonth;
    return clampedKey(d.getFullYear(), d.getMonth() + 1, repeat.day);
  }
  return null;
}

// Ordinals for "monthly · 15th".
function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// A short human label for a repeat ("Mon + Thu", "every 2 wks", "15th monthly").
export function repeatLabel(repeat) {
  if (!repeat) return null;
  if (repeat.type === 'weekly') {
    if (repeat.days.length === 7) return 'daily';
    return repeat.days.map((d) => WEEKDAY_NAMES[d]).join(' + ');
  }
  if (repeat.type === 'interval') {
    return repeat.every === 14 ? 'every 2 wks' : 'every 4 wks';
  }
  if (repeat.type === 'monthly') return `${ordinal(repeat.day)} monthly`;
  return null;
}

// =====================================================================
//  Yearly reminders (birthdays): does a reminder land on this day?
// =====================================================================

export function reminderOccursOn(reminder, key) {
  if (!reminder.yearly) return reminder.date === key;
  if (key < reminder.date) return false; // not before the first occurrence
  const orig = parseKey(reminder.date);
  const d = parseKey(key);
  // Same month + day, clamped so a Feb 29 birthday shows on Feb 28.
  return key === clampedKey(d.getFullYear(), orig.getMonth(), orig.getDate());
}

// =====================================================================
//  Formatting + month grids
// =====================================================================

// "Morning" / "Afternoon" / "Evening" — for greeting the user by name.
export function greetingLabel(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return 'Morning';
  if (h < 18) return 'Afternoon';
  return 'Evening';
}

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

// "19:30" stays as-is; we store times as "HH:MM" 24h strings, which
// also sort correctly.

// The cells of a month grid, Monday-first (UK style).
// Returns an array of { key, day } or null (blank cells), in weeks of 7.
export function monthCells(year, month) {
  const first = new Date(year, month, 1);
  const leadingBlanks = (first.getDay() + 6) % 7; // getDay(): Sun=0 → Mon-first
  const days = daysInMonth(year, month);
  const cells = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  for (let d = 1; d <= days; d++) {
    cells.push({ key: dateKey(new Date(year, month, d)), day: d });
  }
  while (cells.length % 7 !== 0) cells.push(null); // trailing blanks
  return cells;
}

// =====================================================================
//  Streak maths (shared by Habits analytics and the Journal).
//  `daySet` is a Set of date keys on which the thing was done.
// =====================================================================

// Consecutive days ending today (or yesterday, so an unticked "today"
// doesn't zero the streak before the day is over).
export function currentStreak(daySet) {
  let k = daySet.has(todayKey()) ? todayKey() : yesterdayKey();
  let n = 0;
  while (daySet.has(k)) { n++; k = addDays(k, -1); }
  return n;
}

// Monday of the week containing `key` (the app is Monday-first).
export function weekStartKey(key) {
  return addDays(key, -weekdayIndex(key));
}

// How many days in the week starting `weekStart` are in the set.
export function countInWeek(daySet, weekStart) {
  let n = 0;
  for (let i = 0; i < 7; i++) if (daySet.has(addDays(weekStart, i))) n++;
  return n;
}

// For "3×/week"-style habits: consecutive weeks the target was hit.
// The current week counts once hit; until then it just doesn't break
// the run (the week isn't over yet).
export function weekStreak(daySet, target, today = todayKey()) {
  let ws = weekStartKey(today);
  let n = 0;
  if (countInWeek(daySet, ws) >= target) n++;
  ws = addDays(ws, -7);
  while (countInWeek(daySet, ws) >= target) { n++; ws = addDays(ws, -7); }
  return n;
}

// The longest run of consecutive days anywhere in history.
export function bestStreak(daySet) {
  let best = 0;
  daySet.forEach((k) => {
    if (daySet.has(addDays(k, -1))) return; // not the start of a run
    let n = 1;
    while (daySet.has(addDays(k, n))) n++;
    if (n > best) best = n;
  });
  return best;
}
