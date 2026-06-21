import React, { useEffect, useState, useCallback } from "react";
import { api } from "../api.js";
import { todayYM, monthLabel, money, initials } from "../helpers.js";
import PaymentFormModal from "../components/PaymentFormModal.jsx";

export default function Pay({ staff }) {
  const [tab, setTab] = useState("thismonth"); // thismonth | history
  return (
    <>
      <div className="pay-tabs">
        <button className={"pay-tab-btn" + (tab === "thismonth" ? " active" : "")} onClick={() => setTab("thismonth")}>This month</button>
        <button className={"pay-tab-btn" + (tab === "history" ? " active" : "")} onClick={() => setTab("history")}>History</button>
      </div>
      {tab === "thismonth" ? <ThisMonth staff={staff} /> : <History staff={staff} />}
    </>
  );
}

// ============ THIS MONTH ============
function ThisMonth({ staff }) {
  const [payMonth, setPayMonth] = useState(todayYM());
  const [shifts, setShifts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [payModalFor, setPayModalFor] = useState(null);

  const load = useCallback(async () => {
    const [y, m] = payMonth.split("-").map(Number);
    const first = `${y}-${String(m).padStart(2, "0")}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const last = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const [shiftList, paymentList] = await Promise.all([
      api.getShifts({ start: first, end: last }),
      api.getPayments({ month: payMonth }),
    ]);
    setShifts(shiftList);
    setPayments(paymentList);
  }, [payMonth]);

  useEffect(() => { load(); }, [load]);

  function expectedFor(s) {
    const mine = shifts.filter((sh) => sh.staffId === s._id);
    if (s.payType === "monthly") return Number(s.payRate || 0);
    if (s.payType === "hourly") return mine.reduce((a, sh) => a + Number(sh.duration || 1), 0) * Number(s.payRate || 0);
    const dates = new Set(mine.map((sh) => sh.date));
    return dates.size * Number(s.payRate || 0);
  }
  function paidFor(s) {
    return payments.filter((p) => p.staffId === s._id).reduce((a, p) => a + p.amount, 0);
  }

  const rows = staff.map((s) => {
    const expected = expectedFor(s);
    const paid = paidFor(s);
    return { s, expected, paid, due: Math.max(0, expected - paid) };
  });
  const grandPaid = rows.reduce((a, r) => a + r.paid, 0);
  const grandDue = rows.reduce((a, r) => a + r.due, 0);

  function stepMonth(delta) {
    let [y, m] = payMonth.split("-").map(Number);
    m += delta;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setPayMonth(`${y}-${String(m).padStart(2, "0")}`);
  }

  return (
    <>
      <div className="month-switch">
        <button className="icon-btn" onClick={() => stepMonth(-1)}>&#8249;</button>
        <div className="label">{monthLabel(payMonth)}</div>
        <button className="icon-btn" onClick={() => stepMonth(1)}>&#8250;</button>
      </div>
      <div className="card">
        <div className="stat-row"><span>Paid this month</span><span className="stat-num">{money(grandPaid)}</span></div>
        <div className="stat-row"><span>Outstanding</span><span className={"stat-num " + (grandDue > 0 ? "due-pos" : "due-zero")}>{money(grandDue)}</span></div>
      </div>

      {rows.length === 0 ? (
        <div className="empty">Add staff first to track pay.</div>
      ) : (
        rows.map(({ s, expected, paid, due }) => (
          <div className="card" key={s._id}>
            <div className="row">
              <div>
                <span className={"pill role-" + s.role}>{s.role}</span>
                <div style={{ fontWeight: 600, fontFamily: "'Fraunces',serif", fontSize: 16 }}>{s.name}</div>
                <div className="help-text">Expected {money(expected)} · Paid {money(paid)}</div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => setPayModalFor(s)}>Log payment</button>
            </div>
            <div className="stat-row" style={{ borderTop: "1px solid var(--line)", marginTop: 8, paddingTop: 8 }}>
              <span className="help-text">Outstanding</span>
              <span className={"stat-num " + (due > 0 ? "due-pos" : "due-zero")}>{money(due)}</span>
            </div>
          </div>
        ))
      )}

      {payModalFor && (
        <PaymentFormModal
          staffMember={payModalFor}
          onClose={() => setPayModalFor(null)}
          onSaved={(p) => setPayments((prev) => [...prev, p])}
        />
      )}
    </>
  );
}

// ============ HISTORY (collective + individual) ============
function History({ staff }) {
  const [summary, setSummary] = useState(null);
  const [drillStaffId, setDrillStaffId] = useState(null);

  const loadSummary = useCallback(async () => {
    setSummary(await api.getPaymentsSummary());
  }, []);
  useEffect(() => { loadSummary(); }, [loadSummary]);

  if (!summary) return <div className="empty">Loading payment history…</div>;

  if (drillStaffId) {
    return <StaffHistory staffId={drillStaffId} staff={staff} onBack={() => setDrillStaffId(null)} />;
  }

  return (
    <>
      <div className="card">
        <div className="help-text" style={{ textTransform: "uppercase", letterSpacing: "0.05em", fontSize: 11 }}>Lifetime, all workers</div>
        <div className="lifetime-stat" style={{ marginTop: 4 }}>{money(summary.lifetimeTotal)}</div>
      </div>

      <div className="card">
        <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 15, marginBottom: 6 }}>By worker, all-time</div>
        {summary.byStaff.length === 0 ? (
          <div className="empty">No payments logged yet.</div>
        ) : (
          summary.byStaff.map((b) => (
            <div className="history-row" key={b.staffId} onClick={() => setDrillStaffId(b.staffId)}>
              <div className="row" style={{ gap: 10, justifyContent: "flex-start" }}>
                <div className="avatar" style={{ background: b.color || "#999" }}>{initials(b.name)}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{b.name}</div>
                  <div className="help-text">{b.count} payment{b.count === 1 ? "" : "s"} logged</div>
                </div>
              </div>
              <span className="stat-num">{money(b.total)}</span>
            </div>
          ))
        )}
      </div>

      <div className="card">
        <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 15, marginBottom: 6 }}>By month, collectively</div>
        {summary.monthly.length === 0 ? (
          <div className="empty">No payments logged yet.</div>
        ) : (
          summary.monthly.map((m) => (
            <div className="stat-row" key={m.month}>
              <span>{monthLabel(m.month)}</span>
              <span className="stat-num">{money(m.total)}</span>
            </div>
          ))
        )}
      </div>
    </>
  );
}

function StaffHistory({ staffId, staff, onBack }) {
  const [data, setData] = useState(null);
  const s = staff.find((x) => x._id === staffId);

  useEffect(() => {
    api.getStaffPaymentHistory(staffId).then(setData);
  }, [staffId]);

  async function remove(id) {
    await api.deletePayment(id);
    setData((prev) => {
      const history = prev.history.filter((p) => p._id !== id);
      return { ...prev, history, total: history.reduce((a, p) => a + p.amount, 0), count: history.length };
    });
  }

  return (
    <>
      <button className="back-link" onClick={onBack}>&larr; Back to all workers</button>
      <div className="card">
        <div className="row" style={{ gap: 10, justifyContent: "flex-start", marginBottom: 6 }}>
          <div className="avatar" style={{ background: s?.color || "#999" }}>{initials(s?.name)}</div>
          <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 700, fontSize: 18 }}>{s?.name}</div>
        </div>
        <div className="lifetime-stat">{money(data?.total || 0)}</div>
        <div className="help-text">paid in total, across {data?.count || 0} payment{data?.count === 1 ? "" : "s"}</div>
      </div>

      <div className="card">
        <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 15, marginBottom: 6 }}>Every payment, most recent first</div>
        {!data || data.history.length === 0 ? (
          <div className="empty">No payments logged for this worker yet.</div>
        ) : (
          data.history.map((p) => (
            <div className="task-row" key={p._id}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{money(p.amount)}</div>
                <div className="help-text">{p.date}{p.note ? " · " + p.note : ""}</div>
              </div>
              <button className="icon-btn" onClick={() => remove(p._id)}>&times;</button>
            </div>
          ))
        )}
      </div>
    </>
  );
}
