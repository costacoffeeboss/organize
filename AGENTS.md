# Organize — project handbook for Claude sessions

This file is the durable memory for this project. Read it before doing anything.
The owner (costacoffeeboss) is a beginner-friendly builder: explain things simply,
don't assume they know git/Expo jargon, and do the work end-to-end yourself
(commit + push) rather than giving them terminal instructions unless a step
genuinely requires their phone or their Apple/Expo account.

## Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/latest/ before writing
any code that touches Expo APIs. This project is on **Expo SDK 54** (React Native 0.81.5,
React 19) — use SDK 54 docs, not newer.

## What the app is

"Organize" — an iPhone habit-tracker / life-organizer built with React Native + Expo.
Warm coffee-shop aesthetic (cream `#ecdfc8`, espresso `#4b3626`, gold `#b8874b`, Georgia serif —
see `theme.js`). Six swipeable bottom tabs (material top tab navigator with
`tabBarPosition="bottom"`):

| Tab | File | What it does |
|---|---|---|
| Home | `screens/HomeScreen.js` | Greeting + settings cog (name edit, danger-zone data reset), companion notice card, habit progress ring, "On today" (events/reminders/tickable todos), journal shortcut |
| To-dos | `screens/TodosScreen.js` | Overdue/Today sections, expandable To-do + Upcoming groups; add popup with repeats (daily / weekly day-chips / every 2wk / every 4wk / monthly day) XOR deadline |
| Calendar | `screens/CalendarScreen.js` | Compact month + day list (Events/Reminders/To-dos); add event (optional time) or reminder (yearly toggle); tap ⤢ month title → full-screen expanded month/week view with event ribbons and vertical swipe between months |
| Habits | `screens/HabitsScreen.js` | Big progress ring, per-habit weekly target (1–7 days/week), Mon–Sun week strip, streaks (`🔥 3w` for weekly targets), week-complete celebration animation, analytics modal with heatmap |
| Goals | `screens/GoalsScreen.js` | SMART goals: quick-add or full editor, expandable cards with tickable milestones, "Make it SMART" nudge, inspiration quiz (`components/GoalQuiz.js` — scenario questions → ranked ideas) |
| Journal | `screens/JournalScreen.js` | Today \| Goals segments; free-writing per day + "one step at a time" goal-step log; dotted calendars |

`App.js` is the state brain: it owns all data state, persistence, migrations, and passes
actions down as props. `screens/WelcomeScreen.js` is a 3-step animated onboarding shown
until `welcomed` is true.

## Data model (all local, AsyncStorage)

Storage keys: `@atomic_habits_v1` (habits — legacy name, keep it), `@organize_todos_v2`
(v1 exists as legacy, migrated on load), `@organize_events_v1`, `@organize_reminders_v1`,
`@organize_journal_v1`, `@organize_goals_v1`, `@organize_steps_v1`, `@organize_welcomed_v1`,
`@organize_name`, plus screen-local `@organize_habits_subtab`, `@organize_dismissed_notices`,
`@organize_goals_intro_seen`. `resetAllData()` in App.js wipes everything starting with
`@organize_` or `@atomic_`.

Date logic lives in `utils/dates.js` (Monday-first weeks, date keys `YYYY-MM-DD`,
repeat/reminder occurrence math, streaks, `weekStreak`/`countInWeek` for weekly targets,
leap-day clamping). If you touch it, sanity-check with a small node script.
`utils/noticer.js` is the on-device rules engine behind the Home companion card.

Shared components in `components/`: `ModalShell` (centered card modal), `FullPage`
(full-screen wrapper using `useSafeAreaInsets` — **always use this instead of SafeAreaView
inside a full-screen `<Modal>`**, because on the new architecture SafeAreaView doesn't
apply insets there), `MonthGrid`, `CalendarPager`, `FAB`, `Rise` (staggered entrance),
`ProgressRing` (SVG), `CompanionCard`, `GoalQuiz`.

Other gotchas learned the hard way:
- Never define row components inline inside a screen's render — remounts kill animations.
  Hoist them to module level (see `HabitRow`).
- PanResponders that read state must be created per-render, not memoised, or they close
  over stale state.
- Keyboard + full-screen input: put a ScrollView (`flexGrow:1`, `keyboardShouldPersistTaps`)
  inside the KeyboardAvoidingView (see WelcomeScreen).

## Repo, accounts, deployment

- **GitHub repo:** `costacoffeeboss/organize` (public). Default branch is **`master`** —
  all work goes straight to master, no PRs, no feature branches (owner's preference).
- **Expo:** owner `costasbowgen`, project `organize`,
  projectId `d47274fa-5fef-47f1-9976-f885ba9f0c10`,
  updates URL `https://u.expo.dev/d47274fa-5fef-47f1-9976-f885ba9f0c10`.
- **iOS:** bundle ID `com.costacoffeeboss.organize`, distributed via TestFlight.
  Apple Developer account (Individual) is under **costasbowgen@gmail.com**;
  Expo + GitHub are under **costacoffeeboss@gmail.com**. Don't mix these up.
- **Landing page:** `landing/` → GitHub Pages at https://costacoffeeboss.github.io/organize/
  (workflow `deploy-pages.yml`).

### The ship loop (this is the whole point)

1. You edit code and push to `master`.
2. `.github/workflows/eas-update.yml` runs automatically and publishes an **EAS Update (OTA)**
   to channel `production` (~1–2 min). It skips pushes that only touch `landing/`, `**.md`,
   or the pages workflow.
3. The owner force-closes and reopens Organize on their iPhone → the update downloads on
   launch (`checkAutomatically: ON_LOAD`, `fallbackToCacheTimeout: 5000`).

So: **JS-only changes ship OTA on every push. Nothing else needed.**

**Native changes** (new native module, permissions, SDK upgrade, anything touching
`app.json` native config) do NOT ship OTA — they need a new TestFlight build:
`.github/workflows/eas-build-ios.yml` (manual `workflow_dispatch`, input `submit`
defaults true → auto-submits to TestFlight). The owner triggers it with one click on
GitHub → Actions, then installs from TestFlight (~15–30 min). Builds use
`runtimeVersion: { policy: "appVersion" }` (currently 1.0.0) — an OTA only reaches builds
with the same app version, so after bumping the version, rebuild before OTAs land.
TestFlight builds expire after ~90 days.

Secrets already in place: `EXPO_TOKEN` in GitHub repo secrets; App Store Connect API key
(APP_MANAGER role) stored on EAS servers. Don't ask the owner to redo any of that.

### Sandbox constraints (cloud Claude sessions)

- The proxy blocks: Expo's API (`npx expo install` fails — pin versions manually from
  `node_modules/expo/bundledNativeModules.json`), tunnels/dev servers (exit 144), and
  fetching `github.io` pages.
- You can't run the app. Use `CI=1 npx expo export -p ios` as the bundle-check that the
  JS at least compiles before pushing.
- Use the GitHub MCP tools (`mcp__github__*`) to check Actions runs after pushing.

### Conventions

- Commit style: short imperative subject describing the user-visible change
  (e.g. "Add settings cog with name edit and data reset").
- Run the expo-export bundle check before every push.
- `.md`-only pushes don't trigger an OTA (paths-ignore) — safe for docs commits.

## Roadmap / current state

- Pipeline fully proven: landing page live, OTA green on every push, first TestFlight
  build installed on the owner's phone. Commit `7a79481` (settings cog) was the first
  real OTA.
- **Next up: sign-in + cloud sync via Supabase** (chosen over Firebase — free tier
  allows outbound calls for the future Claude proxy). Plan: optional/skippable sign-in
  with Apple (native, `expo-apple-authentication` — **native module, needs a TestFlight
  rebuild**) and Google (OAuth); Apple sign-in is mandatory per App Store rule 4.8 once
  Google is offered. Postgres tables + row-level security, local-first sync (app works
  offline, syncs when signed in), first sign-in uploads existing local data.
  **Waiting on the owner to create a supabase.com project and provide the Project URL +
  anon public key.**
- Held for later: companion "step 2" — real Claude API observations via a Supabase Edge
  Function proxy (model `claude-opus-4-8`), opt-in toggle since journal text would leave
  the device. Push notifications (needs native build). Possible fencing of the expanded
  calendar's vertical swipe vs the tab pager if the owner reports conflicts.
