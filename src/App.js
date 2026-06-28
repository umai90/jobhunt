import { useState, useEffect, useRef, useCallback } from "react";
import { LocalNotifications } from "@capacitor/local-notifications";
import { BackgroundRunner } from "@capacitor/background-runner";

// ── Encrypted storage using AES-GCM ──────────────────────────────
const ENC_KEY = "cyberhunt-secure-v1-2026";
async function getCryptoKey() {
  const raw = new TextEncoder().encode(ENC_KEY.padEnd(32).slice(0, 32));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function secureSet(key, value) {
  try {
    const k = await getCryptoKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, new TextEncoder().encode(JSON.stringify(value)));
    const buf = new Uint8Array(iv.byteLength + enc.byteLength);
    buf.set(iv, 0); buf.set(new Uint8Array(enc), iv.byteLength);
    localStorage.setItem(key, btoa(String.fromCharCode(...buf)));
  } catch { localStorage.setItem(key, JSON.stringify(value)); }
}
async function secureGet(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const buf = Uint8Array.from(atob(raw), c => c.charCodeAt(0));
    const iv = buf.slice(0, 12); const data = buf.slice(12);
    const k = await getCryptoKey();
    const dec = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, k, data);
    return JSON.parse(new TextDecoder().decode(dec));
  } catch { return JSON.parse(localStorage.getItem(key) || "null"); }
}

// ── Secure fetch — HTTPS only, allowlisted origins ───────────────
const ALLOWED_ORIGINS = [
  "https://remotive.com",
  "https://www.arbeitnow.com",
  "https://www.themuse.com",
];
async function secureFetch(url, opts = {}) {
  if (!ALLOWED_ORIGINS.some(o => url.startsWith(o))) throw new Error("Blocked: untrusted origin");
  if (!url.startsWith("https://")) throw new Error("Blocked: cleartext not allowed");
  const res = await fetch(url, { ...opts, credentials: "omit", referrerPolicy: "no-referrer" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

// ── Constants ─────────────────────────────────────────────────────
const PLATFORMS = [
  { id: "all",       label: "All Platforms", emoji: "⚡",  color: "#00FFA3" },
  { id: "remotive",  label: "Remotive",      emoji: "🌐",  color: "#00FFA3", connected: true },
  { id: "arbeitnow", label: "Arbeitnow",     emoji: "🔷",  color: "#4F9CF9", connected: true },
  { id: "themuse",   label: "The Muse",      emoji: "🎯",  color: "#FF6B35", connected: true },
];

const JOB_TYPES = [
  { id: "all",        label: "All Types"  },
  { id: "fulltime",   label: "Full-time"  },
  { id: "parttime",   label: "Part-time"  },
  { id: "internship", label: "Internship" },
  { id: "contract",   label: "Contract"   },
];

const WORK_MODES = [
  { id: "all",    label: "🌍 All"     },
  { id: "remote", label: "🏠 Remote"  },
  { id: "hybrid", label: "🔀 Hybrid"  },
  { id: "onsite", label: "🏢 On-site" },
];

const ALERT_PLATFORMS = [
  {
    id: "linkedin", name: "LinkedIn", icon: "💼", color: "#0A66C2",
    desc: "Set job alerts for any role — daily email digest",
    freq: "Daily",
    url: "https://www.linkedin.com/jobs/",
  },
  {
    id: "indeed", name: "Indeed", icon: "🔵", color: "#2164F4",
    desc: "Save a search → daily or weekly email alerts",
    freq: "Weekly",
    url: "https://www.indeed.com/jobs",
  },
  {
    id: "google", name: "Google Alerts", icon: "🔴", color: "#EA4335",
    desc: 'e.g. "software engineer remote 2026"',
    freq: "Real-time",
    url: "https://www.google.com/alerts",
  },
  {
    id: "otta", name: "Otta", icon: "🟠", color: "#FF6B35",
    desc: "Smart curated weekly job matches — free",
    freq: "Weekly",
    url: "https://otta.com",
  },
];

// ── Helpers ───────────────────────────────────────────────────────
function isRecentlyPosted(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d)) return false;
  return (Date.now() - d) < 3 * 24 * 60 * 60 * 1000;
}

function timeAgo(dateStr) {
  if (!dateStr) return "Recent";
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  const diff = Date.now() - d;
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "1d ago";
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

// ── API fetchers ──────────────────────────────────────────────────

// Remotive — supports job_type query param natively
async function fetchRemotive(query, jobType) {
  const typeMap = { fulltime: "full_time", parttime: "part_time", contract: "contract", internship: "internship" };
  const params = new URLSearchParams({ search: query, limit: 12 });
  if (typeMap[jobType]) params.set("job_type", typeMap[jobType]);
  const res = await secureFetch(`https://remotive.com/api/remote-jobs?${params}`);
  const data = await res.json();
  return (data.jobs || []).map(j => ({
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
  }));
}

// Arbeitnow — client-side filtering (no search param on free tier)
async function fetchArbeitnow(query, jobType, workMode) {
  const res = await secureFetch("https://www.arbeitnow.com/api/job-board-api");
  const data = await res.json();
  const kw = query.toLowerCase();
  return (data.data || [])
    .filter(j => {
      const text = `${j.title} ${j.description || ""} ${(j.tags || []).join(" ")}`.toLowerCase();
      if (!text.includes(kw)) return false;
      if (workMode === "remote" && !j.remote) return false;
      if (workMode === "onsite" && j.remote) return false;
      if (jobType === "internship" && !text.includes("intern")) return false;
      if (jobType === "contract" && !(j.job_types || []).some(t => t.includes("contract"))) return false;
      if (jobType === "parttime" && !(j.job_types || []).some(t => t.includes("part"))) return false;
      return true;
    })
    .slice(0, 10)
    .map(j => {
      const date = j.created_at ? new Date(j.created_at * 1000).toISOString() : null;
      return {
        id: j.slug || j.url,
        title: j.title,
        company: j.company_name,
        location: j.location || (j.remote ? "Remote" : "On-site"),
        date,
        url: j.url,
        tags: j.tags || [],
        jobType: (j.job_types || [])[0] || "full_time",
        platform: "arbeitnow",
        isNew: isRecentlyPosted(date),
      };
    });
}

// The Muse — supports level and location query params
async function fetchTheMuse(query, jobType, workMode) {
  const levelMap = { internship: "Internship", contract: "Contract", fulltime: "Entry Level", parttime: "Mid Level" };
  const params = new URLSearchParams({ page: 0 });
  if (levelMap[jobType]) params.set("level", levelMap[jobType]);
  if (workMode === "remote") params.set("location", "Flexible / Remote");
  const res = await secureFetch(`https://www.themuse.com/api/public/jobs?${params}`);
  const data = await res.json();
  const kw = query.toLowerCase();
  return (data.results || [])
    .filter(j => {
      const text = `${j.name} ${(j.categories || []).map(c => c.name).join(" ")}`.toLowerCase();
      return text.includes(kw);
    })
    .slice(0, 8)
    .map(j => ({
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
    }));
}

// ── Sub-components ────────────────────────────────────────────────

function RadarPulse() {
  return (
    <div style={{ position: "relative", width: 56, height: 56, flexShrink: 0 }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          position: "absolute", inset: 0, border: "1.5px solid #00FFA3",
          borderRadius: "50%", opacity: 0,
          animation: `radar 2.4s ease-out ${i * 0.8}s infinite`,
        }} />
      ))}
      <div style={{
        position: "absolute", inset: 0, display: "flex", alignItems: "center",
        justifyContent: "center", background: "linear-gradient(135deg,#00FFA322,#7B61FF22)",
        borderRadius: "50%", border: "1.5px solid #00FFA344", fontSize: 24,
      }}>🔍</div>
      <style>{`@keyframes radar{0%{transform:scale(.6);opacity:.7}100%{transform:scale(2.2);opacity:0}}`}</style>
    </div>
  );
}

function Toast({ msg, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2600); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{
      position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)",
      background: "#00FFA3", color: "#0D1117", borderRadius: 12,
      padding: "10px 20px", fontWeight: 700, fontSize: 13,
      zIndex: 999, whiteSpace: "nowrap", boxShadow: "0 4px 24px #00FFA344",
      animation: "slideUp .25s ease",
    }}>{msg}
      <style>{`@keyframes slideUp{from{opacity:0;transform:translateX(-50%) translateY(16px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
    </div>
  );
}

function FilterChips({ label, options, value, onChange, activeColor }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, color: "#484F58", fontFamily: "monospace", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none" }}>
        {options.map(opt => {
          const color = opt.color || activeColor || "#00FFA3";
          const active = value === opt.id;
          return (
            <button key={opt.id} onClick={() => onChange(opt.id)} style={{
              flexShrink: 0, padding: "6px 12px", borderRadius: 20, cursor: "pointer",
              fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", transition: "all .15s",
              background: active ? color : "#161B22",
              color: active ? "#0D1117" : "#8B949E",
              border: `1.5px solid ${active ? color : "#30363D"}`,
            }}>
              {opt.emoji ? `${opt.emoji} ` : ""}{opt.label}
              {opt.connected && <span style={{ marginLeft: 4, fontSize: 9, opacity: .7 }}>●</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function JobCard({ job, saved, onToggleSave }) {
  const plt = PLATFORMS.find(p => p.id === job.platform) || PLATFORMS[0];
  const color = plt.color || "#00FFA3";

  const workModeLabel = (() => {
    const loc = (job.location || "").toLowerCase();
    if (loc.includes("remote") || loc.includes("flexible") || loc.includes("worldwide") || loc.includes("anywhere")) return "🏠 Remote";
    if (loc.includes("hybrid")) return "🔀 Hybrid";
    return "🏢 On-site";
  })();

  const jobTypeLabel = (() => {
    const t = (job.jobType || "").toLowerCase();
    if (t.includes("intern")) return "Internship";
    if (t.includes("part")) return "Part-time";
    if (t.includes("contract") || t.includes("freelance")) return "Contract";
    return "Full-time";
  })();

  return (
    <div style={{
      background: "#161B22", borderRadius: 16, border: "1px solid #21262D",
      marginBottom: 12, overflow: "hidden",
      boxShadow: job.isNew ? `0 0 0 1px ${color}44` : "none",
    }}>
      <div style={{ height: 3, background: `linear-gradient(90deg,${color},${color}44)` }} />
      <div style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#E6EDF3", lineHeight: 1.3, marginBottom: 3 }}>
              {job.title || "Untitled Role"}
            </div>
            <div style={{ fontSize: 12, color: "#8B949E" }}>
              {job.company || "Unknown"} · {job.location || "Unknown"}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, fontFamily: "monospace",
              padding: "3px 8px", borderRadius: 6,
              background: `${color}18`, color, border: `1px solid ${color}33`, letterSpacing: .5,
            }}>{plt.label.toUpperCase()}</span>
            <span style={{ fontSize: 10, color: "#484F58", fontFamily: "monospace" }}>{timeAgo(job.date)}</span>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 20, background: "#00FFA318", color: "#00FFA3", border: "1px solid #00FFA322" }}>
            {workModeLabel}
          </span>
          <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 20, background: "#7B61FF18", color: "#9D86FA", border: "1px solid #7B61FF22" }}>
            {jobTypeLabel}
          </span>
          {job.isNew && (
            <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 20, background: "#FBBF2418", color: "#FBBF24", border: "1px solid #FBBF2422" }}>
              ✨ New
            </span>
          )}
          {job.tags.slice(0, 2).map(s => (
            <span key={s} style={{ fontSize: 11, padding: "2px 9px", borderRadius: 20, background: "#21262D", color: "#8B949E", border: "1px solid #30363D" }}>
              {s}
            </span>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {job.url
            ? <a href={job.url} target="_blank" rel="noopener noreferrer" style={{
                flex: 1, display: "block", textAlign: "center", padding: "11px", borderRadius: 12,
                background: `linear-gradient(135deg,${color},${color}bb)`,
                color: "#0D1117", fontWeight: 700, fontSize: 14, textDecoration: "none", letterSpacing: .3,
              }}>Apply Now →</a>
            : <div style={{ flex: 1, textAlign: "center", padding: "11px", borderRadius: 12, background: "#21262D", color: "#484F58", fontSize: 14 }}>
                No link available
              </div>
          }
          <button onClick={onToggleSave} style={{
            width: 44, height: 44, flexShrink: 0, borderRadius: 12, cursor: "pointer",
            background: saved ? "#00FFA318" : "#21262D",
            border: `1px solid ${saved ? "#00FFA333" : "#30363D"}`,
            fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
          }}>{saved ? "🔖" : "📌"}</button>
        </div>
      </div>
    </div>
  );
}

function AlertCard({ alert, onSetup, done }) {
  return (
    <div style={{
      background: "#161B22", borderRadius: 14,
      border: `1px solid ${done ? alert.color + "55" : "#21262D"}`,
      padding: "14px 16px", marginBottom: 10,
      display: "flex", alignItems: "center", gap: 14,
    }}>
      <div style={{
        width: 44, height: 44, flexShrink: 0, borderRadius: 12,
        background: `${alert.color}18`, border: `1.5px solid ${alert.color}33`,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
      }}>{alert.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#E6EDF3", marginBottom: 2 }}>{alert.name}</div>
        <div style={{ fontSize: 11, color: "#8B949E", marginBottom: 4, lineHeight: 1.4 }}>{alert.desc}</div>
        <span style={{ fontSize: 10, fontFamily: "monospace", padding: "2px 8px", borderRadius: 10, background: `${alert.color}15`, color: alert.color }}>
          {alert.freq}
        </span>
      </div>
      <button
        onClick={() => onSetup(alert)}
        style={{
          flexShrink: 0, padding: "9px 14px", borderRadius: 10,
          background: done ? "#00FFA318" : `${alert.color}22`,
          color: done ? "#00FFA3" : alert.color,
          fontWeight: 700, fontSize: 12, cursor: "pointer",
          border: done ? "1px solid #00FFA333" : `1px solid ${alert.color}33`,
        }}>{done ? "✓ Set" : "Setup"}</button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────
export default function JobHunt() {
  const [tab, setTab]               = useState("search");
  const [platform, setPlatform]     = useState("all");
  const [jobType, setJobType]       = useState("all");
  const [workMode, setWorkMode]     = useState("all");
  const [query, setQuery]           = useState("");
  const [jobs, setJobs]             = useState([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);
  const [toast, setToast]           = useState(null);
  const [saved, setSaved]           = useState([]);
  const [alertsDone, setAlertsDone] = useState({});
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoMonitor, setAutoMonitor] = useState(false);
  const [monitorStatus, setMonitorStatus] = useState("idle");
  const [lastCheck, setLastCheck]   = useState(null);
  const [newJobCount, setNewJobCount] = useState(0);
  const monitorRef = useRef(null);

  const showToast = msg => setToast(msg);

  // Load persisted state on mount
  useEffect(() => {
    secureGet("savedJobs").then(v => { if (v) setSaved(v); });
    secureGet("alertsDone").then(v => { if (v) setAlertsDone(v); });
    secureGet("cyberMonitor").then(v => { if (v === "on") setAutoMonitor(true); });
  }, []);

  // Persist saved jobs whenever they change
  useEffect(() => { secureSet("savedJobs", saved); }, [saved]);

  // Persist alert progress whenever it changes
  useEffect(() => { secureSet("alertsDone", alertsDone); }, [alertsDone]);

  async function doSearch() {
    const q = query.trim();
    if (!q) { showToast("Enter a job title or keyword first"); return; }
    setLoading(true);
    setJobs([]);
    setError(null);

    // Only call the APIs matching the selected platform
    const fetchers = [];
    if (platform === "all" || platform === "remotive")
      fetchers.push(fetchRemotive(q, jobType).catch(() => []));
    if (platform === "all" || platform === "arbeitnow")
      fetchers.push(fetchArbeitnow(q, jobType, workMode).catch(() => []));
    if (platform === "all" || platform === "themuse")
      fetchers.push(fetchTheMuse(q, jobType, workMode).catch(() => []));

    const results = await Promise.all(fetchers);
    const all = results.flat().sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date) - new Date(a.date);
    });

    setJobs(all);
    setLastUpdated(new Date());
    setLoading(false);
    if (all.length > 0) showToast(`${all.length} jobs found!`);
    else setError("No results — try broader keywords or change your filters");
  }

  function toggleSave(job) {
    const key = job.id || job.url || job.title;
    setSaved(prev =>
      prev.find(j => (j.id || j.url || j.title) === key)
        ? prev.filter(j => (j.id || j.url || j.title) !== key)
        : [...prev, job]
    );
  }

  function isSaved(job) {
    const key = job.id || job.url || job.title;
    return !!saved.find(j => (j.id || j.url || j.title) === key);
  }

  const runMonitorCheck = useCallback(async () => {
    setMonitorStatus("checking");
    try {
      const monitorQuery = (await secureGet("monitorQuery")) || "developer";
      const res = await secureFetch(
        `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(monitorQuery)}&limit=15`
      );
      const data = await res.json();
      const fetched = data.jobs || [];
      const currentIds = fetched.map(j => String(j.id));
      const seenIds = (await secureGet("seenJobIds")) || [];

      if (seenIds.length > 0) {
        const fresh = fetched.filter(j => !seenIds.includes(String(j.id)));
        if (fresh.length > 0) {
          setNewJobCount(c => c + fresh.length);
          const body = fresh.slice(0, 2).map(j => `${j.title} @ ${j.company_name}`).join(" • ");
          try {
            await LocalNotifications.schedule({
              notifications: [{
                id: Math.floor(Math.random() * 2000000),
                title: `🔍 ${fresh.length} New Job${fresh.length > 1 ? "s" : ""} Found!`,
                body,
                schedule: { at: new Date(Date.now() + 1000) },
              }],
            });
          } catch (_) {
            if (Notification.permission === "granted") {
              new Notification(`🔍 ${fresh.length} New Job${fresh.length > 1 ? "s" : ""} Found!`, { body });
            }
          }
        }
      }

      await secureSet("seenJobIds", currentIds);
      setLastCheck(new Date());
      setMonitorStatus("active");
    } catch {
      setMonitorStatus("error");
    }
  }, []);

  useEffect(() => {
    if (!autoMonitor) {
      clearInterval(monitorRef.current);
      setMonitorStatus("idle");
      return;
    }
    secureSet("cyberMonitor", "on");

    (async () => {
      try {
        const perm = await LocalNotifications.requestPermissions();
        if (perm.display !== "granted") {
          if ("Notification" in window) await Notification.requestPermission();
        }
        await BackgroundRunner.requestPermissions({ apis: ["notifications"] });
        const lastIds = (await secureGet("seenJobIds")) || [];
        const monitorQuery = query.trim() || (await secureGet("monitorQuery")) || "developer";
        await secureSet("monitorQuery", monitorQuery);
        await BackgroundRunner.dispatchEvent({
          label: "com.bula.cyberhunt.check",
          event: "jobSearch",
          details: { lastIds, query: monitorQuery },
        });
      } catch (_) {}
    })();

    runMonitorCheck();
    monitorRef.current = setInterval(runMonitorCheck, 30 * 60 * 1000);
    return () => clearInterval(monitorRef.current);
  }, [autoMonitor, runMonitorCheck]);

  function toggleMonitor() {
    if (autoMonitor) {
      secureSet("cyberMonitor", "off");
      setAutoMonitor(false);
      setNewJobCount(0);
    } else {
      setAutoMonitor(true);
    }
  }

  const isAndroidBrowser = /android/i.test(navigator.userAgent) && !/wv/.test(navigator.userAgent);

  return (
    <div style={{
      background: "#0D1117", minHeight: "100vh", maxWidth: 430,
      margin: "0 auto", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      color: "#E6EDF3", paddingBottom: 80, position: "relative",
    }}>

      {isAndroidBrowser && (
        <a href="/cyberhunt.apk" download="CyberHunt.apk" style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          background: "linear-gradient(135deg,#00FFA3,#00CC88)",
          color: "#0D1117", fontWeight: 800, fontSize: 14,
          padding: "12px 16px", textDecoration: "none", letterSpacing: .3,
        }}>
          <span style={{ fontSize: 20 }}>📲</span>
          Install JobHunt App (APK) — Tap to Download
        </a>
      )}

      {/* ── Header ── */}
      <div style={{
        padding: "20px 16px 0",
        background: "linear-gradient(180deg,#161B22 0%,#0D1117 100%)",
        borderBottom: "1px solid #21262D",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
          <RadarPulse />
          <div>
            <div style={{
              fontSize: 22, fontWeight: 800, letterSpacing: -.5,
              background: "linear-gradient(90deg,#00FFA3,#7B61FF)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>JobHunt</div>
            <div style={{ fontSize: 11, color: "#484F58", letterSpacing: 1, textTransform: "uppercase", marginTop: 1 }}>
              Multi-Platform Job Search
            </div>
          </div>
          {lastUpdated && (
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <div style={{ fontSize: 10, color: "#484F58", fontFamily: "monospace" }}>Updated</div>
              <div style={{ fontSize: 11, color: "#00FFA3", fontFamily: "monospace" }}>
                {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", borderBottom: "1px solid #21262D" }}>
          {[
            ["search", "🔍", "Search"],
            ["alerts", "🔔", "Alerts"],
            ["saved",  "🔖", "Saved"],
            ["monitor","📡", "Monitor"],
          ].map(([id, icon, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              flex: 1, padding: "10px 0", background: "none", border: "none",
              color: tab === id ? "#00FFA3" : "#484F58",
              fontWeight: tab === id ? 700 : 500, fontSize: 11, cursor: "pointer",
              borderBottom: tab === id ? "2px solid #00FFA3" : "2px solid transparent",
              transition: "all .15s",
            }}>
              {icon} {label}
              {id === "saved" && saved.length > 0 && (
                <span style={{ marginLeft: 3, fontSize: 10, color: "#00FFA3" }}>({saved.length})</span>
              )}
              {id === "monitor" && autoMonitor && (
                <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#00FFA3", marginLeft: 4, verticalAlign: "middle", boxShadow: "0 0 6px #00FFA3" }} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ════════════ SEARCH TAB ════════════ */}
      {tab === "search" && (
        <div style={{ padding: "16px 16px 0" }}>

          {/* Search input */}
          <div style={{ position: "relative", marginBottom: 14 }}>
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16 }}>🔍</span>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && doSearch()}
              placeholder="e.g. React developer, Data analyst, Designer..."
              style={{
                width: "100%", boxSizing: "border-box",
                background: "#161B22", border: "1px solid #30363D",
                borderRadius: 14, padding: "13px 14px 13px 42px",
                color: "#E6EDF3", fontSize: 14, fontFamily: "inherit", outline: "none",
              }}
            />
          </div>

          {/* Three filter rows */}
          <FilterChips
            label="Platform"
            options={PLATFORMS}
            value={platform}
            onChange={setPlatform}
            activeColor="#00FFA3"
          />
          <FilterChips
            label="Job Type"
            options={JOB_TYPES}
            value={jobType}
            onChange={setJobType}
            activeColor="#7B61FF"
          />
          <FilterChips
            label="Work Mode"
            options={WORK_MODES}
            value={workMode}
            onChange={setWorkMode}
            activeColor="#FBBF24"
          />

          {/* Search button */}
          <button onClick={doSearch} disabled={loading} style={{
            width: "100%", padding: "14px", borderRadius: 14, border: "none",
            background: loading ? "#21262D" : "linear-gradient(135deg,#00FFA3,#00CC88)",
            color: "#0D1117", fontWeight: 800, fontSize: 16,
            cursor: loading ? "not-allowed" : "pointer",
            marginTop: 4, marginBottom: 16, letterSpacing: .3,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "all .2s",
          }}>
            {loading ? (
              <>
                <span style={{ display: "inline-block", width: 18, height: 18, border: "2.5px solid #484F58", borderTopColor: "#00FFA3", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                Searching platforms...
              </>
            ) : "⚡ Search Jobs"}
          </button>

          {/* Stats row */}
          {jobs.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
              {[
                ["Total",     jobs.length,                                          "#00FFA3"],
                ["New",       jobs.filter(j => j.isNew).length,                    "#FBBF24"],
                ["Platforms", [...new Set(jobs.map(j => j.platform))].length,      "#7B61FF"],
              ].map(([lbl, val, color]) => (
                <div key={lbl} style={{ background: "#161B22", border: "1px solid #21262D", borderRadius: 12, padding: "12px 10px", textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: "monospace" }}>{val}</div>
                  <div style={{ fontSize: 10, color: "#484F58", marginTop: 2 }}>{lbl}</div>
                </div>
              ))}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div style={{ textAlign: "center", padding: "48px 0", color: "#484F58", fontSize: 13 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
              Searching {platform === "all" ? "all platforms" : PLATFORMS.find(p => p.id === platform)?.label}...
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>😕</div>
              <div style={{ fontSize: 14, color: "#8B949E" }}>{error}</div>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && jobs.length === 0 && (
            <div style={{ textAlign: "center", padding: "48px 0", color: "#484F58" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#8B949E", marginBottom: 6 }}>Ready to Search</div>
              <div style={{ fontSize: 13 }}>
                Enter any job title, use the filters above,<br />
                then tap ⚡ Search Jobs
              </div>
            </div>
          )}

          {/* Job cards */}
          {!loading && jobs.map(job => (
            <JobCard
              key={job.id || job.url || job.title}
              job={job}
              saved={isSaved(job)}
              onToggleSave={() => toggleSave(job)}
            />
          ))}
        </div>
      )}

      {/* ════════════ ALERTS TAB ════════════ */}
      {tab === "alerts" && (
        <div style={{ padding: "20px 16px 0" }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>📧 Job Alert Setup</div>
            <div style={{ fontSize: 13, color: "#8B949E", lineHeight: 1.5 }}>
              Set up email alerts on these platforms so you're notified the moment a matching job is posted — even without opening this app.
            </div>
          </div>

          <div style={{
            background: "linear-gradient(135deg,#7B61FF18,#00FFA308)",
            border: "1px solid #7B61FF33", borderRadius: 16, padding: "16px", marginBottom: 16,
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>🔔 Browser Notifications</div>
            <div style={{ fontSize: 12, color: "#8B949E", marginBottom: 12, lineHeight: 1.5 }}>
              Get instant alerts when new jobs are found while this app is open.
            </div>
            <button onClick={async () => {
              if (!("Notification" in window)) { showToast("Browser notifications not supported"); return; }
              const p = await Notification.requestPermission();
              if (p === "granted") {
                showToast("🔔 Notifications enabled!");
                new Notification("JobHunt 🔍", { body: "You'll be notified when new jobs are found!" });
              } else {
                showToast("Permission denied — use email alerts instead");
              }
            }} style={{
              width: "100%", padding: "12px", borderRadius: 12, border: "1px solid #7B61FF44",
              background: "#7B61FF22", color: "#9D86FA", fontWeight: 700, fontSize: 14, cursor: "pointer",
            }}>Enable Browser Alerts</button>
          </div>

          <div style={{ fontSize: 11, color: "#484F58", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12, fontFamily: "monospace" }}>
            Platform Alerts — Tap to Setup
          </div>

          {ALERT_PLATFORMS.map(alert => (
            <AlertCard
              key={alert.id}
              alert={alert}
              done={!!alertsDone[alert.id]}
              onSetup={a => {
                window.open(a.url, "_blank", "noopener,noreferrer");
                setAlertsDone(prev => ({ ...prev, [a.id]: true }));
                showToast(`${a.name} opened!`);
              }}
            />
          ))}

          <div style={{ background: "#161B22", border: "1px solid #21262D", borderRadius: 14, padding: "14px 16px", marginTop: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Setup Progress</div>
              <div style={{ fontSize: 13, color: "#00FFA3", fontFamily: "monospace", fontWeight: 700 }}>
                {Object.keys(alertsDone).length}/{ALERT_PLATFORMS.length}
              </div>
            </div>
            <div style={{ height: 6, background: "#21262D", borderRadius: 10, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 10,
                background: "linear-gradient(90deg,#00FFA3,#7B61FF)",
                width: `${(Object.keys(alertsDone).length / ALERT_PLATFORMS.length) * 100}%`,
                transition: "width .4s ease",
              }} />
            </div>
            <div style={{ fontSize: 11, color: "#484F58", marginTop: 8 }}>
              {Object.keys(alertsDone).length === ALERT_PLATFORMS.length
                ? "🎉 All alerts set! You're covered 24/7."
                : `${ALERT_PLATFORMS.length - Object.keys(alertsDone).length} more to setup for full coverage`}
            </div>
          </div>
        </div>
      )}

      {/* ════════════ SAVED TAB ════════════ */}
      {tab === "saved" && (
        <div style={{ padding: "20px 16px 0" }}>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>🔖 Saved Jobs</div>
          <div style={{ fontSize: 13, color: "#8B949E", marginBottom: 16 }}>{saved.length} saved jobs</div>

          {saved.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 0", color: "#484F58" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📌</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#8B949E", marginBottom: 6 }}>No saved jobs yet</div>
              <div style={{ fontSize: 13 }}>Search for jobs and tap 📌<br />to save listings for later</div>
              <button onClick={() => setTab("search")} style={{
                marginTop: 20, padding: "12px 28px", borderRadius: 12, border: "none",
                background: "linear-gradient(135deg,#00FFA3,#00CC88)",
                color: "#0D1117", fontWeight: 700, fontSize: 14, cursor: "pointer",
              }}>Go to Search</button>
            </div>
          ) : saved.map(job => (
            <JobCard
              key={job.id || job.url || job.title}
              job={job}
              saved={true}
              onToggleSave={() => toggleSave(job)}
            />
          ))}
        </div>
      )}

      {/* ════════════ MONITOR TAB ════════════ */}
      {tab === "monitor" && (
        <div style={{ padding: "20px 16px 0" }}>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>📡 Auto Monitor</div>
          <div style={{ fontSize: 13, color: "#8B949E", marginBottom: 16, lineHeight: 1.5 }}>
            Automatically checks for new jobs every 30 minutes and sends a phone notification — even when the app is closed.
          </div>

          {/* Active keyword display */}
          <div style={{
            background: "#161B22", border: "1px solid #21262D", borderRadius: 14,
            padding: "12px 16px", marginBottom: 16,
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <span style={{ fontSize: 20 }}>🔍</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: "#484F58", marginBottom: 2 }}>Monitoring keyword</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: query.trim() ? "#E6EDF3" : "#484F58" }}>
                {query.trim() || "No keyword set — search first"}
              </div>
            </div>
          </div>

          {/* Toggle card */}
          <div style={{
            background: autoMonitor ? "linear-gradient(135deg,#00FFA318,#7B61FF18)" : "#161B22",
            border: `1px solid ${autoMonitor ? "#00FFA344" : "#21262D"}`,
            borderRadius: 20, padding: "24px 20px", marginBottom: 16, textAlign: "center",
          }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>{autoMonitor ? "🟢" : "⚫"}</div>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4, color: autoMonitor ? "#00FFA3" : "#484F58" }}>
              {autoMonitor ? "Monitoring Active" : "Monitoring Off"}
            </div>
            <div style={{ fontSize: 12, color: "#8B949E", marginBottom: 20 }}>
              {autoMonitor
                ? monitorStatus === "checking"
                  ? "Checking now..."
                  : monitorStatus === "error"
                    ? "Last check failed — will retry in 30 min"
                    : lastCheck
                      ? `Last check: ${lastCheck.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · Next in 30 min`
                      : "Starting first check..."
                : "Tap to start 24/7 monitoring"}
            </div>
            <button
              onClick={toggleMonitor}
              disabled={!autoMonitor && !query.trim()}
              style={{
                padding: "14px 40px", borderRadius: 14, border: "none",
                background: (!autoMonitor && !query.trim())
                  ? "#21262D"
                  : autoMonitor
                    ? "linear-gradient(135deg,#FF6B6B,#CC4444)"
                    : "linear-gradient(135deg,#00FFA3,#00CC88)",
                color: (!autoMonitor && !query.trim()) ? "#484F58" : "#0D1117",
                fontWeight: 800, fontSize: 16,
                cursor: (!autoMonitor && !query.trim()) ? "not-allowed" : "pointer",
                boxShadow: autoMonitor ? "0 4px 20px #FF6B6B44" : "0 4px 20px #00FFA344",
              }}>
              {!autoMonitor && !query.trim() ? "Enter a keyword first" : autoMonitor ? "Stop Monitoring" : "Start Monitoring"}
            </button>
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            {[
              ["New Jobs Found", newJobCount, "#00FFA3"],
              ["Check Interval", "30 min",    "#7B61FF"],
            ].map(([lbl, val, color]) => (
              <div key={lbl} style={{ background: "#161B22", border: "1px solid #21262D", borderRadius: 14, padding: "14px", textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 800, color, fontFamily: "monospace" }}>{val}</div>
                <div style={{ fontSize: 11, color: "#484F58", marginTop: 4 }}>{lbl}</div>
              </div>
            ))}
          </div>

          {/* How it works */}
          <div style={{ background: "#161B22", border: "1px solid #21262D", borderRadius: 16, padding: "16px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>How it works</div>
            {[
              ["📡", "Scans Remotive API every 30 minutes for your keyword"],
              ["🔔", "Sends a notification the moment new jobs appear"],
              ["📱", "Works in background — even when app is closed (Android)"],
              ["💾", "Remembers which jobs you've already seen"],
              ["🔄", "Counter resets each time you stop and restart monitoring"],
            ].map(([icon, text]) => (
              <div key={text} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "flex-start" }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
                <span style={{ fontSize: 12, color: "#8B949E", lineHeight: 1.5 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Bottom nav ── */}
      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 430,
        background: "#161B22", borderTop: "1px solid #21262D",
        display: "flex", padding: "8px 0 12px", zIndex: 100,
      }}>
        {[
          ["search",  "🔍", "Search"],
          ["alerts",  "🔔", "Alerts"],
          ["saved",   "🔖", `Saved${saved.length > 0 ? ` (${saved.length})` : ""}`],
          ["monitor", "📡", "Monitor"],
        ].map(([id, icon, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            flex: 1, background: "none", border: "none", cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            color: tab === id ? "#00FFA3" : "#484F58", transition: "color .15s",
          }}>
            <span style={{ fontSize: 22 }}>{icon}</span>
            <span style={{ fontSize: 10, fontWeight: tab === id ? 700 : 500 }}>{label}</span>
            {tab === id && <div style={{ width: 20, height: 2, background: "#00FFA3", borderRadius: 2, marginTop: 1 }} />}
          </button>
        ))}
      </div>

      {toast && <Toast msg={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
