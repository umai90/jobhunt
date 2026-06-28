# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.2.x (current) | ✅ Yes |
| 0.1.x | ❌ No — upgrade to 0.2.x |

---

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Send a private report to: **security@yourdomain.com** (replace with your actual contact)

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (optional)

You will receive an acknowledgement within **48 hours** and a status update within **7 days**.

If the vulnerability is confirmed, a patch will be released and you will be credited in the changelog unless you request otherwise.

---

## Threat Model

### What this application protects

JobHunt is a client-only application. It holds:
- A list of bookmarked job listings (title, company, URL, tags)
- A monitor keyword (a search string like "react developer")
- Email alert setup progress (a set of booleans)
- A monitor on/off preference

None of these are sensitive under most threat models. The security controls exist to protect the application's integrity and prevent it from being abused as an attack vector — not to protect high-value secrets.

### What this application does NOT hold

- Passwords
- API keys
- Personal identification information
- Financial data
- Session tokens
- Authentication credentials of any kind

---

## Security Controls

### Transport Layer

| Control | Implementation |
|---------|---------------|
| HTTPS enforced | `secureFetch()` rejects non-HTTPS URLs at runtime |
| Origin allowlist | `secureFetch()` compares `url.startsWith(origin)` against `ALLOWED_ORIGINS` |
| Android cleartext blocked | `android:usesCleartextTraffic="false"` in `AndroidManifest.xml` |
| Android network config | `network_security_config.xml` — cleartext blocked globally, system CAs only |
| HSTS | `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` via Vercel |

### Content Security Policy (Vercel)

```
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
connect-src 'self' https://remotive.com https://www.arbeitnow.com https://www.themuse.com;
img-src 'self' data: https:;
font-src 'self';
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
```

### Additional HTTP Security Headers

| Header | Value |
|--------|-------|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `X-XSS-Protection` | `1; mode=block` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Cross-Origin-Resource-Policy` | `same-origin` |

### Data at Rest

All persistent state is encrypted with AES-GCM via the Web Crypto API:

- A 12-byte random IV is generated per write using `crypto.getRandomValues()`
- The IV is prepended to the ciphertext before base64 encoding
- Each localStorage slot gets a unique IV, making identical values produce different ciphertext

### Credential Isolation

All outbound `fetch` calls use `credentials: "omit"` and `referrerPolicy: "no-referrer"`, preventing cookies and referrer headers from being sent to third-party APIs.

---

## Known Limitations

These are accepted risks, documented transparently.

### Hardcoded AES-GCM Key

**Risk:** The encryption key (`"cyberhunt-secure-v1-2026"`) is compiled into the JavaScript bundle. Anyone who reads the bundle can recover the key and decrypt localStorage contents.

**Why accepted:** The encrypted data (job bookmarks, search keyword) carries no meaningful value to an attacker. The encryption provides defence-in-depth against opportunistic script access, not against a determined attacker who can read the file system or the JS bundle.

**Mitigation path:** Replace the hardcoded key with a per-install randomly generated key stored in a separate `localStorage` slot on first run. This would require a one-time migration of existing encrypted data.

### `'unsafe-inline'` in CSP script-src

**Risk:** Allows inline `<script>` execution, which weakens XSS protection.

**Why accepted:** Create React App injects a small inline script during the build process. This cannot be removed without ejecting from CRA or migrating to a different build tool (Vite, Next.js).

**Mitigation path:** Migrate to Vite, which supports `script[nonce]` and eliminates the need for `'unsafe-inline'`.

### Cordova `<access origin="*">` in config.xml

**Risk:** The Capacitor-managed `android/.../res/xml/config.xml` contains `<access origin="*" />`, which grants the Cordova WebView layer access to all origins.

**Why limited impact:** The `network_security_config.xml` and `secureFetch()` allowlist enforce the actual network boundary independently of the Cordova access policy.

**Mitigation path:** Scope `config.xml` to `<access origin="https://remotive.com" /><access origin="https://www.arbeitnow.com" /><access origin="https://www.themuse.com" />`.

---

## Dependency Security

Run a dependency audit periodically:

```bash
npm audit
npm audit fix
```

Capacitor and its plugins pin their own Android dependencies via Gradle. Review `android/variables.gradle` when upgrading Capacitor major versions.
