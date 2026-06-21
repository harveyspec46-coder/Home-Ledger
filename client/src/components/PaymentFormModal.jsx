import React, { useState } from "react";
import Sheet from "./Sheet.jsx";
import { fmtDate } from "../helpers.js";
import { api } from "../api.js";

export default function PaymentFormModal({ staffMember, onClose, onSaved }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(fmtDate(new Date()));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    const amt = Number(amount);
    if (!amt) return;
    setSaving(true);
    try {
      const created = await api.createPayment({ staffId: staffMember._id, date, amount: amt, note: note.trim() });
      onSaved(created);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet title={`Log payment — ${staffMember.name}`} onClose={onClose}>
      <div className="field"><label>Amount</label><input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></div>
      <div className="field"><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div className="field"><label>Note (optional)</label><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. half month advance" /></div>
      <button className="btn btn-primary btn-block" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save payment"}</button>
    </Sheet>
  );
}
