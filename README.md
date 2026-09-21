# Pluoto

Pluoto turns friendships into a small living world in the clouds — **“My people, around me.”**

## Run locally

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:3000`. A new local Plane enters the world-based onboarding flow; existing demo Plane URLs continue to open without destructive migration.

## What is implemented

- Shared 45-degree isometric projection with exactly `5 × 5` logical tiles per Space
- Four contiguous Spaces in a `2 × 2` Plane, with dimensional outer land faces
- Grid-anchored Characters, buildings, paths, trees, bushes, flowers, lamps and furniture
- Pointer panning, cursor-centred wheel zoom, touch-safe viewport, and view reset
- Arrange mode with whole-Plot dragging, nearest-chunk ghost, collision prevention, and local placement persistence
- Representative calm grid walking for Ren and Sarah, subtle idle and canopy movement, bubble fades, and Space-label camera focus
- Character cards with Pills and shared-Pill highlighting
- World-based email/password account flow, nickname, live 3D Character, optional Pills and live 5×5 land onboarding
- Supabase email confirmation and password recovery links, owner-scoped account tables and an explicitly labeled local fallback
- Friend center with personal link/QR/code, manual requests, accept/decline, accepted-friend management and private land placement
- Canonical mutual friendships, owner-controlled per-Plane placement, invite revocation and realtime refresh adapters
- Shareable capability invite URL with a functional QR code and account-free guest entry
- Anonymous guest identity remembered per device, with host/guest live presence
- 24-hour Bubbles, replacement, expiry, and private owner-only Bubble Log
- Remove/block controls and no public directory/contact information
- `localStorage` persistence plus an installable manifest and offline shell cache

## Architecture

The world uses one coordinate system. `lib/world.ts` is the source of truth for logical tile dimensions, isometric projection, inverse drag projection, and all snapping/collision math. Every Space begins at `(plotX * 5, plotY * 5)` in logical grid coordinates. Land vertices, Characters, buildings, and environmental objects are projected from that same grid before the camera transforms the single `.world` container.

The browser uses persistence adapters so the same world can run against Supabase or the explicitly labeled local fallback. `lib/account-store.ts`, `lib/friend-store.ts` and `lib/plane-store.ts` keep account identity, canonical friendship, owned land appearance and each viewer's private placement separate while the renderer continues to consume serializable `Person` state.

`PlaneLand` renders a single world surface from owned logical cells. The default four quadrants make exactly 100 unique cells with 25 per person. Visible vertical faces are generated only on exposed cell edges; internal Space boundaries have no slab faces. `tileToIso` and `isoToTile` share a 2:1 diamond projection (45° grid rotation), and arrangement uses the inverse projection. Placeholder objects and Characters use the same grid anchors and depth ordering. Houses reserve a 2×2 footprint; other placeholders occupy one cell. Assets remain placeholders pending visual approval.

## Verification

```bash
npm test
npm run build
```

Grid tests cover exact alignment and uniqueness for 1, 5, 10, and 25 Plots.

## Motion preview

Ren and Sarah take an adjacent, unoccupied tile step after a staggered initial pause, then rest for roughly 15–22 seconds. Click a Space name to focus; Reset view returns to the whole Plane. Open a Character card or enter Arrange to pause roaming. Reduced-motion disables autonomous movement, ambient animation, and camera transitions; hidden tabs suspend walking. `lib/motion.ts` provides shared timing, easing, walkable-neighbor selection, and logical poses/headings for future renderers. Current SVG placeholders demonstrate horizontal facing only; full directional poses await the approved asset implementation.

## 3D Plane

The active Plane uses one React Three Fiber canvas. `lib/render3d.ts` maps unchanged logical tile coordinates to scene units. A fixed 45° azimuth / 30° elevation orthographic camera reproduces the approved 2:1 diamond projection. Terrain contains the existing owned cells and exterior-only side walls; no internal slabs. All four existing Spaces now use the same warm low-poly buildings, vegetation, props and toy-like Character system. Product controls, labels, QR sharing and inspection sheets remain React/HTML outside the canvas.

The scene uses shared terrain geometry/materials, demand rendering, capped pixel ratio and restrained shadows. Pan, zoom, reset, Space focus, Character inspection and collision-checked arrangement remain available. Motion code is retained but autonomous Character animation is intentionally inactive. The pre-3D implementation is saved in Git commit `13ebff9`; the approved single-Space R3F checkpoint is `62bfd98`.

## Accounts, email/password and realtime setup

The sharing seam lives in `lib/plane-store.ts`; the account seam lives in `lib/account-store.ts`. Without credentials, Pluoto uses `localStorage` plus `BroadcastChannel` and a clearly labeled same-device password fallback. Local passwords are reduced to salted PBKDF2 verifiers and are never stored as plaintext. This is a development fallback, not proof of Supabase authentication.

The smallest setup for real email delivery is:

1. Link the intended Supabase project and inspect its migration history. Apply the ordered files in `supabase/migrations/` with `npx supabase db push --linked --include-all`; they establish Plane sharing, account-owned onboarding data, friend connections, tightened function grants, and the qualified secure friend-code generator. The migrations are additive/idempotent and do not reset existing users or demo data.
2. In Authentication → Providers → Email, enable email/password sign-in and keep email confirmation enabled. Configure production SMTP before relying on delivery outside Supabase’s test allowance.
3. Set Authentication → URL Configuration → Site URL to the production Vercel origin. Add exact callback URLs for `/auth/callback` and `/auth/recovery` for localhost, the verified Preview URL, and Production URL.
4. Copy `.env.example` to `.env.local` and add the project URL, public publishable/anon key, and deployed HTTPS app origin. Add the same public variables to Vercel Preview and Production. Never expose a service-role key through `NEXT_PUBLIC_` or commit it.
5. Restart `npm run dev`, create a test account, follow its confirmation link, and test a recovery link. Earlier email-OTP users should choose **Set or reset password**; Supabase recovery changes the password on the same auth user ID, preserving their profile, land and friendships.

Row Level Security limits profile editing, Character choices, owned land, Pills, arrangements, pending invitation context and per-user placement to the signed-in owner. Friend requests and friendships are readable only by their participants; security-definer RPCs enforce self-invite, block, friendship and collision rules for every mutation. The hardening migration removes PostgreSQL’s default public execute access from internal helpers and authenticated mutations. The existing Plane tables, auth user IDs and demo world are left in place.

Friend links are only shareable between devices when `NEXT_PUBLIC_APP_ORIGIN` is a deployed HTTPS address and Supabase is configured. Without those values, the complete UI and deterministic multi-session test fallback remain available on one origin, but that fallback is not proof of cross-device persistence or real email delivery.

The production build is a static Next.js export with explicit `/auth/callback` and `/auth/recovery` pages, so direct email links and refreshed routes work on Vercel. No credentials are committed to the repository.
