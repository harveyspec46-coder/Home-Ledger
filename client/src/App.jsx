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
