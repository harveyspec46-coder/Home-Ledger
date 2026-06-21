import React, { useEffect, useState, useCallback, useRef } from "react";
import { api } from "../api.js";
import { fmtDate, parseDate, startOfWeek, SCHEDULE_START_HOUR, SCHEDULE_END_HOUR, hourLabel, DAY_FULL, MONTH_NAMES, initials } from "../helpers.js";
import ShiftFormModal from "../components/ShiftFormModal.jsx";

export default function Schedule({ staff, anchor, setAnchor }) {
  const [shifts, setShifts] = useState([]);
  const [filterStaffId, setFilterStaffId] = useState(null);
  const [sheetState, setSheetState] = useState(null); // {mode:'add', date, hour} | {mode:'edit', shift}

  const start = startOfWeek(anchor);
  const days = [...Array(7)].map((_, i) => { const dt = new Date(start); dt.setDate(start.getDate() + i); return dt; });
  const dayStrs = days.map(fmtDate);
  const todayStr = fmtDate(new Date());
  const activeStaff = staff.filter((s) => s.status !== "paused");

  const load = useCallback(async () => {
    const list = await api.getShifts({ start: dayStrs[0], end: dayStrs[6] });
    setShifts(list);
  }, [dayStrs[0], dayStrs[6]]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => { if (!sheetState) load(); }, 20000);
    return () => clearInterval(t);
  }, [load, sheetState]);

  function staffById(id) { return staff.find((s) => s._id === id); }

  async function handleDrop(shiftId, newDate, newHour) {
    const updated = await api.updateShift(shiftId, { date: newDate, hour: newHour });
    setShifts((prev) => prev.map((s) => (s._id === shiftId ? updated : s)));
  }

  function weekStep(deltaDays) {
    const d = parseDate(anchor);
    d.setDate(d.getDate() + deltaDays);
    setAnchor(fmtDate(d));
  }

  if (staff.length === 0) {
    return <div className="empty">Add your staff first (over on the Staff page), then come back here to build the schedule.</div>;
  }

  const weekLabel = `${MONTH_NAMES[days[0].getMonth()].slice(0, 3)} ${days[0].getDate()} – ${MONTH_NAMES[days[6].getMonth()].slice(0, 3)} ${days[6].getDate()}`;
  const visibleShifts = filterStaffId ? shifts.filter((s) => s.staffId === filterStaffId) : shifts;

  return (
    <>
      <div className="sched-toolbar">
        <button className="icon-btn" onClick={() => weekStep(-7)}>&#8249;</button>
        <div className="week-label">{weekLabel}</div>
        <button className="icon-btn" onClick={() => weekStep(7)}>&#8250;</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setAnchor(todayStr)}>This week</button>
      </div>

      <div className="staff-chip-row">
        <button className={"staff-chip" + (!filterStaffId ? " active" : "")} onClick={() => setFilterStaffId(null)}>
          <span>All staff</span>
        </button>
        {activeStaff.map((s) => {
          const count = shifts.filter((sh) => sh.staffId === s._id).length;
          return (
            <button key={s._id} className={"staff-chip" + (filterStaffId === s._id ? " active" : "")} onClick={() => setFilterStaffId(s._id)}>
              <span className="chip-avatar" style={{ background: s.color }}>{initials(s.name)}</span>
              <span>{s.name}<small>{count} shift{count === 1 ? "" : "s"} this week</small></span>
            </button>
          );
        })}
      </div>

      <div className="sched-scroll">
        <div className="sched-grid">
          <div className="grid-row head-row">
            <div className="time-label"></div>
            {days.map((d, i) => (
              <div key={i} className={"day-head" + (fmtDate(d) === todayStr ? " is-today" : "")}>
                {DAY_FULL[d.getDay()]}<span>{d.getDate()}</span>
              </div>
            ))}
          </div>
          {Array.from({ length: SCHEDULE_END_HOUR - SCHEDULE_START_HOUR + 1 }, (_, i) => SCHEDULE_START_HOUR + i).map((h) => (
            <div className="grid-row" key={h}>
              <div className="time-label">{hourLabel(h)}</div>
              {dayStrs.map((ds) => {
                const here = visibleShifts.filter((sh) => sh.date === ds && sh.hour === h);
                return (
                  <GridCell
                    key={ds + h}
                    date={ds}
                    hour={h}
                    shifts={here}
                    staffById={staffById}
                    onDrop={handleDrop}
                    onAdd={() => setSheetState({ mode: "add", date: ds, hour: h })}
                    onTapShift={(sh) => setSheetState({ mode: "edit", shift: sh })}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {sheetState?.mode === "add" && (
        <ShiftFormModal
          mode="add"
          date={sheetState.date}
          hour={sheetState.hour}
          staff={activeStaff}
          defaultStaffId={filterStaffId}
          onClose={() => setSheetState(null)}
          onSaved={(created) => { const arr = Array.isArray(created) ? created : [created]; setShifts((prev) => [...prev, ...arr]); }}
        />
      )}
      {sheetState?.mode === "edit" && (
        <ShiftFormModal
          mode="edit"
          shift={sheetState.shift}
          staff={activeStaff}
          onClose={() => setSheetState(null)}
          onSaved={(updated) => setShifts((prev) => prev.map((s) => (s._id === updated._id ? updated : s)))}
          onDeleted={(id) => setShifts((prev) => prev.filter((s) => s._id !== id))}
        />
      )}
    </>
  );
}

function GridCell({ date, hour, shifts, staffById, onDrop, onAdd, onTapShift }) {
  const cellRef = useRef(null);
  const [hover, setHover] = useState(false);

  return (
    <div
      ref={cellRef}
      className={"grid-cell" + (hover ? " drop-hover" : "")}
      data-date={date}
      data-hour={hour}
    >
      {shifts.map((sh) => (
        <ShiftBlock key={sh._id} shift={sh} staff={staffById(sh.staffId)} onDrop={onDrop} onTap={() => onTapShift(sh)} />
      ))}
      {shifts.length === 0 && (
        <button className="cell-add" onClick={onAdd} aria-label="Add shift">+</button>
      )}
    </div>
  );
}

function ShiftBlock({ shift, staff, onDrop, onTap }) {
  const elRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  if (!staff) return null;
  const parts = staff.name.trim().split(/\s+/);
  const shortName = parts[0] + (parts[1] ? " " + parts[1][0] + "." : "");

  function onPointerDown(e) {
    const startX = e.clientX, startY = e.clientY;
    let isDragging = false;
    let ghost = null;
    const pointerId = e.pointerId;

    function onMove(ev) {
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      if (!isDragging && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
        isDragging = true;
        setDragging(true);
        const rect = elRef.current.getBoundingClientRect();
        ghost = elRef.current.cloneNode(true);
        ghost.classList.add("shift-ghost");
        ghost.style.position = "fixed";
        ghost.style.pointerEvents = "none";
        ghost.style.zIndex = "50";
        ghost.style.width = rect.width + "px";
        document.body.appendChild(ghost);
      }
      if (isDragging && ghost) {
        ghost.style.left = ev.clientX - 30 + "px";
        ghost.style.top = ev.clientY - 16 + "px";
        document.querySelectorAll(".grid-cell.drop-hover").forEach((c) => c.classList.remove("drop-hover"));
        const under = document.elementFromPoint(ev.clientX, ev.clientY);
        const cell = under && under.closest(".grid-cell");
        if (cell) cell.classList.add("drop-hover");
      }
    }
    function onUp(ev) {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.querySelectorAll(".grid-cell.drop-hover").forEach((c) => c.classList.remove("drop-hover"));
      if (ghost) ghost.remove();
      setDragging(false);
      if (isDragging) {
        const under = document.elementFromPoint(ev.clientX, ev.clientY);
        const cell = under && under.closest(".grid-cell");
        if (cell) {
          onDrop(shift._id, cell.dataset.date, Number(cell.dataset.hour));
        }
      } else {
        onTap();
      }
    }
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }

  return (
    <button
      ref={elRef}
      className={"shift-block" + (dragging ? " dragging-source" : "")}
      style={{ background: staff.color }}
      onPointerDown={onPointerDown}
    >
      <div className="shift-name">{shortName}</div>
      <div className="shift-task">{shift.task}{shift.duration ? " · " + shift.duration + "h" : ""}</div>
    </button>
  );
}
