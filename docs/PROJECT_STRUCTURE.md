# Project Structure

This document explains every file and folder in the repository, including what it is, what it does, and whether it should be committed to Git.

---

## Root Level

```
jobhunt/
├── src/                  Source code — always committed
├── public/               Static assets — always committed (except APK)
├── android/              Capacitor Android project — partially committed
├── docs/                 Documentation — always committed
├── node_modules/         NPM packages — NEVER committed (.gitignore)
├── build/                Production build output — NEVER committed (.gitignore)
├── README.md             ← This file is the project's front door
├── package.json          Dependency manifest and npm scripts
├── package-lock.json     Lockfile — always committed
├── capacitor.config.ts   Capacitor source config — always committed
├── vercel.json           Vercel deployment config — always committed
├── .gitignore            Git exclusion rules
├── LICENSE               MIT license
├── CHANGELOG.md          Version history
├── CONTRIBUTING.md       Contributor guidelines
├── CODE_OF_CONDUCT.md    Community standards
└── SECURITY.md           Vulnerability reporting + threat model
```

---

## `src/` — React Source Code

```
src/
├── App.js          780 lines — entire application
├── index.js        React root mount (ReactDOM.createRoot)
├── index.css       Global CSS reset (body font, code font)
├── App.css         CRA boilerplate — NOT used by the app (safe to delete)
├── App.test.js     CRA scaffold smoke test
├── reportWebVitals.js   CRA performance metrics (not configured)
└── setupTests.js   Jest + Testing Library setup
```

### `src/App.js` Internal Structure

| Section | Lines (approx) | Description |
|---------|----------------|-------------|
| Imports | 1–3 | React hooks, Capacitor plugins |
| Crypto utilities | 5–31 | `getCryptoKey`, `secureSet`, `secureGet` |
| Network utilities | 33–41 | `ALLOWED_ORIGINS`, `secureFetch` |
| Constants | 43–107 | `PLATFORMS`, `JOB_TYPES`, `WORK_MODES`, `ALERT_PLATFORMS` |
| Helper functions | 109–126 | `isRecentlyPosted`, `timeAgo` |
| API fetchers | 128–200 | `fetchRemotive`, `fetchArbeitnow`, `fetchTheMuse` |
| `RadarPulse` component | ~202–222 | Animated header icon |
| `Toast` component | ~224–237 | Auto-dismissing message bar |
| `FilterChips` component | ~239–258 | Reusable chip row filter |
| `JobCard` component | ~260–320 | Single job listing card |
| `AlertCard` component | ~322–350 | Email alert platform card |
| `JobHunt` (default export) | ~352–780 | Root component — all state, all tabs |

---

## `public/` — Static Assets

```
public/
├── index.html          HTML shell served for all routes
├── manifest.json       PWA manifest — name, icons, theme color
├── background.js       WorkManager background task (no React, no imports)
├── cyberhunt.apk       Pre-built signed APK for browser download
├── favicon.ico         Browser tab icon
├── logo192.png         PWA icon (192×192)
├── logo512.png         PWA icon (512×512)
└── robots.txt          Search engine crawl policy
```

### `public/background.js`

This file is **critical** and easy to overlook. It is not part of the React build — it is a standalone JavaScript file executed by Android's WorkManager (via Capacitor's BackgroundRunner plugin) in an isolated context without access to React state, npm packages, or browser APIs.

It uses only:
- `fetch` (available in WorkManager JS context)
- `CapacitorNotifications` (injected by the BackgroundRunner plugin)
- `addEventListener` (the WorkManager event API)
- `args.query` and `args.lastIds` (passed from the React app via `BackgroundRunner.dispatchEvent`)

### `public/cyberhunt.apk`

This APK is served at `/cyberhunt.apk` and downloaded when Android browser users tap the install banner. It should be replaced with a fresh signed APK on each new release. The file is large (~5–15 MB) — consider Git LFS if the repository approaches GitHub's file size limits.

---

## `android/` — Capacitor Android Project

### Files Always Committed

```
android/
├── build.gradle                    Root Gradle config
├── variables.gradle                SDK version constants
├── settings.gradle                 Project settings
├── capacitor.settings.gradle       Capacitor module includes
├── gradle.properties               JVM heap, AndroidX flag
├── gradlew                         Unix Gradle wrapper script
├── gradlew.bat                     Windows Gradle wrapper script
├── gradle/wrapper/
│   └── gradle-wrapper.properties   Wrapper version config
│
├── capacitor-cordova-android-plugins/
│   ├── build.gradle
│   ├── cordova.variables.gradle
│   └── src/main/
│       ├── AndroidManifest.xml
│       └── java/.gitkeep
│
└── app/
    ├── build.gradle                App module build config
    ├── capacitor.build.gradle      Auto-generated — committed
    ├── proguard-rules.pro          ProGuard rules (currently empty)
    └── src/
        ├── androidTest/            Instrumented test scaffolds
        ├── test/                   Unit test scaffolds
        └── main/
            ├── AndroidManifest.xml
            ├── java/com/bula/cyberhunt/
            │   └── MainActivity.java
            └── res/
                ├── drawable*/      Splash screen images (all sizes)
                ├── mipmap*/        Launcher icons (all densities)
                ├── layout/
                │   └── activity_main.xml
                ├── values/
                │   ├── strings.xml         App name
                │   ├── styles.xml          Theme + splash
                │   └── ic_launcher_background.xml
                └── xml/
                    ├── network_security_config.xml  ← HTTPS policy
                    ├── config.xml                   ← Cordova access policy
                    └── file_paths.xml               ← FileProvider paths
```

### Files NOT Committed (in .gitignore)

```
android/
├── .gradle/            Gradle cache — excluded
├── .idea/              Android Studio IDE files — excluded
├── local.properties    SDK path (machine-specific) — excluded
└── app/build/          Build outputs — excluded
```

### Files Generated by `npx cap sync android` (NOT committed)

```
android/app/src/main/assets/
├── public/             Built React app — regenerated on every sync
├── capacitor.config.json     Compiled from capacitor.config.ts
└── capacitor.plugins.json    Plugin registry
```

These are excluded via `.gitignore` because they are derived from the source files and must be regenerated on each developer's machine.

---

## `docs/` — Documentation

```
docs/
├── ARCHITECTURE.md     System design, diagrams, component tree, state map
├── API.md              Request/response docs for all three external APIs
├── DEPLOYMENT.md       Web (Vercel) and Android (APK) deployment steps
├── ROADMAP.md          Planned features and their priority
├── PROJECT_STRUCTURE.md   This file
└── TESTING.md          Test setup, manual checklist, writing guide
```

---

## Configuration Files

### `capacitor.config.ts`

The Capacitor configuration source. Running `npx cap sync android` compiles this into `android/app/src/main/assets/capacitor.config.json`.

```ts
{
  appId: 'com.bula.cyberhunt',       // Android package ID (not yet updated to match new name)
  appName: 'JobHunt',
  webDir: 'build',                   // CRA output directory
  server: {
    allowNavigation: [               // Domains the WebView may navigate to
      'remotive.com',
      'www.arbeitnow.com',
      'www.themuse.com',
      'cyberhunt-taupe.vercel.app',
    ],
  },
  plugins: {
    BackgroundRunner: {
      label: 'com.bula.cyberhunt.check',
      src: 'background.js',
      event: 'jobSearch',
      repeat: true,
      interval: 30,                  // Minutes
      autoStart: true,
    },
    LocalNotifications: {
      smallIcon: 'ic_launcher_foreground',
      iconColor: '#00FFA3',
    },
  },
}
```

### `vercel.json`

Configures Vercel deployment:
- `buildCommand`: `npm run build`
- `outputDirectory`: `build`
- `rewrites`: SPA catch-all to `index.html`
- `headers`: Full security header suite (see [DEPLOYMENT.md](DEPLOYMENT.md))

### `package.json`

| Script | Command | Description |
|--------|---------|-------------|
| `start` | `react-scripts start` | Development server on port 3000 |
| `build` | `react-scripts build` | Production build → `/build` |
| `test` | `react-scripts test` | Jest in watch mode |
| `eject` | `react-scripts eject` | Eject from CRA (irreversible) |

**Runtime dependencies:** React 19, react-dom 19, react-scripts 5.0.1, @capacitor packages, @testing-library packages, web-vitals

**Dev dependencies:** `qrcode` (not currently used in any source file — dead dependency)

---

## Recommended Future Structure

When `App.js` is split (see [ROADMAP.md](ROADMAP.md)), the recommended `src/` structure is:

```
src/
├── components/
│   ├── JobCard.jsx
│   ├── FilterChips.jsx
│   ├── AlertCard.jsx
│   ├── Toast.jsx
│   └── RadarPulse.jsx
├── hooks/
│   ├── useMonitor.js       Monitor state + interval management
│   └── usePersistence.js   secureSet/secureGet wrappers with state binding
├── api/
│   ├── remotive.js
│   ├── arbeitnow.js
│   └── themuse.js
├── utils/
│   ├── crypto.js           getCryptoKey, secureSet, secureGet
│   ├── secureFetch.js      HTTPS + origin allowlist fetch wrapper
│   └── dateHelpers.js      isRecentlyPosted, timeAgo
├── constants/
│   ├── platforms.js        PLATFORMS array
│   ├── filters.js          JOB_TYPES, WORK_MODES
│   └── alerts.js           ALERT_PLATFORMS
└── App.js                  Root component (state + tab rendering only)
```
