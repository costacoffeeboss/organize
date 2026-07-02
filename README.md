# Atomic

**Small pieces. Big impact.** — habit tracking, journalling and to-do lists in one place.

Get the small pieces of your life in order and watch the impact compound.

## What's in here

| Path | What it is |
| --- | --- |
| `App.js` | The app — a single-screen **React Native + Expo** habit tracker with on-device persistence (AsyncStorage). |
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

Just open `landing/index.html` in any browser — no build step.

## Tech

- React Native `0.81` · React `19` · Expo SDK `54`
- `@react-native-async-storage/async-storage` for local persistence

---

Built as a learning project — the source has plenty of explanatory comments.
