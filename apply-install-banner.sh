#!/bin/bash
set -e

echo "Adding the install reminder banner..."

# --- client/src/components/InstallBanner.jsx (new file) ---
cat > client/src/components/InstallBanner.jsx << 'PATCH_EOF'
import React, { useEffect, useState } from "react";

function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream;
}
function isStandaloneNow() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [standalone, setStandalone] = useState(isStandaloneNow());
  const [dismissed, setDismissed] = useState(false); // resets every fresh page load on purpose

  useEffect(() => {
    function onBeforeInstall(e) {
      e.preventDefault();
      setDeferredPrompt(e);
    }
    function onInstalled() {
      setStandalone(true);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (standalone || dismissed) return null;

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") setStandalone(true);
    setDeferredPrompt(null);
  }

  const ios = isIOS();
  const message = deferredPrompt
    ? "Install this app for one-tap access from your home screen."
    : ios
    ? 'Add to your home screen: tap Share, then "Add to Home Screen."'
    : "Add this app to your home screen from your browser menu for one-tap access.";

  return (
    <div className="install-banner">
      <div className="install-banner-text">{message}</div>
      <div className="install-banner-actions">
        {deferredPrompt && (
          <button className="install-banner-btn" onClick={handleInstallClick}>Install</button>
        )}
        <button className="install-banner-dismiss" onClick={() => setDismissed(true)} aria-label="Dismiss">&times;</button>
      </div>
    </div>
  );
}
PATCH_EOF

# --- client/src/App.jsx (full replace) ---
cat > client/src/App.jsx << 'PATCH_EOF'
import React, { useEffect, useState, useCallback } from "react";
import { api } from "./api.js";
import Sidebar from "./components/Sidebar.jsx";
import Lock from "./components/Lock.jsx";
import InstallBanner from "./components/InstallBanner.jsx";
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
    return (
      <>
        <InstallBanner />
        <div className="empty" style={{ margin: 40 }}>Loading your ledger…</div>
      </>
    );
  }
  if (locked) {
    return (
      <>
        <InstallBanner />
        <Lock onUnlock={() => { setLoaded(false); loadInitial(); }} />
      </>
    );
  }

  const [pageTitle, pageSub] = TITLES[page];

  return (
    <>
      <InstallBanner />
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
    </>
  );
}
PATCH_EOF

# --- client/src/styles.css (append only) ---
if ! grep -q "install-banner" client/src/styles.css; then
cat >> client/src/styles.css << 'PATCH_EOF'

/* ---------- Install banner ---------- */
.install-banner{
  position:fixed; bottom:0; left:0; right:0; z-index:60;
  background:var(--sidebar-bg); color:#F2ECDC; padding:10px 14px;
  display:flex; align-items:center; gap:10px; justify-content:space-between;
  font-size:12.5px; box-shadow:0 -2px 10px rgba(0,0,0,0.25);
}
.install-banner-text{flex:1; line-height:1.4;}
.install-banner-actions{display:flex; align-items:center; gap:8px; flex-shrink:0;}
.install-banner-btn{background:var(--brass); color:#1c1710; border:none; border-radius:8px; padding:7px 12px; font-weight:700; font-size:12.5px; cursor:pointer;}
.install-banner-dismiss{background:none; border:none; color:#C9BFA8; font-size:18px; cursor:pointer; padding:0 4px; line-height:1;}
PATCH_EOF
fi

echo "Files updated. Committing and pushing..."
git add -A
git commit -m "Add custom install-app reminder banner"
git push

echo ""
echo "Done — no Vercel settings needed for this one, it deploys automatically."
