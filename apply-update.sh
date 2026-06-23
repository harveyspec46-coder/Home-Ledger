#!/bin/bash
set -e

echo "Applying updates: new role list + passcode lock..."

# --- api/models/Staff.js (full replace) ---
cat > api/models/Staff.js << 'PATCH_EOF'
const mongoose = require('mongoose');

const ROLES = ["Cook", "Gardener", "Landscaping", "Housekeeper", "Cleaning", "Handyman", "Contractor", "Driver", "Nanny", "Other"];

const StaffSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    role: { type: String, enum: ROLES, default: "Other" },
    phone: { type: String, default: "" },
    employmentType: { type: String, enum: ["regular", "flexible"], default: "regular" },
    status: { type: String, enum: ["active", "paused"], default: "active" },
    payType: { type: String, enum: ["daily", "hourly", "monthly"], default: "daily" },
    payRate: { type: Number, default: 0 },
    notes: { type: String, default: "" },
    color: { type: String, default: "#4A5568" },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Staff || mongoose.model("Staff", StaffSchema);
module.exports.ROLES = ROLES;
PATCH_EOF

# --- api/index.js (full replace, adds the passcode gate) ---
cat > api/index.js << 'PATCH_EOF'
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const Staff = require('./models/Staff');
const Shift = require('./models/Shift');
const Task = require('./models/Task');
const Payment = require('./models/Payment');
const Settings = require('./models/Settings');

const app = express();
app.use(cors());
app.use(express.json());

// ---------- Optional passcode gate ----------
// If APP_PASSCODE is set in Vercel's environment variables, every request
// must include a matching x-app-passcode header or it gets rejected.
// If APP_PASSCODE is not set, the app behaves exactly as before (open).
const APP_PASSCODE = process.env.APP_PASSCODE || "";
app.use((req, res, next) => {
  if (!APP_PASSCODE) return next();
  const provided = req.headers["x-app-passcode"];
  if (provided === APP_PASSCODE) return next();
  return res.status(401).json({ error: "Incorrect passcode" });
});

// ---------- DB connection, cached across warm serverless invocations ----------
let connPromise = null;
function ensureDB() {
  if (mongoose.connection.readyState === 1) return Promise.resolve();
  if (!connPromise) {
    if (!process.env.MONGODB_URI) {
      return Promise.reject(new Error("MONGODB_URI is not set"));
    }
    connPromise = mongoose.connect(process.env.MONGODB_URI, {
      dbName: "home_staff_ledger",
    });
  }
  return connPromise;
}

app.use(async (req, res, next) => {
  try {
    await ensureDB();
    next();
  } catch (e) {
    console.error("DB connection error:", e.message);
    res.status(500).json({ error: "Database not connected. Check the MONGODB_URI environment variable." });
  }
});

// ============ Settings ============
app.get('/api/settings', async (req, res) => {
  let s = await Settings.findOne({ key: "household" });
  if (!s) s = await Settings.create({ key: "household" });
  res.json(s);
});

app.put('/api/settings', async (req, res) => {
  const s = await Settings.findOneAndUpdate(
    { key: "household" },
    { title: req.body.title },
    { upsert: true, new: true }
  );
  res.json(s);
});

// ============ Staff ============
app.get('/api/staff', async (req, res) => {
  res.json(await Staff.find().sort({ createdAt: 1 }));
});

app.post('/api/staff', async (req, res) => {
  res.json(await Staff.create(req.body));
});

app.put('/api/staff/:id', async (req, res) => {
  res.json(await Staff.findByIdAndUpdate(req.params.id, req.body, { new: true }));
});

app.delete('/api/staff/:id', async (req, res) => {
  await Staff.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// ============ Shifts ============
app.get('/api/shifts', async (req, res) => {
  const q = {};
  if (req.query.start && req.query.end) {
    q.date = { $gte: req.query.start, $lte: req.query.end };
  }
  if (req.query.staffId) q.staffId = req.query.staffId;
  res.json(await Shift.find(q));
});

app.post('/api/shifts', async (req, res) => {
  const { repeatUntil, ...base } = req.body;
  const created = [await Shift.create(base)];
  if (repeatUntil) {
    let cur = new Date(base.date + "T00:00:00");
    const until = new Date(repeatUntil + "T00:00:00");
    for (;;) {
      cur = new Date(cur);
      cur.setDate(cur.getDate() + 7);
      if (cur > until) break;
      const ds = cur.toISOString().slice(0, 10);
      created.push(await Shift.create({ ...base, date: ds }));
    }
  }
  res.json(created);
});

app.put('/api/shifts/:id', async (req, res) => {
  res.json(await Shift.findByIdAndUpdate(req.params.id, req.body, { new: true }));
});

app.delete('/api/shifts/:id', async (req, res) => {
  await Shift.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// ============ Tasks ============
app.get('/api/tasks', async (req, res) => {
  const q = {};
  if (req.query.date) q.date = req.query.date;
  res.json(await Task.find(q));
});

app.post('/api/tasks', async (req, res) => {
  res.json(await Task.create(req.body));
});

app.put('/api/tasks/:id', async (req, res) => {
  res.json(await Task.findByIdAndUpdate(req.params.id, req.body, { new: true }));
});

app.delete('/api/tasks/:id', async (req, res) => {
  await Task.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// ============ Payments ============
// Every payment is its own permanent record, so "history" is never lost or
// overwritten — it's just queried different ways below.

app.get('/api/payments', async (req, res) => {
  const q = {};
  if (req.query.staffId) q.staffId = req.query.staffId;
  if (req.query.month) q.date = { $regex: "^" + req.query.month };
  res.json(await Payment.find(q).sort({ date: -1, createdAt: -1 }));
});

app.post('/api/payments', async (req, res) => {
  res.json(await Payment.create(req.body));
});

app.delete('/api/payments/:id', async (req, res) => {
  await Payment.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// Collective view: lifetime total, month-by-month total, and per-worker totals
app.get('/api/payments/summary', async (req, res) => {
  const [all, staff] = await Promise.all([
    Payment.find().sort({ date: -1 }),
    Staff.find(),
  ]);

  const lifetimeTotal = all.reduce((a, p) => a + p.amount, 0);

  const monthlyMap = {};
  all.forEach((p) => {
    const ym = p.date.slice(0, 7);
    monthlyMap[ym] = (monthlyMap[ym] || 0) + p.amount;
  });
  const monthly = Object.entries(monthlyMap)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, total]) => ({ month, total }));

  const byStaff = staff
    .map((s) => {
      const mine = all.filter((p) => String(p.staffId) === String(s._id));
      return {
        staffId: s._id,
        name: s.name,
        color: s.color,
        role: s.role,
        total: mine.reduce((a, p) => a + p.amount, 0),
        count: mine.length,
      };
    })
    .sort((a, b) => b.total - a.total);

  res.json({ lifetimeTotal, monthly, byStaff });
});

// Individual view: every payment ever made to one specific worker
app.get('/api/payments/staff/:staffId', async (req, res) => {
  const history = await Payment.find({ staffId: req.params.staffId }).sort({ date: -1, createdAt: -1 });
  const total = history.reduce((a, p) => a + p.amount, 0);
  res.json({ total, count: history.length, history });
});

module.exports = app;
PATCH_EOF

# --- client/src/helpers.js (full replace) ---
cat > client/src/helpers.js << 'PATCH_EOF'
export const ROLES = ["Cook", "Gardener", "Landscaping", "Housekeeper", "Cleaning", "Handyman", "Contractor", "Driver", "Nanny", "Other"];
export const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
export const DAY_FULL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
export const PERSON_COLORS = ["#C2436B", "#4C5FA8", "#3F8F5F", "#C97A2B", "#2E8B8B", "#7A4F8C", "#4A5568", "#B5563C"];
export const SCHEDULE_START_HOUR = 6;
export const SCHEDULE_END_HOUR = 21;

export function pad(n) { return String(n).padStart(2, "0"); }
export function fmtDate(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
export function todayYM() { const d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1); }
export function parseDate(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
export function uid() { return Math.random().toString(36).slice(2, 9); }
export function money(n) {
  return (Math.round((n || 0) * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
export function initials(name) {
  return (name || "").trim().split(/\s+/).slice(0, 2).map((p) => (p[0] ? p[0].toUpperCase() : "")).join("");
}
export function hourLabel(h) {
  const ampm = h >= 12 ? "pm" : "am";
  let hh = h % 12;
  if (hh === 0) hh = 12;
  return hh + ampm;
}
export function startOfWeek(dateStr) {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() - d.getDay());
  return d;
}
export function monthLabel(ym) {
  const [y, m] = ym.split("-").map(Number);
  return MONTH_NAMES[m - 1] + " " + y;
}
PATCH_EOF

# --- client/src/api.js (full replace, adds passcode header handling) ---
cat > client/src/api.js << 'PATCH_EOF'
const BASE = "/api";
const PASSCODE_KEY = "hsl_passcode";

export function getStoredPasscode() {
  try { return localStorage.getItem(PASSCODE_KEY) || ""; } catch (e) { return ""; }
}
export function setStoredPasscode(code) {
  try { localStorage.setItem(PASSCODE_KEY, code); } catch (e) {}
}
export function clearStoredPasscode() {
  try { localStorage.removeItem(PASSCODE_KEY); } catch (e) {}
}

async function http(method, path, body) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const code = getStoredPasscode();
  if (code) headers["x-app-passcode"] = code;

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    const err = new Error("Incorrect passcode");
    err.isAuthError = true;
    throw err;
  }
  if (!res.ok) {
    let msg = "Request failed (" + res.status + ")";
    try {
      const j = await res.json();
      if (j.error) msg = j.error;
    } catch (e) {}
    throw new Error(msg);
  }
  return res.json();
}

function qs(params) {
  const clean = Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== ""));
  const s = new URLSearchParams(clean).toString();
  return s ? "?" + s : "";
}

export const api = {
  getSettings: () => http("GET", "/settings"),
  updateSettings: (data) => http("PUT", "/settings", data),

  getStaff: () => http("GET", "/staff"),
  createStaff: (data) => http("POST", "/staff", data),
  updateStaff: (id, data) => http("PUT", `/staff/${id}`, data),
  deleteStaff: (id) => http("DELETE", `/staff/${id}`),

  getShifts: (params) => http("GET", "/shifts" + qs(params)),
  createShift: (data) => http("POST", "/shifts", data),
  updateShift: (id, data) => http("PUT", `/shifts/${id}`, data),
  deleteShift: (id) => http("DELETE", `/shifts/${id}`),

  getTasks: (date) => http("GET", "/tasks" + qs({ date })),
  createTask: (data) => http("POST", "/tasks", data),
  updateTask: (id, data) => http("PUT", `/tasks/${id}`, data),
  deleteTask: (id) => http("DELETE", `/tasks/${id}`),

  getPayments: (params) => http("GET", "/payments" + qs(params)),
  createPayment: (data) => http("POST", "/payments", data),
  deletePayment: (id) => http("DELETE", `/payments/${id}`),
  getPaymentsSummary: () => http("GET", "/payments/summary"),
  getStaffPaymentHistory: (staffId) => http("GET", `/payments/staff/${staffId}`),
};
PATCH_EOF

# --- client/src/components/Lock.jsx (new file) ---
cat > client/src/components/Lock.jsx << 'PATCH_EOF'
import React, { useState } from "react";
import { setStoredPasscode } from "../api.js";

const PIN_LENGTH = 4;
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];

export default function Lock({ onUnlock }) {
  const [digits, setDigits] = useState("");
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);

  async function tryUnlock(code) {
    setChecking(true);
    setError(false);
    setStoredPasscode(code);
    try {
      const res = await fetch("/api/settings", { headers: { "x-app-passcode": code } });
      if (res.status === 401) {
        setError(true);
        setDigits("");
        setStoredPasscode("");
      } else {
        onUnlock();
        return;
      }
    } catch (e) {
      setError(true);
    } finally {
      setChecking(false);
    }
  }

  function press(key) {
    if (checking || key === "") return;
    if (key === "back") {
      setDigits((d) => d.slice(0, -1));
      setError(false);
      return;
    }
    if (digits.length >= PIN_LENGTH) return;
    const next = digits + key;
    setDigits(next);
    setError(false);
    if (next.length === PIN_LENGTH) tryUnlock(next);
  }

  return (
    <div className="lock-screen">
      <div className="lock-card">
        <div className="lock-title">Enter passcode</div>
        <div className="lock-dots">
          {Array.from({ length: PIN_LENGTH }, (_, i) => (
            <span key={i} className={"lock-dot" + (i < digits.length ? " filled" : "") + (error ? " err" : "")} />
          ))}
        </div>
        <div className="lock-error">{error ? "Incorrect passcode, try again" : "\u00A0"}</div>
        <div className="lock-pad">
          {KEYS.map((k, i) => (
            <button
              key={i}
              className={"lock-key" + (k === "" ? " lock-key-empty" : "") + (k === "back" ? " lock-key-back" : "")}
              onClick={() => press(k)}
              disabled={k === "" || checking}
            >
              {k === "back" ? "\u232B" : k}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
PATCH_EOF

# --- client/src/components/Sidebar.jsx (full replace) ---
cat > client/src/components/Sidebar.jsx << 'PATCH_EOF'
import React from "react";
import { clearStoredPasscode } from "../api.js";

const NAV = [
  { key: "dashboard", label: "Dashboard", icon: "\u25C6" },
  { key: "schedule", label: "Schedule", icon: "\u25A6" },
  { key: "staff", label: "Staff", icon: "\u263A" },
  { key: "pay", label: "Pay", icon: "$" },
];

export default function Sidebar({ page, onNavigate, title, onTitleChange, staffCount, open }) {
  return (
    <>
      <aside className={"sidebar" + (open ? " open" : "")}>
        <div className="brand">
          <input
            className="brand-title"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
          />
          <div className="brand-sub">{staffCount} {staffCount === 1 ? "worker" : "workers"}</div>
        </div>
        <nav>
          {NAV.map((n) => (
            <button
              key={n.key}
              className={"nav-btn" + (page === n.key ? " active" : "")}
              onClick={() => onNavigate(n.key)}
            >
              <span className="ic">{n.icon}</span>{n.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          Tap and hold a shift block to drag it to a new day or time.
          <div style={{ marginTop: 10 }}>
            <button
              onClick={() => { clearStoredPasscode(); window.location.reload(); }}
              style={{ background: "none", border: "none", color: "#8C8268", textDecoration: "underline", cursor: "pointer", fontSize: "11.5px", padding: 0 }}
            >
              Lock this device now
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
PATCH_EOF

# --- client/src/App.jsx (full replace) ---
cat > client/src/App.jsx << 'PATCH_EOF'
import React, { useEffect, useState, useCallback } from "react";
import { api } from "./api.js";
import Sidebar from "./components/Sidebar.jsx";
import Lock from "./components/Lock.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Schedule from "./pages/Schedule.jsx";
import Staff from "./pages/Staff.jsx";
import Pay from "./pages/Pay.jsx";
import { fmtDate } from "./helpers.js";

const TITLES = {
  dashboard: ["Dashboard", "Today, this week at a glance"],
  schedule: ["Schedule", "Weekly view · drag a shift to reschedule"],
  staff: ["Staff", "Everyone who works in the home"],
  pay: ["Pay", "Track what's owed, and the full payment history"],
};

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [title, setTitle] = useState("Home Staff Ledger");
  const [staff, setStaff] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [locked, setLocked] = useState(false);
  const [scheduleAnchor, setScheduleAnchor] = useState(fmtDate(new Date()));

  const loadInitial = useCallback(async () => {
    try {
      const [settings, staffList] = await Promise.all([api.getSettings(), api.getStaff()]);
      setTitle(settings.title || "Home Staff Ledger");
      setStaff(staffList);
      setLocked(false);
    } catch (e) {
      if (e.isAuthError) {
        setLocked(true);
      } else {
        console.error(e);
      }
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { loadInitial(); }, [loadInitial]);

  let titleSaveTimer = null;
  function onTitleChange(val) {
    setTitle(val);
    clearTimeout(titleSaveTimer);
    titleSaveTimer = setTimeout(() => { api.updateSettings({ title: val }); }, 600);
  }

  function navigate(key) {
    setPage(key);
    setSidebarOpen(false);
  }

  function jumpToWeek(dateStr) {
    setScheduleAnchor(dateStr);
    setPage("schedule");
  }

  if (!loaded) {
    return <div className="empty" style={{ margin: 40 }}>Loading your ledger…</div>;
  }
  if (locked) {
    return <Lock onUnlock={() => { setLoaded(false); loadInitial(); }} />;
  }

  const [pageTitle, pageSub] = TITLES[page];

  return (
    <div className="app-shell">
      {sidebarOpen && <div className="sidebar-backdrop show" onClick={() => setSidebarOpen(false)} />}
      <Sidebar page={page} onNavigate={navigate} title={title} onTitleChange={onTitleChange} staffCount={staff.length} open={sidebarOpen} />
      <div className="main">
        <div className="topbar">
          <button className="icon-btn hamburger" onClick={() => setSidebarOpen(true)} aria-label="Open menu">&#9776;</button>
          <div>
            <div className="page-title">{pageTitle}</div>
            <div className="page-sub">{pageSub}</div>
          </div>
        </div>
        <div className="page-body">
          {page === "dashboard" && <Dashboard staff={staff} onJumpToWeek={jumpToWeek} />}
          {page === "schedule" && <Schedule staff={staff} anchor={scheduleAnchor} setAnchor={setScheduleAnchor} />}
          {page === "staff" && <Staff staff={staff} setStaff={setStaff} />}
          {page === "pay" && <Pay staff={staff} />}
        </div>
      </div>
    </div>
  );
}
PATCH_EOF

# --- client/src/styles.css (append only) ---
if ! grep -q "lock-screen" client/src/styles.css; then
cat >> client/src/styles.css << 'PATCH_EOF'
  --teal:#2E7D7D; --teal-bg:#D9E8E8;
  --sky:#3D7EA6; --sky-bg:#D8E8F0;
  --amber:#C97A2B; --amber-bg:#F2DFC4;
  --indigo:#4C5FA8; --indigo-bg:#DEE3F2;
}
.role-Landscaping{background:var(--teal-bg); color:var(--teal);}
.role-Cleaning{background:var(--sky-bg); color:var(--sky);}
.role-Handyman{background:var(--amber-bg); color:var(--amber);}
.role-Contractor{background:var(--indigo-bg); color:var(--indigo);}

/* ---------- Passcode lock screen ---------- */
.lock-screen{min-height:100vh; display:flex; align-items:center; justify-content:center; background:var(--bg); padding:20px;}
.lock-card{text-align:center; padding:24px;}
.lock-title{font-family:'Fraunces',serif; font-weight:600; font-size:19px; margin-bottom:18px; color:var(--ink);}
.lock-dots{display:flex; gap:14px; justify-content:center; margin-bottom:10px;}
.lock-dot{width:14px; height:14px; border-radius:50%; border:1.5px solid var(--ink-soft); display:inline-block; background:none;}
.lock-dot.filled{background:var(--ink); border-color:var(--ink);}
.lock-dot.err{border-color:var(--clay); background:var(--clay);}
.lock-error{color:var(--clay); font-size:12.5px; margin-bottom:14px; font-family:'JetBrains Mono',monospace; height:16px;}
.lock-pad{display:grid; grid-template-columns:repeat(3,64px); gap:14px; justify-content:center; margin-top:10px;}
.lock-key{width:64px; height:64px; border-radius:50%; border:1px solid var(--line); background:var(--surface); font-size:22px; font-family:'Fraunces',serif; cursor:pointer; color:var(--ink);}
.lock-key:active{background:var(--gray-bg);}
.lock-key-empty{visibility:hidden; cursor:default;}
.lock-key-back{font-size:18px; color:var(--ink-soft);}
.lock-key:disabled{cursor:default;}
PATCH_EOF
fi

echo "Files updated. Committing and pushing..."
git add -A
git commit -m "Add more worker roles and an app passcode lock"
git push

echo ""
echo "Done. Now go to Vercel -> your project -> Settings -> Environment Variables"
echo "and add APP_PASSCODE with a 4-digit code of your choice, then redeploy."
