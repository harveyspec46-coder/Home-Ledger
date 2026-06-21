import React, { useState } from "react";
import Sheet from "./Sheet.jsx";
import { SCHEDULE_START_HOUR, SCHEDULE_END_HOUR, hourLabel } from "../helpers.js";
import { api } from "../api.js";

const HOURS = Array.from({ length: SCHEDULE_END_HOUR - SCHEDULE_START_HOUR + 1 }, (_, i) => SCHEDULE_START_HOUR + i);
const DURATIONS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function ShiftFormModal({ mode, date, hour, shift, staff, defaultStaffId, onClose, onSaved, onDeleted }) {
  const isEdit = mode === "edit";
  const initialStaffId = isEdit ? shift.staffId : (defaultStaffId || staff[0]?._id || "");
  const initialStaff = staff.find((s) => s._id === initialStaffId);

  const [staffId, setStaffId] = useState(initialStaffId);
  const [task, setTask] = useState(isEdit ? shift.task || "" : "");
  const [hourVal, setHourVal] = useState(isEdit ? shift.hour : hour);
  const [duration, setDuration] = useState(isEdit ? (shift.duration || 2) : 2);
  const [repeat, setRepeat] = useState(!isEdit && initialStaff?.employmentType === "regular");
  const [repeatUntil, setRepeatUntil] = useState("");
  const [saving, setSaving] = useState(false);

  function onStaffChange(id) {
    setStaffId(id);
    const st = staff.find((s) => s._id === id);
    setRepeat(st?.employmentType === "regular");
  }

  async function save() {
    if (!staffId) return;
    setSaving(true);
    try {
      if (isEdit) {
        const updated = await api.updateShift(shift._id, { task: task.trim(), hour: Number(hourVal), duration: Number(duration) });
        onSaved(updated);
      } else {
        const payload = { staffId, date, hour: Number(hourVal), duration: Number(duration), task: task.trim() };
        if (repeat && repeatUntil) payload.repeatUntil = repeatUntil;
        const created = await api.createShift(payload);
        onSaved(created);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    await api.deleteShift(shift._id);
    onDeleted(shift._id);
    onClose();
  }

  return (
    <Sheet title={isEdit ? `Edit shift — ${shift.date}` : `Add shift — ${date}`} onClose={onClose}>
      {!isEdit && (
        <div className="field">
          <label>Staff</label>
          <select value={staffId} onChange={(e) => onStaffChange(e.target.value)}>
            {staff.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        </div>
      )}
      <div className="field"><label>Task</label><input value={task} onChange={(e) => setTask(e.target.value)} placeholder="e.g. Interior painting" /></div>
      <div className="field">
        <label>Start time</label>
        <select value={hourVal} onChange={(e) => setHourVal(Number(e.target.value))}>
          {HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Duration (hours)</label>
        <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
          {DURATIONS.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      {!isEdit && (
        <div className="field">
          <label><input type="checkbox" style={{ width: "auto", marginRight: 6 }} checked={repeat} onChange={(e) => setRepeat(e.target.checked)} /> Repeat weekly on this day</label>
          <input type="date" style={{ marginTop: 8 }} disabled={!repeat} value={repeatUntil} onChange={(e) => setRepeatUntil(e.target.value)} />
          <div className="help-text">If checked, this shift repeats every week up to the date above. You can still drag or delete any single one later — repeating just saves you re-adding it by hand.</div>
        </div>
      )}
      <button className="btn btn-primary btn-block" disabled={saving} onClick={save}>{saving ? "Saving…" : (isEdit ? "Save changes" : "Add shift")}</button>
      {isEdit && (
        <button className="btn btn-ghost btn-block" style={{ marginTop: 8, color: "var(--clay)" }} onClick={remove}>
          Delete this shift
        </button>
      )}
    </Sheet>
  );
}
