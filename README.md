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
