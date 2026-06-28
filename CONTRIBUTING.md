# Contributing to JobHunt

Thank you for your interest in contributing. This document explains how to get the project running locally, the branch and commit conventions, and what to expect from the review process.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Commit Convention](#commit-convention)
- [Pull Request Process](#pull-request-process)
- [Code Standards](#code-standards)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)
- [Android Development](#android-development)

---

## Getting Started

### Prerequisites

| Tool | Minimum version |
|------|----------------|
| Node.js | 18.x |
| npm | 9.x |
| Android Studio | Latest (for APK work only) |
| JDK | 17 (for APK work only) |

### Setup

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR-USERNAME/jobhunt.git
cd jobhunt

# Install dependencies
npm install

# Start the development server
npm start
```

No API keys or environment variables are required. The application uses three free, public APIs that require no authentication.

Visit `http://localhost:3000` to see the running application.

---

## Development Workflow

### Branching

| Branch type | Naming convention | Example |
|-------------|------------------|---------|
| Feature | `feat/short-description` | `feat/salary-filter` |
| Bug fix | `fix/short-description` | `fix/monitor-crash` |
| Documentation | `docs/short-description` | `docs/api-reference` |
| Refactor | `refactor/short-description` | `refactor/split-components` |
| Chore | `chore/short-description` | `chore/update-deps` |

Always branch from `main`.

```bash
git checkout main
git pull origin main
git checkout -b feat/your-feature
```

### Running Tests

```bash
npm test
```

The test suite uses React Testing Library. Run it before pushing. If you add a new feature, add a corresponding test.

### Linting

The project uses the Create React App ESLint config (`react-app` + `react-app/jest`). Lint warnings appear in the development server console and fail the production build.

---

## Commit Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/).

```
<type>(<optional scope>): <short summary>

<optional body>

<optional footer>
```

### Types

| Type | Use for |
|------|---------|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation changes only |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or updating tests |
| `chore` | Dependency updates, build config, tooling |
| `perf` | Performance improvements |
| `style` | Formatting, whitespace (no logic change) |

### Examples

```bash
feat(search): add salary range filter chip
fix(monitor): reset new job count when monitoring is stopped
docs: update API sources table in README
chore: bump @capacitor/core to 8.5.0
```

---

## Pull Request Process

1. **One concern per PR.** A PR that adds a feature and refactors unrelated code will be asked to split.
2. **Update the changelog.** Add an entry under `[Unreleased]` in `CHANGELOG.md`.
3. **Verify the app runs.** Run `npm start` and test the affected feature path manually.
4. **No broken tests.** `npm test` must pass with no failures.
5. **No lint errors.** `npm run build` must complete without warnings being promoted to errors.
6. **Fill in the PR template.** Describe what changed, why, and how to test it.

PRs are reviewed within a few days. Feedback will be left as inline comments on specific lines.

---

## Code Standards

These standards reflect the patterns already in the codebase. New code should match.

### React

- Functional components with hooks only — no class components
- State co-located with the component that owns it
- `useCallback` for functions passed to `useEffect` dependencies
- `useEffect` cleanup for timers and intervals
- Stable React keys — use `job.id` or `job.url`, never array index

### Security

- All outbound fetch calls must go through `secureFetch()`
- New API origins must be added to `ALLOWED_ORIGINS`, `vercel.json` CSP `connect-src`, `network_security_config.xml`, and `capacitor.config.ts`
- Any new persistent state must be saved via `secureSet()` / `secureGet()`
- `window.open()` calls must include `"noopener,noreferrer"` as the third argument
- `<a target="_blank">` tags must include `rel="noopener noreferrer"`

### Styling

- Dark theme: background `#0D1117`, surface `#161B22`, border `#21262D`, text `#E6EDF3`, muted `#8B949E`
- Accent: green `#00FFA3`, purple `#7B61FF`, amber `#FBBF24`
- All styles are inline — no external CSS classes for component-specific styles
- Animations use named `@keyframes` embedded in `<style>` tags adjacent to the element that needs them

### No Comments Policy

The codebase does not use inline comments to describe what code does. Well-named variables and functions are the documentation. Add a comment only when:
- A non-obvious constraint exists (e.g., why a specific constant was chosen)
- A platform bug workaround is in place
- The code would surprise a senior engineer reading it cold

---

## Reporting Bugs

Open a [GitHub Issue](https://github.com/yourusername/jobhunt/issues/new) and include:

1. **Steps to reproduce** — exact sequence of actions
2. **Expected behavior** — what should have happened
3. **Actual behavior** — what happened instead
4. **Environment** — browser/OS version or Android version and device model
5. **Screenshot or recording** — if applicable
6. **Console errors** — open DevTools → Console, copy any red error output

For security vulnerabilities, do **not** open a public issue. See [`SECURITY.md`](SECURITY.md).

---

## Requesting Features

Open a [GitHub Issue](https://github.com/yourusername/jobhunt/issues/new) labeled `enhancement`.

Good feature requests include:
- The problem you are trying to solve
- Your proposed solution
- Alternatives you considered
- Any constraints (API availability, platform support, offline use)

Feature requests that conflict with the no-backend, no-account design will be declined. The core design principle is that no user data is transmitted to any proprietary server.

---

## Android Development

If your change affects the Android APK:

```bash
# After making changes to React source
npm run build

# Sync the web build into the Android project
npx cap sync android

# Open Android Studio for native code changes
npx cap open android
```

Capacitor configuration lives in `capacitor.config.ts`. After changing it, re-run `npx cap sync android` — do not edit `android/app/src/main/assets/capacitor.config.json` directly, as it is overwritten on every sync.

Android-specific configuration lives in:
- `android/app/src/main/AndroidManifest.xml` — permissions
- `android/app/src/main/res/xml/network_security_config.xml` — HTTPS policy
- `android/variables.gradle` — SDK versions
