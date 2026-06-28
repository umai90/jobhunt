# Roadmap

This document outlines the planned direction for JobHunt. Items are organized by priority. The roadmap reflects honest assessment of what is feasible given the zero-backend, no-account design constraint.

---

## Core Principle

> JobHunt will remain a client-only application. No backend server, no user accounts, no data sent to proprietary servers. Every planned feature must work within this constraint.

---

## Current State (v0.2.0)

- ✅ Multi-platform search: Remotive, Arbeitnow, The Muse
- ✅ Platform / Job Type / Work Mode filter chips
- ✅ Persistent encrypted bookmarks (AES-GCM localStorage)
- ✅ Background monitor with push notifications (Android WorkManager)
- ✅ Email alert setup links
- ✅ Vercel web deployment with security headers
- ✅ Android APK via Capacitor 8

---

## Near Term (v0.3.0)

### Application Tracker

Track the status of jobs you have applied for without a backend:

| Stage | Description |
|-------|-------------|
| Saved | Added to bookmarks |
| Applied | Marked as applied (with optional date) |
| Interview | Interview scheduled |
| Offer | Offer received |
| Rejected | Application closed |

Status stored in encrypted localStorage alongside the saved job object.

### Search History

- Persist the last 10 searches
- Display as a dropdown when the search field is focused
- One tap to repeat a previous search
- Swipe to delete from history

### Salary Range Filter

- Add a salary range slider to the Search tab
- Remotive includes salary strings — implement heuristic parsing (e.g. extract numbers from "$120k - $160k")
- Filter client-side since none of the three APIs support salary as a query parameter

---

## Medium Term (v0.4.0)

### iOS Build

- Add iOS target via `npx cap add ios`
- Configure `Info.plist` for notification permissions
- Test BackgroundRunner on iOS (uses BGTaskScheduler, different from Android WorkManager)
- App Store distribution or TestFlight

### Company Filter

- Allow filtering by company name
- Client-side text match against `job.company`

### Sort Options

Currently results are sorted by date (newest first). Add:
- Relevance (default API order)
- Date (newest first — current default)
- Date (oldest first)

---

## Long Term (v0.5.0+)

### LinkedIn Jobs Integration

LinkedIn's Jobs API requires OAuth and is not publicly available without a partner agreement. This is blocked on API access.

Alternative: deep link to LinkedIn job search with the current keyword pre-filled.

### Indeed Integration

Indeed's Publisher API requires approval. Same blocker as LinkedIn.

Alternative: deep link to Indeed with the current filters pre-filled as URL parameters.

### Code Architecture Refactor

The current 780-line `App.js` should be split:

```
src/
├── components/
│   ├── JobCard.jsx
│   ├── FilterChips.jsx
│   ├── AlertCard.jsx
│   ├── Toast.jsx
│   └── RadarPulse.jsx
├── hooks/
│   ├── useMonitor.js
│   └── usePersistence.js
├── api/
│   ├── remotive.js
│   ├── arbeitnow.js
│   └── themuse.js
├── utils/
│   ├── crypto.js
│   ├── secureFetch.js
│   └── dateHelpers.js
├── constants/
│   ├── platforms.js
│   ├── filters.js
│   └── alerts.js
└── App.js   (root component — state + tab rendering only)
```

### Test Coverage

Add tests for:
- `secureSet` / `secureGet` round-trip
- `secureFetch` — blocks non-HTTPS, blocks non-allowlisted origins
- `fetchRemotive` — correct parameter mapping
- `fetchArbeitnow` — client-side filter logic
- `fetchTheMuse` — level and location parameter mapping
- `isRecentlyPosted` — date boundary conditions
- `timeAgo` — output strings for known dates
- `FilterChips` — renders correct active state
- `JobCard` — work mode and job type badge derivation

### Encryption Key Improvement

Replace the hardcoded `ENC_KEY` with a per-install randomly generated key:

```js
async function getOrCreateInstallKey() {
  const stored = localStorage.getItem("__installKey");
  if (stored) return stored;
  const key = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
  localStorage.setItem("__installKey", key);
  return key;
}
```

This eliminates the "key in source" limitation without requiring a backend.

### Migrate from CRA to Vite

Create React App is no longer maintained. Migrating to Vite would:
- Eliminate `'unsafe-inline'` from CSP (Vite supports `script[nonce]`)
- Reduce build time significantly
- Allow proper code splitting per component
- Enable Vitest for unit testing

---

## Declined Features

These have been considered and will not be implemented:

| Feature | Reason |
|---------|--------|
| User accounts / login | Violates the no-backend, no-data-collection principle |
| Resume upload and parsing | Requires a backend service |
| AI job matching | Requires an LLM API with API key management and cost |
| Job application auto-fill | Browser security model prevents this from a WebView |
| Real-time job feed (WebSocket) | None of the free APIs support WebSocket connections |

---

## Contributing to the Roadmap

If you want to propose a feature, open a GitHub Issue with the `enhancement` label and describe:
1. The user problem you are solving
2. How it fits the no-backend constraint
3. Which API would provide the data (if applicable)

Feature requests that require a backend, user accounts, or paid APIs will be declined unless a viable client-only alternative exists.
