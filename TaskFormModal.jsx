import React, { useState } from "react";
import Sheet from "./Sheet.jsx";
import { api } from "../api.js";

export default function TaskFormModal({ date, staff, onClose, onSaved }) {
  const [text, setText] = useState("");
  const [staffId, setStaffId] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const created = await api.createTask({ date, text: text.trim(), staffId: staffId || null });
      onSaved(created);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet title="New task" onClose={onClose}>
      <div className="field"><label>Task</label><input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Water the front garden" /></div>
      <div className="field">
        <label>Assign to (optional)</label>
        <select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
          <option value="">Nobody specific</option>
          {staff.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
        </select>
      </div>
      <button className="btn btn-primary btn-block" disabled={saving} onClick={save}>{saving ? "Adding…" : "Add task"}</button>
    </Sheet>
  );
}
