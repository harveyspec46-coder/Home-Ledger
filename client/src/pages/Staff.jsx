import React, { useState } from "react";
import { initials, money } from "../helpers.js";
import StaffFormModal from "../components/StaffFormModal.jsx";

export default function Staff({ staff, setStaff }) {
  const [modal, setModal] = useState(null); // {mode:'add'} | {mode:'edit', existing}

  function onSaved(s) {
    setStaff((prev) => {
      const exists = prev.some((x) => x._id === s._id);
      return exists ? prev.map((x) => (x._id === s._id ? s : x)) : [...prev, s];
    });
  }
  function onDeleted(id) {
    setStaff((prev) => prev.filter((x) => x._id !== id));
  }

  return (
    <>
      <button className="btn btn-primary" style={{ marginBottom: 14 }} onClick={() => setModal({ mode: "add" })}>
        + Add staff member
      </button>

      {staff.length === 0 && <div className="empty">No staff yet.</div>}

      {staff.map((s) => (
        <div className="card" key={s._id}>
          <div className="row" style={{ alignItems: "flex-start" }}>
            <div className="row" style={{ gap: 10, justifyContent: "flex-start", alignItems: "flex-start" }}>
              <div className="avatar" style={{ background: s.color }}>{initials(s.name)}</div>
              <div>
                <div style={{ fontWeight: 600, fontFamily: "'Fraunces',serif", fontSize: 16 }}>{s.name}</div>
                <div style={{ marginTop: 3 }}>
                  <span className={"pill role-" + s.role}>{s.role}</span>
                  <span className={"pill " + (s.employmentType === "flexible" ? "badge-flex" : "badge-regular")}>
                    {s.employmentType === "flexible" ? "Flexible / on-call" : "Regular"}
                  </span>
                  {s.status === "paused" && <span className="pill badge-paused">Paused</span>}
                </div>
                <div className="help-text" style={{ marginTop: 6 }}>
                  {s.phone ? s.phone + " · " : ""}
                  {s.payType === "monthly" ? "Monthly" : s.payType === "hourly" ? "Per hour" : "Per day"}: {money(s.payRate || 0)}
                </div>
                {s.notes && <div className="help-text" style={{ marginTop: 3 }}>{s.notes}</div>}
              </div>
            </div>
            <button className="icon-btn" onClick={() => setModal({ mode: "edit", existing: s })}>&#9998;</button>
          </div>
        </div>
      ))}

      {modal && (
        <StaffFormModal
          existing={modal.existing}
          staffCount={staff.length}
          onClose={() => setModal(null)}
          onSaved={onSaved}
          onDeleted={onDeleted}
        />
      )}
    </>
  );
}
