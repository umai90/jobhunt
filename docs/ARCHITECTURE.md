# Architecture

JobHunt is a client-only, zero-backend application. There is no server, no database, and no authentication system. This document explains every architectural decision and how the components interact.

---

## Table of Contents

- [High-Level Overview](#high-level-overview)
- [System Architecture Diagram](#system-architecture-diagram)
- [Application Layer](#application-layer)
- [Data Layer](#data-layer)
- [Network Layer](#network-layer)
- [Background Processing](#background-processing)
- [Android Native Layer](#android-native-layer)
- [Deployment Architecture](#deployment-architecture)
- [Data Flow Diagrams](#data-flow-diagrams)
- [Component Tree](#component-tree)
- [State Management](#state-management)
- [Security Architecture](#security-architecture)

---

## High-Level Overview

```
Browser / Android WebView
        │
        ▼
   React 19 SPA
   (single App.js)
        │
   ┌────┴────────────────────┐
   │                         │
   ▼                         ▼
secureFetch()          Capacitor Bridge
(HTTPS allowlist)      (BackgroundRunner
   │                    LocalNotifications)
   ▼                         │
External APIs           Android WorkManager
Remotive                      │
Arbeitnow               background.js
The Muse                (every 30 min)
```

**No server process runs between the user's device and the external APIs.** The app talks directly to Remotive, Arbeitnow, and The Muse from the browser or Android WebView.

---

## System Architecture Diagram

```mermaid
graph TB
    subgraph UserDevice["User Device"]
        subgraph Browser["Browser / Android WebView"]
            ReactApp["React 19 SPA\nAll UI · All state · All logic"]
            WebCrypto["Web Crypto API\nAES-GCM"]
            LS[("Encrypted\nlocalStorage\nSaved jobs\nMonitor prefs\nSeen job IDs")]
        end

        subgraph Capacitor["Capacitor 8 Native Bridge"]
            BR["BackgroundRunner\nbackground.js\nvia WorkManager"]
            LN["LocalNotifications\nNative push"]
        end

        ReactApp <-->|encrypt / decrypt| WebCrypto
        WebCrypto <--> LS
        ReactApp -->|dispatchEvent| BR
        ReactApp -->|schedule| LN
        BR -->|notify| LN
    end

    subgraph Vercel["Vercel CDN"]
        Static["Static files\nindex.html · JS bundle\nmanifest.json · background.js"]
        Headers["Security headers\nHSTS · CSP · X-Frame-Options\nnosniff · Referrer-Policy"]
    end

    subgraph APIs["External APIs — Public, No Auth"]
        REM["Remotive\nhttps://remotive.com/api"]
        ARB["Arbeitnow\nhttps://www.arbeitnow.com/api"]
        MUS["The Muse\nhttps://www.themuse.com/api"]
    end

    Vercel -->|serves PWA| Browser
    ReactApp -->|secureFetch — HTTPS only| REM & ARB & MUS
    BR -->|plain fetch — HTTPS| REM
```

---

## Application Layer

The entire application lives in `src/App.js` (780 lines). It is organized into these logical sections:

```
src/App.js
├── Crypto utilities          getCryptoKey, secureSet, secureGet
├── Network utilities         ALLOWED_ORIGINS, secureFetch
├── Constants                 PLATFORMS, JOB_TYPES, WORK_MODES, ALERT_PLATFORMS
├── Helper functions          isRecentlyPosted, timeAgo
├── API fetchers              fetchRemotive, fetchArbeitnow, fetchTheMuse
└── React components
    ├── RadarPulse            Animated header icon (pure CSS)
    ├── Toast                 Transient message (auto-dismiss 2.6s)
    ├── FilterChips           Reusable horizontal chip row
    ├── JobCard               Single job listing card
    ├── AlertCard             Single email alert platform row
    └── JobHunt (default)     Root component — all state and all tab UIs
```

### Tab Structure

The application uses a tab-based navigation pattern implemented with a single `tab` state variable:

```mermaid
stateDiagram-v2
    [*] --> Search
    Search --> Alerts : tab button
    Search --> Saved : tab button
    Search --> Monitor : tab button
    Alerts --> Search : tab button
    Alerts --> Saved : tab button
    Alerts --> Monitor : tab button
    Saved --> Search : Go to Search button
    Monitor --> Search : tab button
```

Each tab is conditionally rendered with `{tab === "search" && (...)}`. There is no routing library.

---

## Data Layer

### Persistence (localStorage with AES-GCM)

There is no database. Persistence is handled entirely via `localStorage` with AES-GCM encryption:

| Key | Content | Encrypted |
|-----|---------|-----------|
| `savedJobs` | Array of job objects the user bookmarked | Yes |
| `alertsDone` | Object map of `{platformId: boolean}` | Yes |
| `cyberMonitor` | `"on"` or `"off"` | Yes |
| `monitorQuery` | The keyword being monitored | Yes |
| `seenJobIds` | Array of Remotive job ID strings seen during monitoring | Yes |

### Encryption Implementation

```mermaid
sequenceDiagram
    participant App as App code
    participant WC as Web Crypto API
    participant LS as localStorage

    App->>WC: importKey("raw", key32bytes, "AES-GCM", encrypt+decrypt)
    WC-->>App: CryptoKey

    note over App: secureSet(key, value)
    App->>WC: getRandomValues(new Uint8Array(12)) → iv
    App->>WC: encrypt({name:"AES-GCM", iv}, cryptoKey, encoded_json)
    WC-->>App: ciphertext ArrayBuffer
    App->>App: concat(iv, ciphertext) → Uint8Array
    App->>LS: setItem(key, btoa(uint8array))

    note over App: secureGet(key)
    App->>LS: getItem(key) → base64
    App->>App: atob → Uint8Array
    App->>App: slice(0,12) = iv, slice(12) = ciphertext
    App->>WC: decrypt({name:"AES-GCM", iv}, cryptoKey, ciphertext)
    WC-->>App: plaintext ArrayBuffer
    App->>App: TextDecoder → JSON.parse → original value
```

**Fallback:** If encryption fails (e.g., in an HTTP context where `crypto.subtle` is unavailable), both `secureSet` and `secureGet` fall back to plain JSON `localStorage` access. This ensures the app remains functional while silently degrading security.

---

## Network Layer

### secureFetch

All outbound HTTP calls from the React app pass through `secureFetch`:

```mermaid
flowchart TD
    A[secureFetch called with URL] --> B{URL starts with HTTPS?}
    B -->|No| C[throw 'Blocked: cleartext not allowed']
    B -->|Yes| D{URL matches ALLOWED_ORIGINS?}
    D -->|No| E[throw 'Blocked: untrusted origin']
    D -->|Yes| F[fetch with credentials:omit\nreferrerPolicy:no-referrer]
    F --> G{res.ok?}
    G -->|No| H[throw HTTP status error]
    G -->|Yes| I[return Response]
```

**ALLOWED_ORIGINS:**
```js
[
  "https://remotive.com",
  "https://www.arbeitnow.com",
  "https://www.themuse.com"
]
```

Any new API source must be added to this array, the Vercel CSP header, the Android network security config, and the Capacitor `allowNavigation` list.

### Parallel Search

When "All Platforms" is selected, all three API calls are made concurrently:

```js
const fetchers = [
  fetchRemotive(query, jobType).catch(() => []),
  fetchArbeitnow(query, jobType, workMode).catch(() => []),
  fetchTheMuse(query, jobType, workMode).catch(() => []),
];
const results = await Promise.all(fetchers);
const all = results.flat().sort((a, b) => new Date(b.date) - new Date(a.date));
```

Each fetcher has an individual `.catch(() => [])` so a single API failure does not suppress results from the others.

---

## Background Processing

### How background.js works

`public/background.js` is a standalone script (no React, no imports) executed by Capacitor's BackgroundRunner plugin inside Android's WorkManager:

```mermaid
sequenceDiagram
    participant WM as Android WorkManager
    participant BG as background.js
    participant API as Remotive API
    participant CAP as CapacitorNotifications

    note over WM: Every 30 minutes (even if app is closed)
    WM->>BG: addEventListener callback fires\nwith {query, lastIds}
    BG->>API: fetch('https://remotive.com/api/remote-jobs?search={query}&limit=15')
    API-->>BG: {jobs: [...]}
    BG->>BG: newJobs = jobs.filter(j => !lastIds.includes(j.id))
    alt newJobs.length > 0 AND lastIds was non-empty
        BG->>CAP: CapacitorNotifications.schedule([{title, body}])
        CAP-->>User: Push notification
    end
    BG->>WM: resolve({lastIds: currentIds})
```

The `lastIds.length > 0` check prevents a notification on the very first check (when the user has no baseline yet).

### WorkManager Configuration

Configured in `capacitor.config.ts`:
```ts
BackgroundRunner: {
  label: 'com.bula.cyberhunt.check',
  src: 'background.js',
  event: 'jobSearch',
  repeat: true,
  interval: 30,   // minutes
  autoStart: true,
}
```

`autoStart: true` means WorkManager registers the periodic task automatically on app launch, but it only fires notifications when `autoMonitor` is enabled (controlled by the user via the Monitor tab).

---

## Android Native Layer

```mermaid
graph TB
    subgraph AndroidApp["Android Application"]
        MA["MainActivity.java\nextends BridgeActivity\n(one line)"]
        subgraph Capacitor["Capacitor Plugins"]
            BRP["BackgroundRunnerPlugin\nio.ionic.backgroundrunner.plugin"]
            LNP["LocalNotificationsPlugin\ncom.capacitorjs.plugins.localnotifications"]
        end
        subgraph WebView["Chromium WebView"]
            ReactBundle["Built React App\n(assets/public/)"]
            BGScript["background.js\n(assets/public/)"]
        end
    end

    MA --> Capacitor
    MA --> WebView
    BRP --> BGScript
    LNP --> AndroidOS["Android OS\nNotification System"]
```

`MainActivity.java` is a single line:
```java
public class MainActivity extends BridgeActivity {}
```

All Android functionality is provided by Capacitor plugins registered in `capacitor.plugins.json`. There is no custom native Android code.

---

## Deployment Architecture

```mermaid
graph LR
    subgraph Source["Source Code"]
        GH["GitHub Repository"]
    end

    subgraph WebDeploy["Web Deployment"]
        VB["npm run build\n→ /build"]
        VER["Vercel CDN\ncyberhunt-taupe.vercel.app\nSecurity headers via vercel.json"]
    end

    subgraph AndroidDeploy["Android Deployment"]
        CS["npx cap sync android\n→ android/assets/public"]
        AS["Android Studio\nBuild → Generate Signed APK"]
        APK["Signed release.apk\nserved from public/"]
    end

    GH -->|push to main| VB
    VB --> VER
    GH -->|manual build| CS
    CS --> AS
    AS --> APK
    APK -->|placed in| VB
```

---

## Data Flow Diagrams

### Level 0 — Context Diagram

```mermaid
graph LR
    U((User)) -->|search keyword\nfilters| JH[JobHunt App]
    JH -->|job listings\nbookmarks\nnotifications| U
    JH -->|HTTPS requests| APIs[(Remotive\nArbeitnow\nThe Muse)]
    APIs -->|job data| JH
```

### Level 1 — Internal Processes

```mermaid
graph TB
    U((User)) -->|keyword + filters| SEARCH[1.0 Search Process]
    SEARCH -->|secureFetch| REM[(Remotive)]
    SEARCH -->|secureFetch| ARB[(Arbeitnow)]
    SEARCH -->|secureFetch| MUS[(The Muse)]
    REM & ARB & MUS -->|job arrays| MERGE[2.0 Merge + Sort]
    MERGE -->|sorted jobs| RENDER[3.0 Render Cards]
    RENDER -->|display| U

    U -->|tap 📌| SAVE[4.0 Save Job]
    SAVE -->|secureSet| LS[(Encrypted\nlocalStorage)]

    U -->|enable monitor| MON[5.0 Monitor Process]
    MON -->|every 30min| CHECK[6.0 Check New Jobs]
    CHECK -->|secureFetch| REM
    CHECK -->|new jobs| NOTIF[7.0 Push Notification]
    NOTIF -->|alert| U
    CHECK -->|update seenIds| LS
```

---

## Component Tree

```
JobHunt (root — all state)
├── APK download banner (conditional — Android browser only)
├── Header
│   ├── RadarPulse
│   ├── App title + subtitle
│   ├── Last updated timestamp
│   └── Tab navigation buttons
│
├── Search Tab (conditional)
│   ├── Search <input>
│   ├── FilterChips (Platform)
│   ├── FilterChips (Job Type)
│   ├── FilterChips (Work Mode)
│   ├── Search <button>
│   ├── Stats row (Total · New · Platforms)
│   ├── Loading state
│   ├── Error state
│   ├── Empty state
│   └── JobCard × N
│       ├── Platform color bar
│       ├── Title + company + location
│       ├── Platform badge + time ago
│       ├── Work mode badge
│       ├── Job type badge
│       ├── "New" badge (conditional)
│       ├── Tag badges × 2
│       ├── Apply Now link
│       └── Save/Unsave button
│
├── Alerts Tab (conditional)
│   ├── Email alerts header
│   ├── Browser notification card
│   └── AlertCard × 4 (LinkedIn, Indeed, Google, Otta)
│       └── Setup progress bar
│
├── Saved Tab (conditional)
│   ├── Header + count
│   ├── Empty state
│   └── JobCard × N (saved jobs)
│
├── Monitor Tab (conditional)
│   ├── Monitor keyword display
│   ├── Toggle card (status + Start/Stop button)
│   ├── Stats (New Jobs Found · Check Interval)
│   └── How it works list
│
├── Bottom navigation bar
└── Toast (conditional)
```

---

## State Management

All state is managed with React `useState` and `useEffect` in the single root component `JobHunt`. There is no global state library (no Redux, no Zustand, no Context API).

| State | Type | Persisted | Description |
|-------|------|-----------|-------------|
| `tab` | string | No | Active tab: search · alerts · saved · monitor |
| `platform` | string | No | Active platform filter |
| `jobType` | string | No | Active job type filter |
| `workMode` | string | No | Active work mode filter |
| `query` | string | No | Current search keyword |
| `jobs` | array | No | Current search result set |
| `loading` | boolean | No | Search in progress |
| `error` | string|null | No | Error message for failed search |
| `toast` | string|null | No | Transient toast message |
| `saved` | array | **Yes** | Bookmarked jobs (encrypted localStorage) |
| `alertsDone` | object | **Yes** | Alert setup progress (encrypted localStorage) |
| `lastUpdated` | Date|null | No | Timestamp of last search |
| `autoMonitor` | boolean | **Yes** | Monitor enabled state (encrypted localStorage) |
| `monitorStatus` | string | No | idle · checking · active · error |
| `lastCheck` | Date|null | No | Timestamp of last monitor check |
| `newJobCount` | number | No | New jobs found since monitoring started |

`useRef(monitorRef)` holds the `setInterval` handle for monitor cleanup.

---

## Security Architecture

```mermaid
graph TB
    subgraph ApplicationBoundary["Application Security Boundary"]
        subgraph FetchLayer["Fetch Layer"]
            SF["secureFetch()\nHTTPS check\nOrigin allowlist\ncredentials:omit\nno-referrer"]
        end
        subgraph CryptoLayer["Crypto Layer"]
            SC["secureSet/Get()\nAES-GCM\nRandom IV\nWeb Crypto API"]
        end
    end

    subgraph AndroidBoundary["Android Security Boundary"]
        NSC["network_security_config.xml\nHTTPS only\nSystem CAs\nNo user CAs"]
    end

    subgraph VercelBoundary["Vercel Security Headers"]
        CSP["Content-Security-Policy"]
        HSTS["Strict-Transport-Security"]
        XFO["X-Frame-Options: DENY"]
        SNO["nosniff · XSS-Protection"]
    end

    Internet --> VercelBoundary
    VercelBoundary --> ApplicationBoundary
    ApplicationBoundary --> FetchLayer
    FetchLayer -->|allowlisted HTTPS only| ExternalAPIs[("Remotive\nArbeitnow\nThe Muse")]
    CryptoLayer <--> LocalStorage[("Encrypted\nlocalStorage")]
    AndroidBoundary --> ApplicationBoundary
```
