# API Reference

JobHunt aggregates three free, public job APIs. No API keys are required. This document describes each API's request format, response structure, and how the application uses it.

All API calls go through `secureFetch()` which enforces:
- HTTPS-only URLs
- Origin allowlist (`ALLOWED_ORIGINS`)
- `credentials: "omit"`
- `referrerPolicy: "no-referrer"`

---

## Table of Contents

- [Remotive](#remotive)
- [Arbeitnow](#arbeitnow)
- [The Muse](#the-muse)
- [Error Handling](#error-handling)
- [Adding a New API Source](#adding-a-new-api-source)

---

## Remotive

**Base URL:** `https://remotive.com/api`  
**Authentication:** None  
**CORS:** Supported  
**Used for:** Search tab, Monitor tab, background.js WorkManager task

### Endpoint

```
GET https://remotive.com/api/remote-jobs
```

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `search` | string | No | Keyword to search job titles and tags |
| `limit` | number | No | Maximum results to return (app uses `12` for search, `15` for monitor) |
| `job_type` | string | No | Filter by job type |

**`job_type` values:**

| App filter | API value |
|-----------|-----------|
| Full-time | `full_time` |
| Part-time | `part_time` |
| Contract | `contract` |
| Internship | `internship` |

Remotive only lists remote jobs. The Work Mode filter (Remote / Hybrid / On-site) has no effect on Remotive results — all results are remote by nature.

### Request Example

```
GET https://remotive.com/api/remote-jobs?search=react+developer&limit=12&job_type=full_time
```

### Response

```json
{
  "0-job-count": 348,
  "jobs": [
    {
      "id": 1234567,
      "url": "https://remotive.com/remote-jobs/engineering/senior-react-developer-1234567",
      "title": "Senior React Developer",
      "company_name": "Acme Corp",
      "company_logo": "https://remotive.com/logos/acme.png",
      "category": "Software Development",
      "tags": ["react", "typescript", "node.js"],
      "job_type": "full_time",
      "publication_date": "2026-06-25T10:00:00",
      "candidate_required_location": "Worldwide",
      "salary": "$120,000 - $160,000",
      "description": "<p>We are looking for...</p>"
    }
  ]
}
```

### Fields Used by the App

| Response field | App usage |
|----------------|----------|
| `id` | Stable React key, seen-job-ID tracking in monitor |
| `title` | Job card title |
| `company_name` | Job card company |
| `candidate_required_location` | Job card location, work mode badge |
| `publication_date` | `timeAgo()` display, `isRecentlyPosted()` for New badge |
| `url` | Apply Now link |
| `tags` | Tag badges on job card (first 2 shown) |
| `job_type` | Job type badge |

### Mapped to App Job Object

```js
{
  id: String(j.id),
  title: j.title,
  company: j.company_name,
  location: j.candidate_required_location || "Remote",
  date: j.publication_date,
  url: j.url,
  tags: j.tags || [],
  jobType: j.job_type || "full_time",
  platform: "remotive",
  isNew: isRecentlyPosted(j.publication_date),
}
```

---

## Arbeitnow

**Base URL:** `https://www.arbeitnow.com/api`  
**Authentication:** None  
**CORS:** Supported  
**Used for:** Search tab only

### Endpoint

```
GET https://www.arbeitnow.com/api/job-board-api
```

No query parameters are supported on the free tier. The application fetches all available listings and applies filtering client-side.

### Request Example

```
GET https://www.arbeitnow.com/api/job-board-api
```

### Response

```json
{
  "data": [
    {
      "slug": "senior-frontend-developer-techcorp-berlin-123456",
      "company_name": "TechCorp Berlin",
      "title": "Senior Frontend Developer",
      "description": "<p>We are hiring...</p>",
      "remote": true,
      "url": "https://www.arbeitnow.com/view/senior-frontend-developer-techcorp-berlin-123456",
      "tags": ["JavaScript", "React", "TypeScript"],
      "job_types": ["full_time"],
      "location": "Berlin, Germany (Remote)",
      "created_at": 1750800000
    }
  ],
  "links": { ... },
  "meta": { ... }
}
```

### Client-Side Filtering Applied

After fetching all listings, the app applies these filters:

| Filter | Logic |
|--------|-------|
| Keyword | Title + description + tags must contain the keyword (case-insensitive) |
| Remote | `j.remote === true` |
| On-site | `j.remote === false` |
| Internship | Job text must contain "intern" |
| Contract | `j.job_types` must contain a value with "contract" |
| Part-time | `j.job_types` must contain a value with "part" |

Results are sliced to a maximum of 10 after filtering.

### Fields Used by the App

| Response field | App usage |
|----------------|----------|
| `slug` | Stable React key |
| `title` | Job card title |
| `company_name` | Job card company |
| `location` | Job card location |
| `remote` | Work mode badge logic |
| `tags` | Tag badges on job card (first 2 shown) |
| `job_types[0]` | Job type badge |
| `created_at` | Converted to ISO string for `timeAgo()` and `isRecentlyPosted()` |
| `url` | Apply Now link |

### Mapped to App Job Object

```js
{
  id: j.slug || j.url,
  title: j.title,
  company: j.company_name,
  location: j.location || (j.remote ? "Remote" : "On-site"),
  date: j.created_at ? new Date(j.created_at * 1000).toISOString() : null,
  url: j.url,
  tags: j.tags || [],
  jobType: (j.job_types || [])[0] || "full_time",
  platform: "arbeitnow",
  isNew: isRecentlyPosted(date),
}
```

> **Note:** `created_at` is a Unix timestamp in seconds — the app multiplies by 1000 to convert to milliseconds before constructing a `Date`.

---

## The Muse

**Base URL:** `https://www.themuse.com/api`  
**Authentication:** None required for public endpoint  
**CORS:** Supported  
**Used for:** Search tab only

### Endpoint

```
GET https://www.themuse.com/api/public/jobs
```

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | number | No | Zero-indexed page number (app uses `0`) |
| `level` | string | No | Filter by experience/contract level |
| `location` | string | No | Filter by office location |

**`level` values and their mapping:**

| App job type filter | API `level` param |
|--------------------|------------------|
| Full-time | `Entry Level` |
| Part-time | `Mid Level` |
| Internship | `Internship` |
| Contract | `Contract` |

**`location` values:**

| App work mode filter | API `location` param |
|---------------------|---------------------|
| Remote | `Flexible / Remote` |
| Hybrid / On-site / All | (param omitted) |

### Request Example

```
GET https://www.themuse.com/api/public/jobs?page=0&level=Internship&location=Flexible+%2F+Remote
```

### Response

```json
{
  "results": [
    {
      "id": 9876543,
      "name": "Product Design Intern",
      "short_name": "product-design-intern",
      "model_type": "jobs",
      "publication_date": "2026-06-24T08:00:00.000Z",
      "short_description": "Join our design team...",
      "locations": [
        { "name": "Flexible / Remote" }
      ],
      "categories": [
        { "id": 3, "name": "Design" },
        { "id": 7, "name": "Product" }
      ],
      "levels": [
        { "name": "Internship" }
      ],
      "company": {
        "id": 1001,
        "name": "CreativeStudio",
        "short_name": "creativestudio"
      },
      "refs": {
        "landing_page": "https://www.themuse.com/jobs/creativestudio/product-design-intern"
      }
    }
  ],
  "page_count": 15,
  "page": 0,
  "total_count": 3720
}
```

### Client-Side Filtering Applied

The app filters The Muse results by keyword after fetching:

```js
.filter(j => {
  const text = `${j.name} ${(j.categories || []).map(c => c.name).join(" ")}`.toLowerCase();
  return text.includes(kw);
})
.slice(0, 8)
```

### Fields Used by the App

| Response field | App usage |
|----------------|----------|
| `id` | Stable React key |
| `name` | Job card title |
| `company.name` | Job card company |
| `locations[].name` | Job card location, work mode badge |
| `publication_date` | `timeAgo()` display, `isRecentlyPosted()` for New badge |
| `refs.landing_page` | Apply Now link |
| `categories[].name` | Tag badges on job card (first 2 shown) |
| `levels[].name` | Job type badge |

### Mapped to App Job Object

```js
{
  id: String(j.id),
  title: j.name,
  company: j.company?.name || "Unknown",
  location: (j.locations || []).map(l => l.name).join(", ") || "Flexible",
  date: j.publication_date,
  url: j.refs?.landing_page || "",
  tags: (j.categories || []).map(c => c.name),
  jobType: (j.levels || []).map(l => l.name).join(", "),
  platform: "themuse",
  isNew: isRecentlyPosted(j.publication_date),
}
```

---

## Error Handling

Each API fetcher is wrapped in `.catch(() => [])` when called from `doSearch`:

```js
const fetchers = [
  fetchRemotive(q, jobType).catch(() => []),
  fetchArbeitnow(q, jobType, workMode).catch(() => []),
  fetchTheMuse(q, jobType, workMode).catch(() => []),
];
const results = await Promise.all(fetchers);
```

This means a single API failure returns an empty array, and results from the other two APIs are still displayed. The user sees results, not an error page.

If **all** APIs fail, `results.flat()` is an empty array. The app sets `error` state, which displays the message: *"No results — try broader keywords or change your filters"*.

Errors are logged to the browser console with the platform name for debugging:

```js
console.error("Remotive", e);
```

---

## Adding a New API Source

To add a fourth API source, update these files in order:

1. **`src/App.js` — `ALLOWED_ORIGINS`**
   ```js
   const ALLOWED_ORIGINS = [
     "https://remotive.com",
     "https://www.arbeitnow.com",
     "https://www.themuse.com",
     "https://api.newplatform.com",  // add here
   ];
   ```

2. **`src/App.js` — `PLATFORMS` constant**
   ```js
   { id: "newplatform", label: "New Platform", emoji: "🆕", color: "#AABBCC", connected: true },
   ```

3. **`src/App.js` — write a fetch function**
   ```js
   async function fetchNewPlatform(query, jobType, workMode) {
     const res = await secureFetch(`https://api.newplatform.com/jobs?q=${encodeURIComponent(query)}`);
     const data = await res.json();
     return (data.jobs || []).map(j => ({
       id: String(j.id),
       title: j.title,
       company: j.company,
       location: j.location,
       date: j.posted_at,
       url: j.apply_url,
       tags: j.skills || [],
       jobType: j.type || "full_time",
       platform: "newplatform",
       isNew: isRecentlyPosted(j.posted_at),
     }));
   }
   ```

4. **`src/App.js` — `doSearch`**
   ```js
   if (platform === "all" || platform === "newplatform")
     fetchers.push(fetchNewPlatform(q, jobType, workMode).catch(() => []));
   ```

5. **`vercel.json` — CSP `connect-src`**
   Add `https://api.newplatform.com` to the `connect-src` directive.

6. **`android/.../network_security_config.xml`**
   ```xml
   <domain-config cleartextTrafficPermitted="false">
       <domain includeSubdomains="true">newplatform.com</domain>
       <trust-anchors>
           <certificates src="system" />
       </trust-anchors>
   </domain-config>
   ```

7. **`capacitor.config.ts` — `allowNavigation`**
   ```ts
   allowNavigation: [
     'remotive.com',
     'www.arbeitnow.com',
     'www.themuse.com',
     'api.newplatform.com',
   ],
   ```
