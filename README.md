# SiteFuse — Next-Gen Focus & Productivity Extension

SiteFuse is a powerful, privacy-first Chrome extension for tracking website usage, enforcing limits, and helping users stay focused. This repository contains the extension source built with React + Vite and packaged as a Manifest V3 extension in `dist/`.

**Key highlights:**

- Intelligent site categorization and predictions (social, video, shopping, news, gaming, productivity).
- One-click Focus Mode to block distracting sites for a set duration.
- Smart limits that auto-adjust based on usage trends.
- Animated, interactive notifications with snooze/extend quick actions and countdowns.
- Rich, responsive UI with interactive charts and drag & drop site prioritization.
- Gamification: streaks, badges, and a small virtual coin economy for rewards.

**Repository layout (important files)**

- `src/` — extension source code (React UI, background service worker, content scripts).
  - `src/background/background.js` — background service worker; alarms, usage aggregation, Focus Mode logic, notifications, predictive suggestions.
  - `src/content/content.js` — content script for blocking/redirection behavior.
  - `src/popup/` — popup UI (`Popup.jsx`, `UsageChart.jsx`, etc.).
  - `src/options/` — extension options / dashboard UI and panels.
  - `src/utils/` — utilities for categories, storage, favicons, notifications helpers.
- `dist/` — production-ready extension build (ready to load unpacked in Chrome).
- `package.json` — scripts and dependencies.

Getting started (development)

1. Install dependencies

```bash
cd /c/Users/HP/Desktop/Web/PROJECTTT/SiteFuse
npm install
```

2. Run dev server

```bash
npm run dev
```

This starts Vite for the UI. The extension uses `src/background/background.js` as the MV3 service worker; during development you can load the unpacked extension and use the Vite dev server for UI pages (`popup.html`, `options.html`) to speed iterative UI work.

3. Build production extension

```bash
npm run build
```

After building, `scripts/copy-extension-scripts.js` copies the background/content service worker and other static files into `dist/` so the folder is ready to load as an unpacked extension in Chrome.

Load extension in Chrome (quick)

1. Open `chrome://extensions/` in Chrome.
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked**, select the project's `dist/` folder.

Core features & UX

- Site intelligence

  - Automatic domain categorization with confidence scoring (`src/utils/categories.js`).
  - Smart suggested limits based on heuristics and recent usage.
  - Predicted distractions trigger proactive suggestions.

- Focus Mode & blocking

  - `start-focus`/`stop-focus` messages from UI let users block categories/domains for a chosen duration.
  - Grace periods: when a limit is hit, tabs get a short grace (configurable in code) with a countdown notification; if the user doesn't act the tab is closed and the domain is blocked.

- Notifications & interactions

  - Live-progress notifications (snooze / extend actions) are implemented in the background worker, with animated countdown notifications for grace periods.

- UI & analytics

  - Popup has an interactive `UsageChart` (line + pie) and drag-and-drop for top sites.
  - Options page includes category defaults, schedules, whitelist, and gamification rewards.

- Gamification
  - Badges and streaks are evaluated daily and coins are awarded for achievements. Coins can be redeemed in the options UI (example theme unlock flow is scaffolded).

Developer notes

- Storage & data

  - Persistent data is stored via `chrome.storage.local`. Key helpers are in `src/utils/storage.js`.
  - `usage` — per-domain seconds today.
  - `usageHistory` — timestamped entries for trends and predictions.
  - `limits` — per-domain daily limits (minutes).
  - `blocked` — map of blocked domains (boolean or { until }).
  - `grace` — per-tab grace entries keyed by tabId.

- Background alarms

  - `sitefuse_tick` runs every minute (or faster in debug) and attributes seconds to open tabs.
  - `sitefuse_grace` checks and enforces grace expirations.
  - `sitefuse_daily` runs daily for badge evaluation, limit adjustments and cleanup.

- Adding categories or tuning detection
  - Update `src/utils/categories.js`. The file includes `CATEGORY_RULES` and advanced helpers such as `classifyUrlWithConfidence` and `predictDistraction`.

Extending the project (suggested next tasks)

- Accessibility: complete ARIA roles, keyboard navigation, and screen reader testing across `popup`, `options`, and `blocked` pages.
- Heatmap visualization: add a dedicated hourly heatmap chart for usage patterns (can use a canvas-based heatmap or Chart.js matrix plugin).
- Calendar integration: auto-pause during calendar events (requires OAuth and user consent; scaffold available in background worker).
- Premium analytics and export: add scheduled weekly summary emails (requires user-provided email backend) and richer CSV/JSON export options.

Safety & privacy

- SiteFuse stores usage locally in the user's browser (`chrome.storage.local`). No external telemetry or analytics endpoints are called by default.
- If you add remote integrations (email, calendar), make the flows explicitly opt-in and declare the scopes and storage behaviors.

Contributing

1. Fork the repo and open a branch for your feature.
2. Run the dev server and ensure your changes are linted and build successfully.
3. Open a PR with a descriptive title and link any related issues.

Credits

- Built with React, Vite, Tailwind CSS and Chart.js. UI micro-interactions use Framer Motion.

License

Specify your preferred license here (e.g. MIT) or contact the project owner.

—
SiteFuse aims to be intuitive, proactive, and delightful while keeping your data local. If you'd like, I can now:

- Finish the full ARIA/accessibility pass and keyboard shortcuts.
- Add a heatmap component and wire export options.
- Implement a guided onboarding flow in `options` and `popup`.

Tell me which you'd like next and I'll continue and commit each step.

# SiteFuse

SiteFuse is a Chrome extension (Manifest V3) that tracks website usage time, enforces per-domain time limits, and blocks sites when limits are exceeded.

This build includes a premium Tailwind + Framer Motion UI with Heroicons and a debug mode for fast testing.

## Install

Requirements: Node.js (16+), npm

```bash
cd /c/Users/HP/Desktop/Web/PROJECTTT/SiteFuse
npm install
```

## Build

```bash
npm run build
```

After building, load the `dist` folder in Chrome as an unpacked extension:

1. Open `chrome://extensions/`
2. Enable Developer mode
3. Click "Load unpacked" and pick `.../SiteFuse/dist`

## Project structure

- `public/` - static HTML entries and `manifest.json`.
- `src/` - React UI and scripts
  - `popup/Popup.jsx` - Popup dashboard UI
  - `options/Options.jsx` - Options/settings UI
  - `blocked/Blocked.jsx` - Blocked page UI
  - `background/background.js` - MV3 service worker (timer, alarms)
  - `content/content.js` - content script that redirects blocked pages
  - `utils/storage.js` - helpers for `chrome.storage`
  - `styles/tailwind.css` - Tailwind entry styles
- `scripts/copy-extension-scripts.js` - copies `background.js` and `content.js` into `dist` after build

## Debug mode

In Options, enable Debug mode to reduce the timer increment to 5 seconds for testing. Note: Chrome may clamp alarm intervals; this is intended for development only.

## Notes

- The background logic, storage schema, and blocking behavior were preserved. UI components were rebuilt with Tailwind + Framer Motion.
- Replace the `public/icon*.png` files with your branded icons for production.
