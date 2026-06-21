import React, { useEffect, useState, useCallback } from "react";
import { api } from "../api.js";
import { fmtDate, parseDate, pad, MONTH_NAMES, DAY_LABELS, hourLabel, initials } from "../helpers.js";
import TaskFormModal from "../components/TaskFormModal.jsx";

export default function Dashboard({ staff, onJumpToWeek }) {
  const todayStr = fmtDate(new Date());
  const [todayShifts, setTodayShifts] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [monthAnchor, setMonthAnchor] = useState(todayStr);
  const [monthShifts, setMonthShifts] = useState([]);
  const [showAddTask, setShowAddTask] = useState(false);

  const staffById = (id) => staff.find((s) => s._id === id);

  const loadToday = useCallback(async () => {
    const [shifts, taskList] = await Promise.all([
      api.getShifts({ start: todayStr, end: todayStr }),
      api.getTasks(todayStr),
    ]);
    setTodayShifts(shifts.sort((a, b) => a.hour - b.hour));
    setTasks(taskList);
  }, [todayStr]);

  const loadMonth = useCallback(async () => {
    const d = parseDate(monthAnchor);
    const year = d.getFullYear(), month = d.getMonth();
    const first = fmtDate(new Date(year, month, 1));
    const last = fmtDate(new Date(year, month + 1, 0));
    const shifts = await api.getShifts({ start: first, end: last });
    setMonthShifts(shifts);
  }, [monthAnchor]);

  useEffect(() => { loadToday(); }, [loadToday]);
  useEffect(() => { loadMonth(); }, [loadMonth]);

  useEffect(() => {
    const t = setInterval(() => { loadToday(); }, 20000);
    return () => clearInterval(t);
  }, [loadToday]);

  async function toggleTask(t) {
    const updated = await api.updateTask(t._id, { done: !t.done });
    setTasks((prev) => prev.map((x) => (x._id === t._id ? updated : x)));
  }
  async function deleteTask(id) {
    await api.deleteTask(id);
    setTasks((prev) => prev.filter((x) => x._id !== id));
  }

  const d = parseDate(monthAnchor);
  const year = d.getFullYear(), month = d.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(<div className="month-cell muted" key={"m" + i}></div>);
  for (let day = 1; day <= daysInMonth; day++) {
    const ds = year + "-" + pad(month + 1) + "-" + pad(day);
    const dayShifts = monthShifts.filter((s) => s.date === ds);
    const seen = new Set();
    const dots = dayShifts.filter((s) => { if (seen.has(s.staffId)) return false; seen.add(s.staffId); return true; }).slice(0, 6);
    cells.push(
      <div key={ds} className={"month-cell" + (ds === todayStr ? " is-today" : "")} onClick={() => onJumpToWeek(ds)}>
        <span>{day}</span>
        <div className="dots">
          {dots.map((s) => { const st = staffById(s.staffId); return <span key={s._id} className="dot" style={{ background: st ? st.color : "#999" }} />; })}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="card">
        <div className="row" style={{ marginBottom: 10 }}>
          <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 17 }}>
            Today &middot; {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </div>
        </div>
        {todayShifts.length === 0 ? (
          <div className="empty">Nobody's scheduled today. Go to Schedule to add a shift.</div>
        ) : (
          todayShifts.map((s) => {
            const st = staffById(s.staffId);
            if (!st) return null;
            return (
              <div className="row" key={s._id} style={{ padding: "7px 0", borderBottom: "1px solid var(--line)" }}>
                <div className="row" style={{ gap: 10, justifyContent: "flex-start" }}>
                  <div className="avatar" style={{ background: st.color }}>{initials(st.name)}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {st.name} <span className={"pill role-" + st.role}>{st.role}</span>
                    </div>
                    <div className="help-text" style={{ marginTop: 1 }}>{hourLabel(s.hour)} &middot; {s.task}</div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: 8 }}>
          <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 15 }}>Tasks today</div>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowAddTask(true)}>+ Add task</button>
        </div>
        {tasks.length === 0 ? (
          <div className="empty">No tasks yet.</div>
        ) : (
          tasks.map((t) => (
            <div className="task-row" key={t._id}>
              <button className={"checkbox" + (t.done ? " done" : "")} onClick={() => toggleTask(t)}>{t.done ? "\u2713" : ""}</button>
              <div className={"task-text" + (t.done ? " done" : "")}>
                {t.text}{t.staffId && staffById(t.staffId) ? <span className="help-text"> — {staffById(t.staffId).name}</span> : null}
              </div>
              <button className="icon-btn" onClick={() => deleteTask(t._id)}>&times;</button>
            </div>
          ))
        )}
      </div>

      <div className="card">
        <div className="month-switch">
          <button className="icon-btn" onClick={() => { const nd = new Date(year, month - 1, 1); setMonthAnchor(fmtDate(nd)); }}>&#8249;</button>
          <div className="label">{MONTH_NAMES[month]} {year}</div>
          <button className="icon-btn" onClick={() => { const nd = new Date(year, month + 1, 1); setMonthAnchor(fmtDate(nd)); }}>&#8250;</button>
        </div>
        <div className="month-grid">
          {DAY_LABELS.map((l, i) => <div className="month-head" key={i}>{l}</div>)}
          {cells}
        </div>
        <div className="help-text" style={{ marginTop: 8 }}>Tap a date to open that week in Schedule.</div>
      </div>

      {showAddTask && (
        <TaskFormModal
          date={todayStr}
          staff={staff}
          onClose={() => setShowAddTask(false)}
          onSaved={(t) => setTasks((prev) => [...prev, t])}
        />
      )}
    </>
  );
}
