# App Store listing — copy & paste sheet

Everything you type into App Store Connect for the **1.0** version, ready to paste.
Fields map to the sections in App Store Connect → your app → the version page.

---

## App name  *(max 30 chars)*
```
Organize: Habits & Journal
```
*(26 chars. If taken, fall back to `Organize — Calm Planner`.)*

## Subtitle  *(max 30 chars)*
```
Everything in its place
```

## Category
- **Primary:** Productivity
- **Secondary:** Lifestyle

## Promotional text  *(max 170 chars — editable any time without review)*
```
Tidy the little things and the big things follow. Habits, to-dos, a calendar and a gentle daily journal — all in one calm place, all on your device.
```

## Description  *(max 4000 chars)*
```
Organize is a calm home for the things you're trying to keep on top of — your habits, your to-dos, your calendar and a gentle daily journal — without the clutter, the accounts or the noise.

Everything in its place.

HABITS THAT STICK
Track the habits you care about, set a target (daily, or a few times a week), and watch your streaks build. Missed a day? Backfill it. Tapped something off? It tucks neatly into a Completed section so your list stays clean.

TO-DOS THAT KNOW THE DATE
Add to-dos with deadlines and repeats — daily, weekly, every two weeks, or "once a week, any day." Overdue things surface gently; finished things drop into Completed. Expand Upcoming to see everything still ahead at a glance.

A CALENDAR YOU ALREADY TRUST
See your events in a smooth, continuously scrolling month view. Multi-day events run as one clean ribbon. Connect your iPhone's calendar and your real events appear alongside Organize's own, read-only — nothing is changed or copied off your phone.

A JOURNAL THAT MEETS YOU WHERE YOU ARE
A guided check-in asks how you're feeling and what you did today, then opens into one calm page to write as much or as little as you like. Organize quietly notices patterns — a habit slipping, a mood returning, an activity that tends to lift your day — and asks a kind question rather than nagging.

MORNING RUNDOWN, EVENING RECAP
Start the day with a quick rundown of what's ahead and close it with a short recap. Optional reminders at 7am and 7pm keep it light-touch.

WORK AND LIFE, SIDE BY SIDE
Flip between your Life side and a focused Work side, each with its own look. Keep habits, to-dos and journals separate — and share calendar events across both when it helps.

PRIVATE BY DESIGN
No accounts. No sign-in. No tracking, no ads. Everything you write stays on your device. Delete the app and it's gone — it was only ever yours.

Tidy the little things, and the big things follow.
```

## Keywords  *(max 100 chars, comma-separated, no spaces after commas)*
```
habit,tracker,journal,todo,to-do,planner,calendar,mood,diary,productivity,goals,routine,reminders
```

## Support URL  *(required)*
```
https://costacoffeeboss.github.io/organize/
```

## Marketing URL  *(optional)*
```
https://costacoffeeboss.github.io/organize/
```

## Privacy Policy URL  *(required)*
```
https://costacoffeeboss.github.io/organize/privacy.html
```

---

## App Privacy questionnaire  *(App Store Connect → App Privacy → "Get Started")*

Answer: **"No, we do not collect data from this app."**

Rationale (true for Organize): all data is stored on-device via local storage; there
are no accounts, no analytics, no ads, no third-party SDKs that collect data. The
phone-calendar read is on-device and read-only, and notifications are scheduled
locally — neither leaves the device, so neither counts as "collected" data.

> If App Store Connect pushes back because the app requests calendar/notification
> permissions, that's fine — permission to *access* something on the device is not
> the same as *collecting* it. Keep the answer "data not collected."

---

## Age rating  *(App Store Connect → Age Rating → Edit)*
Answer **None / No** to every content question. Result: **4+**.

---

## Pricing & Availability
- **Price:** Free
- **Availability:** All countries/regions (or narrow if you prefer)

---

## Build
Attach the latest build that's already gone through TestFlight (the EAS build
auto-submits there). In the version page → **Build** → select it.

## Export compliance
Already declared in the app (`ITSAppUsesNonExemptEncryption: false`), so you'll just
confirm "no" to using non-exempt encryption when prompted.

## Review notes  *(optional, to App Review)*
```
Organize stores all data locally on the device. No account or login is required —
just open the app and start. Calendar access is optional and read-only; notifications
are scheduled locally.
```

## Release
Choose **"Automatically release this version"** after approval, or hold it to release
manually with one tap.
