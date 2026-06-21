import React, { useState } from "react";
import Sheet from "./Sheet.jsx";
import { ROLES, PERSON_COLORS } from "../helpers.js";
import { api } from "../api.js";

export default function StaffFormModal({ existing, staffCount, onClose, onSaved, onDeleted }) {
  const [name, setName] = useState(existing?.name || "");
  const [role, setRole] = useState(existing?.role || "Cook");
  const [phone, setPhone] = useState(existing?.phone || "");
  const [employmentType, setEmploymentType] = useState(existing?.employmentType || "regular");
  const [status, setStatus] = useState(existing?.status || "active");
  const [payType, setPayType] = useState(existing?.payType || "daily");
  const [payRate, setPayRate] = useState(existing?.payRate ?? "");
  const [notes, setNotes] = useState(existing?.notes || "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    const payload = {
      name: name.trim(),
      role,
      phone: phone.trim(),
      employmentType,
      status,
      payType,
      payRate: Number(payRate) || 0,
      notes: notes.trim(),
    };
    try {
      if (existing) {
        const updated = await api.updateStaff(existing._id, payload);
        onSaved(updated);
      } else {
        payload.color = PERSON_COLORS[staffCount % PERSON_COLORS.length];
        const created = await api.createStaff(payload);
        onSaved(created);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    await api.deleteStaff(existing._id);
    onDeleted(existing._id);
    onClose();
  }

  return (
    <Sheet title={(existing ? "Edit" : "Add") + " staff member"} onClose={onClose}>
      <div className="field"><label>Name</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Maria" /></div>
      <div className="field"><label>Role</label>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div className="field"><label>Phone</label><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="optional" /></div>
      <div className="field">
        <label>Work pattern</label>
        <select value={employmentType} onChange={(e) => setEmploymentType(e.target.value)}>
          <option value="regular">Regular — works a steady pattern</option>
          <option value="flexible">Flexible / on-call — comes in as needed</option>
        </select>
        <div className="help-text">This just changes the default when you add a shift for them — regular staff default to repeating weekly, flexible staff default to one-off. Nothing is locked in either way.</div>
      </div>
      <div className="field"><label>Status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="active">Active</option>
          <option value="paused">Paused (keep history, hide from new shifts)</option>
        </select>
      </div>
      <div className="field"><label>Pay type</label>
        <select value={payType} onChange={(e) => setPayType(e.target.value)}>
          <option value="daily">Per day worked</option>
          <option value="hourly">Per hour worked</option>
          <option value="monthly">Fixed monthly salary</option>
        </select>
      </div>
      <div className="field"><label>Pay rate</label><input type="number" inputMode="decimal" value={payRate} onChange={(e) => setPayRate(e.target.value)} placeholder="0" /></div>
      <div className="field"><label>Notes</label><textarea rows="2" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. usually free Tue/Thu mornings" /></div>
      <button className="btn btn-primary btn-block" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save"}</button>
      {existing && (
        <button className="btn btn-ghost btn-block" style={{ marginTop: 8, color: "var(--clay)" }} onClick={remove}>
          Remove staff member
        </button>
      )}
    </Sheet>
  );
}
