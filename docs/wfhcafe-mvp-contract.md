# wfhCafe MVP — shared contract & session state

**Updated:** 2026-08-05 (Claude/backend session) · **Read this first, both agents.**

## Division of labor
- **Claude (this session):** venue-engine backend, deployment, data, App Store readiness docs. Reads mobile code, never writes it.
- **Sol 5.6 (opencode):** SwiftUI client in `~/code/bamware-cafe` (app shell + `Packages/BamwareCafeKit`). Reads backend code, never writes it.
- **Bilal:** orchestrator; owns git pushes, Vercel account, App Store Connect.
- Contract changes land in THIS file before either side codes against them.

## Backend status
- Engine repo (`bamware-venue-engine`): Express + Zod + in-memory store over seed JSON. 2,180 real NYC cafes (OSM) + ~30 curated work-cafes. 11/11 tests green.
- **Deploy-ready for Vercel**: `api/index.ts` serverless entry, `vercel.json`, gzipped seed (100KB) with read-only-FS guard. Zip delivered to Bilal 2026-08-05; awaiting `vercel --prod` (see below).
- **PROD_URL: https://venuekit-ashen.vercel.app** ✅ LIVE (verified 2026-08-05: health=2180 venues, geo query, POST observation, neighborhoods all green). Sol: swap `VenueAPI.baseURL` to this now; localhost stays fine for local dev.

## API contract (v1 — stable, do not drift)
Base: `{PROD_URL|http://localhost:3000}`
- `GET /v1/health` → `{ ok, venueCount, seededAt }`
- `GET /v1/venues?lat&lng&radius_m&wifi_min(slow|ok|fast)&outlets_min(scarce|some|plenty)&laptops=friendly&neighborhood&q&sort(work_score|distance)&limit` → `{ count, venues[] }`
- `GET /v1/venues/:id` → `{ venue, observations[] }`
- `POST /v1/observations` `{ venueId, kind:"speed_test", mbpsDown }` → `201 { venue }` (updates wifi claim → source=speed_test, conf 0.9, rescores)
- `GET /v1/neighborhoods` → `{ neighborhoods: [{ name, borough, count }] }`

JSON: camelCase except `distance_m` (only on geo queries). Attribute = claim: `{ value, detail?, mbpsRange?, timeWindow?, source, confidence, observedAt }`. Sources: curated | osm | estimate | speed_test | user_report | field_visit. Swift models in `Packages/BamwareCafeKit/Sources/VenueKit/` match 1:1 — regenerate nothing, they're current.
- Serverless note: observations apply in-memory per instance; durable persistence arrives with the DynamoDB store (post-MVP). Client should treat POST response as truth for the session.

## ACTION ITEMS
**Sol:**
1. **Remove the login screen (P0).** Engine has no auth; a login wall on a public directory risks App Review 5.1.1 ("no account requirement for non-account features") and adds friction. Delete `LoginView.swift` gate; boot straight to tabs. Auth returns post-MVP if ever.
2. When PROD_URL lands: swap `VenueAPI` default baseURL; delete the "localhost:3000" wording from the error/empty state (prod copy: "Can't reach the cafe engine — pull to retry").
3. App Review polish: real app icon (Apple rejects template icons — Baat lesson), OSM attribution line ("© OpenStreetMap contributors") in an About/Settings screen, empty states everywhere.

**Bilal (2 min, from Terminal):**
```bash
mkdir -p ~/code/bamware-venue-engine && cd ~/code/bamware-venue-engine
unzip -o ~/Downloads/bamware-venue-engine.zip && mv bamware-venue-engine/* bamware-venue-engine/.[!.]* . 2>/dev/null; rmdir bamware-venue-engine
npm install && npm test        # expect 11 passing
git init -b main && git add -A && git commit -m "venue engine v0.1 — deploy-ready"
gh repo create mrbam88/bamware-venue-engine --private --source=. --push
npx vercel --prod              # link to your account when prompted
```
Then paste the production URL into this file (PROD_URL above) and tell both agents.

## App Store readiness (wfhCafe v1, free)
- [ ] PROD_URL live + app pointed at it (review runs on Apple's network — localhost = auto-reject)
- [ ] Login wall removed (5.1.1) · [ ] Real icon (4.3/2.3) · [ ] OSM attribution (ODbL)
- [ ] Privacy policy URL (reuse bamware.io/privacy) · [ ] Privacy label: aim "Data Not Collected" (no accounts, anonymous observations)
- [ ] Empty/error states — no dead screens if API hiccups (2.1)
- [ ] Screenshots 6.9" + 6.5" (reuse Baat capture automation) · [ ] Support URL
- Positioning vs 4.3(b): "measured wifi speeds + provenance for NYC work sessions" — name the differentiation in App Review notes.

## Rate-limit protocol (both agents)
- State lives HERE, not in chat context. Check in on session start; write deltas, not essays.
- Big batched turns; artifacts over narration; never re-read what's unchanged.
- Claude context is the expensive resource for backend bytes — data moves via file transfer/git, never through chat.
