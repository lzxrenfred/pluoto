# Pluoto

Pluoto turns friendships into a small living world in the clouds — **“My people, around me.”**

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The app starts with a six-person demo Plane; choose **Make it mine** to run the customization flow or **Explore Ren's demo** to enter the world immediately.

## What is implemented

- Exact shared square world: `64px` tiles, exactly `5 × 5` tiles per Plot, integer chunk coordinates
- Six illustrated demo Plots with original DOM/CSS/SVG characters and objects
- Pointer panning, cursor-centred wheel zoom, touch-safe viewport, and view reset
- Arrange mode with whole-Plot dragging, nearest-chunk ghost, collision prevention, and local placement persistence
- Lightweight CSS-only character roaming (no render-per-frame loop) and reduced-motion support
- Character cards with Pills and shared-Pill highlighting
- Four-step identity/Character/Pills/Plot customization flow with 100+ Pills and no selection cap
- QR plus short-code friend flow, request preview, request acceptance UI, and placement hand-off
- 24-hour Bubbles, replacement, expiry, and private owner-only Bubble Log
- Remove/block controls and no public directory/contact information
- `localStorage` persistence plus an installable manifest and offline shell cache

## Architecture

The world uses one coordinate system. `lib/world.ts` is the source of truth for tile and plot dimensions and all snapping/collision math. The camera transforms one `.world` container; every Plot is absolutely positioned at `(plotX * PLOT_SIZE, plotY * PLOT_SIZE)`. Objects and characters are always local to their Plot.

The current persistence adapter intentionally stays local while the product feel is refined. `AppState` in `lib/types.ts` is the backend seam: replace local storage reads/writes with a repository/service while keeping the world component driven by the same serializable state. Friend acceptance, propagation of owned Plot edits, and per-viewer placement should become separate server records when a backend is connected.

## Verification

```bash
npm test
npm run build
```

Grid tests cover exact alignment and uniqueness for 1, 5, 10, and 25 Plots.
