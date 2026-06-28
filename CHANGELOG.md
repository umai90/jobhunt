# Changelog

All notable changes to JobHunt are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).  
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- Application tracker (Applied / Interview / Offer / Rejected stages)
- Search history with one-tap repeat search
- Salary range filter
- iOS build via Capacitor
- LinkedIn Jobs and Indeed API integration
- Code split into components / hooks / api / constants directories

---

## [0.2.0] — 2026-06-28

### Added
- **Multi-platform search engine** — Remotive, Arbeitnow, and The Muse APIs aggregated in parallel
- **Platform filter chips** — platform selection now controls which APIs are called, not a client-side filter
- **Job Type filter** — All Types / Full-time / Part-time / Internship / Contract
- **Work Mode filter** — All / Remote / Hybrid / On-site
- **The Muse API integration** — third job source with native `level` and `location` query params
- **`FilterChips` component** — reusable horizontal scrolling chip row for all three filter rows
- **Persistent encrypted bookmarks** — saved jobs now survive page reload via AES-GCM encrypted localStorage
- **Persistent alert progress** — email alert setup progress survives page reload
- **Error state UI** — network failures now show a user-facing error message instead of "no results"
- **Monitor keyword display** — Monitor tab now shows which keyword is being tracked
- **Monitor guard** — Start Monitoring button disabled until a search keyword is entered
- **Monitor counter reset** — new job count resets when monitoring is stopped
- **Real `isNew` badge** — based on publication date within the last 3 days, not `Math.random()`
- `noopener,noreferrer` added to all `window.open` calls in the Alerts tab
- The Muse added to `ALLOWED_ORIGINS`, `vercel.json` CSP `connect-src`, `network_security_config.xml`, and `capacitor.config.ts`

### Changed
- App renamed from **CyberHunt** to **JobHunt**
- API source labels corrected: Remotive → "Remotive", Arbeitnow → "Arbeitnow" (previously mislabelled as ZipRecruiter / Dice)
- Default search query cleared — field is now blank with a generic placeholder
- `RadarPulse` icon changed from 🛡️ to 🔍 to reflect generic job search purpose
- Header subtitle changed from "Internship Finder" to "Multi-Platform Job Search"
- Email alert links changed from cybersecurity-specific URLs to generic platform homepages
- Job cards now display dynamic work mode and job type badges derived from API data
- Job cards use stable `id` as React key instead of array index
- Save button now shows 📌 (unsaved) vs 🔖 (saved) — previously both states showed 🔖
- Results sorted by publication date (newest first) after merging API responses
- Stats row now shows "Platforms" count instead of confusing "Remote" count
- Monitor uses user's typed keyword (stored via `secureSet("monitorQuery")`) instead of hardcoded "cybersecurity"
- `background.js` uses `args.query` from WorkManager dispatch details instead of hardcoded string
- `public/index.html` title updated to "JobHunt — Multi-Platform Job Search"
- `public/manifest.json` updated: name, short_name, theme_color (#0D1117), background_color (#0D1117)
- `android/app/build.gradle` debug build: `debuggable false` → `debuggable true`
- `android/.../strings.xml` app name updated to "JobHunt"

### Fixed
- Saved jobs now persist across page reload (previously in-memory only)
- Alert setup progress now persists across page reload (previously in-memory only)
- Monitor no longer ignores the user's search query
- Network errors no longer display as "no results"
- `window.open` in Alerts tab now includes `noopener,noreferrer` for security
- Debug builds are now debuggable (`debuggable true`)

### Removed
- Hardcoded "cybersecurity internship remote" default search query
- Hardcoded `SKILLS` array for cybersecurity skill badge extraction — now uses job's `tags` field directly
- Fake platform entries: ZipRecruiter (not connected), Dice (not connected), LinkedIn, Indeed, Google, Otta from platform chips

---

## [0.1.0] — 2026-05 (Initial Release — CyberHunt)

### Added
- Initial React 19 application scaffolded with Create React App
- Capacitor 8 Android integration
- Two API sources: Remotive (labelled ZipRecruiter) and Arbeitnow (labelled Dice)
- Cybersecurity internship search with hardcoded default query
- Job Type and platform chips (client-side filter only)
- In-memory saved jobs (not persisted)
- Email alert setup for cybersecurity platforms
- Background job monitor via @capacitor/background-runner (hardcoded "cybersecurity" keyword)
- @capacitor/local-notifications for push alerts
- AES-GCM encrypted localStorage for monitor state
- `secureFetch` wrapper (HTTPS + origin allowlist)
- Vercel deployment with security headers
- Android network security config (HTTPS-only, system CAs)
- PWA manifest and Android APK browser download banner
- Android build: minSdk 24, targetSdk 36

---

[Unreleased]: https://github.com/yourusername/jobhunt/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/yourusername/jobhunt/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/yourusername/jobhunt/releases/tag/v0.1.0
