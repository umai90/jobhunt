# Testing Guide

---

## Current Test Coverage

JobHunt uses the Create React App default testing setup:

| Tool | Role |
|------|------|
| Jest | Test runner |
| React Testing Library | Component rendering and interaction |
| `@testing-library/jest-dom` | DOM assertion matchers |
| `@testing-library/user-event` | User event simulation |

### Running Tests

```bash
# Interactive watch mode (development)
npm test

# Single run with coverage report
CI=true npm test -- --coverage

# Run a specific test file
npm test -- App.test.js
```

### Current Status

The only test file in the project is the CRA scaffold (`src/App.test.js`), which renders the app and checks that it loads without crashing. **There are no tests for business logic, API integration, or individual components.**

This is documented technical debt — see the [Roadmap](ROADMAP.md) for the planned test coverage initiative.

---

## Manual Testing Checklist

Use this checklist to manually verify the application before a release.

### Search Tab

| Test | Steps | Expected |
|------|-------|----------|
| Empty search | Tap ⚡ Search Jobs with empty input | Toast: "Enter a job title or keyword first" |
| Single platform search | Select Remotive, type "developer", search | Only Remotive jobs appear |
| All platforms search | Select All Platforms, type "engineer", search | Jobs from all 3 sources appear |
| Job type filter | Select Internship, search | Job cards show "Internship" badge |
| Work mode filter | Select Remote, search | Job cards show "🏠 Remote" badge |
| New badge | Search for recent jobs | Jobs posted within 3 days show "✨ New" badge |
| Apply button | Tap Apply Now → on any job card | Opens job URL in new tab/browser |
| Save button | Tap 📌 on a job card | Button changes to 🔖; job count appears in tab |
| Unsave from search | Tap 🔖 on a saved job | Button returns to 📌; count decreases |
| Stats row | After search | Total count, New count, Platforms count all accurate |
| Loading state | During search | Spinner shows; "Searching platforms..." text |
| API error simulation | Disconnect from internet, search | Error message shown (not "no results") |

### Saved Tab

| Test | Steps | Expected |
|------|-------|----------|
| Empty state | Open Saved tab with no saves | Empty state UI with "Go to Search" button |
| Saved jobs persist | Save a job, reload page | Job still appears in Saved tab |
| Unsave from saved tab | Tap 🔖 on a saved job | Job removed; if last job, empty state appears |
| Navigation | Tap "Go to Search" in empty state | Search tab becomes active |

### Alerts Tab

| Test | Steps | Expected |
|------|-------|----------|
| Browser notifications | Tap Enable Browser Alerts | OS permission prompt appears |
| Alert setup | Tap Setup on LinkedIn card | LinkedIn jobs page opens; button shows "✓ Set" |
| Progress persists | Setup 2 alerts, reload | Progress bar shows 2/4 |

### Monitor Tab

| Test | Steps | Expected |
|------|-------|----------|
| Requires keyword | Open Monitor tab with empty search | Start button shows "Enter a keyword first" (disabled) |
| Keyword display | Type "designer" in search, open Monitor | Monitor shows "Monitoring keyword: designer" |
| Start monitoring | Enter keyword, Start Monitoring | Status changes to "Monitoring Active" |
| Stop monitoring | Stop Monitoring | Status returns to "Monitoring Off"; counter resets to 0 |
| Notification (manual) | Start monitoring when new jobs are expected | Notification arrives within 30 minutes |
| Persist across reload | Enable monitor, reload page | Monitor is still active |

### Android-Specific

| Test | Device/OS | Expected |
|------|-----------|----------|
| APK install banner | Android Chrome (not WebView) | Green download banner appears at top |
| APK downloads | Tap download banner | `cyberhunt.apk` downloads |
| Background notification | Enable monitor, close app, wait 30 min | Notification appears in notification tray |
| Notification tap | Tap the notification | App opens |
| Battery optimization | Monitor runs with Doze mode active | Notifications may be delayed but still arrive |

---

## Writing New Tests

When writing tests, follow these conventions:

### Component Tests

```jsx
// src/components/__tests__/JobCard.test.jsx
import { render, screen, fireEvent } from '@testing-library/react';
import JobCard from '../JobCard';

const mockJob = {
  id: "123",
  title: "Frontend Developer",
  company: "Acme Corp",
  location: "Remote",
  date: new Date().toISOString(),
  url: "https://example.com/job/123",
  tags: ["React", "TypeScript"],
  jobType: "full_time",
  platform: "remotive",
  isNew: true,
};

test("renders job title", () => {
  render(<JobCard job={mockJob} saved={false} onToggleSave={() => {}} />);
  expect(screen.getByText("Frontend Developer")).toBeInTheDocument();
});

test("shows New badge for recent jobs", () => {
  render(<JobCard job={mockJob} saved={false} onToggleSave={() => {}} />);
  expect(screen.getByText("✨ New")).toBeInTheDocument();
});

test("calls onToggleSave when save button clicked", () => {
  const onToggleSave = jest.fn();
  render(<JobCard job={mockJob} saved={false} onToggleSave={onToggleSave} />);
  fireEvent.click(screen.getByRole("button", { name: /📌/ }));
  expect(onToggleSave).toHaveBeenCalledTimes(1);
});
```

### Utility Function Tests

```js
// src/utils/__tests__/dateHelpers.test.js
import { isRecentlyPosted, timeAgo } from '../dateHelpers';

test("isRecentlyPosted returns true for today", () => {
  expect(isRecentlyPosted(new Date().toISOString())).toBe(true);
});

test("isRecentlyPosted returns false for 4 days ago", () => {
  const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
  expect(isRecentlyPosted(fourDaysAgo)).toBe(false);
});

test("isRecentlyPosted returns false for null", () => {
  expect(isRecentlyPosted(null)).toBe(false);
});

test("timeAgo returns 'Today' for current timestamp", () => {
  expect(timeAgo(new Date().toISOString())).toBe("Today");
});

test("timeAgo returns 'Recent' for null", () => {
  expect(timeAgo(null)).toBe("Recent");
});
```

### API Fetcher Tests (with mocked fetch)

```js
// src/api/__tests__/remotive.test.js
import { fetchRemotive } from '../remotive';

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      jobs: [{
        id: 999,
        title: "Test Engineer",
        company_name: "Test Corp",
        candidate_required_location: "Worldwide",
        publication_date: new Date().toISOString(),
        url: "https://remotive.com/job/999",
        tags: ["testing"],
        job_type: "full_time",
      }]
    }),
  });
});

test("maps Remotive response to app job format", async () => {
  const jobs = await fetchRemotive("engineer", "all");
  expect(jobs).toHaveLength(1);
  expect(jobs[0].id).toBe("999");
  expect(jobs[0].platform).toBe("remotive");
  expect(jobs[0].title).toBe("Test Engineer");
});

test("passes job_type param for fulltime filter", async () => {
  await fetchRemotive("engineer", "fulltime");
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining("job_type=full_time"),
    expect.any(Object)
  );
});
```

### Encryption Tests

```js
// src/utils/__tests__/crypto.test.js
import { secureSet, secureGet } from '../crypto';

test("secureSet and secureGet round-trip preserves data", async () => {
  const testData = { jobs: [{ id: "1", title: "Test Job" }] };
  await secureSet("test_key", testData);
  const retrieved = await secureGet("test_key");
  expect(retrieved).toEqual(testData);
});

test("secureGet returns null for non-existent key", async () => {
  const result = await secureGet("non_existent_key_xyz");
  expect(result).toBeNull();
});

test("each write produces unique ciphertext", async () => {
  await secureSet("unique_test", { value: 42 });
  const first = localStorage.getItem("unique_test");
  await secureSet("unique_test", { value: 42 });
  const second = localStorage.getItem("unique_test");
  expect(first).not.toBe(second); // Different IVs → different ciphertext
});
```

---

## Test Coverage Targets

When the refactor to `src/components/` + `src/utils/` + `src/api/` is complete, target coverage:

| Area | Target |
|------|--------|
| `utils/crypto.js` | 95% |
| `utils/secureFetch.js` | 90% |
| `utils/dateHelpers.js` | 100% |
| `api/remotive.js` | 85% |
| `api/arbeitnow.js` | 85% |
| `api/themuse.js` | 85% |
| `components/JobCard` | 80% |
| `components/FilterChips` | 80% |
| Root component (`App.js`) | 60% |

---

## CI Integration

To run tests automatically on every push, add a GitHub Actions workflow:

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: 'npm'
      - run: npm ci
      - run: CI=true npm test -- --coverage
      - run: npm run build
```

This validates both test coverage and production build success on every PR.
