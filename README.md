# Pluoto

Pluoto turns friendships into a small living world in the clouds — **“My people, around me.”**

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The app starts with a four-person demo Plane; choose **Make it mine** to run the customization flow or **Explore Ren's demo** to enter the world immediately.

## What is implemented

- Shared 45-degree isometric projection with exactly `5 × 5` logical tiles per Space
- Four contiguous Spaces in a `2 × 2` Plane, with dimensional outer land faces
- Grid-anchored Characters, buildings, paths, trees, bushes, flowers, lamps and furniture
- Pointer panning, cursor-centred wheel zoom, touch-safe viewport, and view reset
- Arrange mode with whole-Plot dragging, nearest-chunk ghost, collision prevention, and local placement persistence
- Representative calm grid walking for Ren and Sarah, subtle idle and canopy movement, bubble fades, and Space-label camera focus
- Character cards with Pills and shared-Pill highlighting
- Four-step identity/Character/Pills/Plot customization flow with 100+ Pills and no selection cap
- QR plus short-code friend flow, request preview, request acceptance UI, and placement hand-off
- 24-hour Bubbles, replacement, expiry, and private owner-only Bubble Log
- Remove/block controls and no public directory/contact information
- `localStorage` persistence plus an installable manifest and offline shell cache

## Architecture

The world uses one coordinate system. `lib/world.ts` is the source of truth for logical tile dimensions, isometric projection, inverse drag projection, and all snapping/collision math. Every Space begins at `(plotX * 5, plotY * 5)` in logical grid coordinates. Land vertices, Characters, buildings, and environmental objects are projected from that same grid before the camera transforms the single `.world` container.

The current persistence adapter intentionally stays local while the product feel is refined. `AppState` in `lib/types.ts` is the backend seam: replace local storage reads/writes with a repository/service while keeping the world component driven by the same serializable state. Friend acceptance, propagation of owned Plot edits, and per-viewer placement should become separate server records when a backend is connected.

`PlaneLand` renders a single world surface from owned logical cells. The default four quadrants make exactly 100 unique cells with 25 per person. Visible vertical faces are generated only on exposed cell edges; internal Space boundaries have no slab faces. `tileToIso` and `isoToTile` share a 2:1 diamond projection (45° grid rotation), and arrangement uses the inverse projection. Placeholder objects and Characters use the same grid anchors and depth ordering. Houses reserve a 2×2 footprint; other placeholders occupy one cell. Assets remain placeholders pending visual approval.

## Verification

```bash
npm test
npm run build
```

Grid tests cover exact alignment and uniqueness for 1, 5, 10, and 25 Plots.

## Motion preview

Ren and Sarah take an adjacent, unoccupied tile step after a staggered initial pause, then rest for roughly 15–22 seconds. Click a Space name to focus; Reset view returns to the whole Plane. Open a Character card or enter Arrange to pause roaming. Reduced-motion disables autonomous movement, ambient animation, and camera transitions; hidden tabs suspend walking. `lib/motion.ts` provides shared timing, easing, walkable-neighbor selection, and logical poses/headings for future renderers. Current SVG placeholders demonstrate horizontal facing only; full directional poses await the approved asset implementation.
