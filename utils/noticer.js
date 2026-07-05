// =====================================================================
//  The "noticer" — Organize's on-device companion brain (step 1).
//  Pure functions: look at habits, to-dos and the journal, and return
//  gentle observations with a question attached. No network, no AI —
//  just honest pattern-spotting. (Step 2 swaps the canned phrasing for
//  Claude-generated questions; the rules here stay.)
//
//  Each notice: { id, kind, text, question }
//  The id embeds today's date so a dismissal only lasts the day.
// =====================================================================

import { todayKey, addDays, diffDays, currentStreak, bestStreak } from './dates';

// Deterministic variety: same notice keeps the same wording all day,
// but different habits/days land on different phrasings.
function pick(variants, seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 9973;
  return variants[h % variants.length];
}

const STOPWORDS = new Set([
  'that', 'this', 'with', 'have', 'from', 'they', 'them', 'were', 'been',
  'their', 'would', 'could', 'should', 'about', 'there', 'which', 'when',
  'what', 'will', 'just', 'like', 'really', 'today', 'because', 'then',
  'than', 'some', 'more', 'very', 'much', 'time', 'going', 'want', 'need',
  'still', 'into', 'over', 'after', 'before', 'feel', 'feeling', 'felt',
  'good', 'been', 'being', 'dont', "don't", 'didnt', "didn't", 'thing',
  'things', 'week', 'days', 'made', 'make', 'making', 'work', 'though',
]);

export function getNotices({ habits, todos, journal, today = todayKey() }) {
  const notices = [];
  const add = (priority, kind, subject, text, question) =>
    notices.push({ priority, kind, id: `${kind}:${subject}:${today}`, text, question });

  const journalDays = Object.keys(journal).sort();
  const daySet = new Set(journalDays);
  const recent = journalDays.filter((k) => k >= addDays(today, -6)); // last 7 days

  // ---- Mood check-in (highest priority — people over tasks) ----
  const lastFour = journalDays.slice(-4).map((k) => journal[k].mood);
  const lowish = lastFour.filter((m) => m === 'low' || m === 'tired').length;
  const brightish = lastFour.filter((m) => m === 'driven' || m === 'steady').length;
  if (lastFour.length >= 3 && lowish >= 2) {
    add(1, 'mood_dip', 'mood',
      pick([
        'The last few entries have felt heavier than usual.',
        'Your mood has dipped across recent entries.',
      ], `mood_dip${today}`),
      pick([
        'What would make tomorrow feel a little lighter?',
        'What is one small thing that usually helps when the week gets heavy?',
      ], `q${today}`));
  } else if (lastFour.length >= 4 && brightish >= 3) {
    add(6, 'mood_up', 'mood',
      'Your recent entries have had real momentum in them.',
      'What has been working lately that you want to protect?');
  }

  // ---- Habits: lapses and strong streaks ----
  habits.forEach((h) => {
    const days = new Set(h.history || []);
    if (days.size === 0) return;
    const weekly = h.target && h.target < 7; // e.g. 3×/week
    const last = (h.history || [])[h.history.length - 1];
    const gap = diffDays(last, today);
    const best = bestStreak(days);
    const streak = h.streak || 0;
    // A 2×/week habit isn't "lapsed" after 3 quiet days — give weekly
    // habits a full week's grace before saying anything.
    const lapseAfter = weekly ? 8 : 3;

    if (gap >= lapseAfter && days.size >= 3) {
      add(2, 'habit_lapsed', h.id,
        pick([
          `“${h.name}” has slipped for ${gap} days — your best run was ${best} in a row.`,
          `It's been ${gap} days since “${h.name}”. You've managed ${best} straight before.`,
        ], h.id + today),
        pick([
          `What usually gets in the way of ${h.name.toLowerCase()}?`,
          `What would make ${h.name.toLowerCase()} easier to restart tomorrow?`,
        ], `q${h.id}${today}`));
    } else if (!weekly && [7, 14, 21, 30].includes(streak)) {
      add(7, 'habit_strong', h.id,
        `${streak} days straight of “${h.name}”. Quietly impressive.`,
        'What has changed now that this is becoming automatic?');
    } else if (weekly && [4, 8, 12].includes(streak)) {
      add(7, 'habit_strong', h.id,
        `${streak} weeks running you've hit your target for “${h.name}”.`,
        'What has changed now that this is becoming automatic?');
    }
  });

  // ---- To-dos: stuck and long-sitting ----
  todos.forEach((t) => {
    if (t.repeat || t.done) return;
    if (t.deadline && t.deadline < today && diffDays(t.deadline, today) >= 3) {
      const days = diffDays(t.deadline, today);
      add(3, 'todo_stuck', t.id,
        `“${t.title}” has been overdue for ${days} days.`,
        pick([
          'Is it still worth doing — or worth letting go of?',
          'What is the smallest first step that would unstick it?',
        ], t.id + today));
    } else if (!t.deadline) {
      // ids are Date.now() strings, so they double as created-at stamps.
      const created = parseInt(t.id, 10);
      if (created && Date.now() - created > 14 * 86400000) {
        add(8, 'todo_lingering', t.id,
          `“${t.title}” has been on the list for a couple of weeks.`,
          'Does it still matter to you, or is it just background guilt?');
      }
    }
  });

  // ---- Journal rhythm ----
  const jStreak = currentStreak(daySet);
  if (jStreak >= 3) {
    add(5, 'journal_streak', 'journal',
      `You've journalled ${jStreak} days in a row.`,
      pick([
        'What gave you energy today?',
        'What did today teach you that this streak helped you notice?',
      ], `js${today}`));
  } else if (journalDays.length >= 2 && !daySet.has(today)) {
    const lastEntry = journalDays[journalDays.length - 1];
    const gap = diffDays(lastEntry, today);
    if (gap >= 3) {
      add(4, 'journal_gap', 'journal',
        `It's been ${gap} days since your last entry.`,
        'No pressure — what is one honest line about today?');
    }
  }

  // ---- Recurring topic across recent entries ----
  if (recent.length >= 3) {
    const counts = {}; // word -> set of days it appears in
    recent.forEach((k) => {
      const words = new Set(
        (journal[k].text || '')
          .toLowerCase()
          .replace(/[^a-z\s']/g, ' ')
          .split(/\s+/)
          .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
      );
      words.forEach((w) => { counts[w] = (counts[w] || 0) + 1; });
    });
    const top = Object.entries(counts)
      .filter(([, n]) => n >= 3)
      .sort((a, b) => b[1] - a[1])[0];
    if (top) {
      add(4.5, 'recurring_topic', top[0],
        `“${top[0]}” keeps showing up in your entries this week.`,
        `What's really going on with ${top[0]}?`);
    }
  }

  return notices.sort((a, b) => a.priority - b.priority);
}
