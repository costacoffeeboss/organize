# Organize

**Everything in its place.** — habit tracking, journalling and to-do lists in one calm place.

Tidy the little things and the big things follow.

## What's in here

| Path | What it is |
| --- | --- |
| `App.js` | The app — a **React Native + Expo** to-do list, calendar and habit tracker with on-device persistence (AsyncStorage). |
| `landing/index.html` | The marketing landing page (self-contained HTML/CSS). |
| `assets/` | App icons and splash images. |

## Running the app

Requires [Node.js](https://nodejs.org/) and the [Expo](https://docs.expo.dev/) toolchain.

```bash
npm install
npm start        # opens the Expo dev server — scan the QR code with Expo Go
npm run web      # run in a browser
npm run android  # run on an Android emulator/device
npm run ios      # run on an iOS simulator/device (macOS only)
```

## Viewing the landing page

Just open `landing/index.html` in any browser — no build step. Pushes to `master`
also deploy it to GitHub Pages via `.github/workflows/deploy-pages.yml`.

## Builds & over-the-air updates (EAS)

The installed app (TestFlight) updates itself over the air — no dev server needed:

- **Every push to `master`** → `.github/workflows/eas-update.yml` publishes the JS
  via EAS Update; installed builds fetch it next time the app opens.
- **Native changes only** (SDK bump, new native module, icons/config) →
  run the `Build iOS (TestFlight)` workflow manually from the Actions tab.
- One-time bootstrap lives in `.github/workflows/eas-setup.yml` (registers the
  project on expo.dev). Requires an `EXPO_TOKEN` repository secret.

## Tech

- React Native `0.81` · React `19` · Expo SDK `54`
- `@react-native-async-storage/async-storage` for local persistence

---

Built as a learning project — the source has plenty of explanatory comments.
