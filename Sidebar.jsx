import React from "react";

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
        <div className="sidebar-foot">Tap and hold a shift block to drag it to a new day or time.</div>
      </aside>
    </>
  );
}
