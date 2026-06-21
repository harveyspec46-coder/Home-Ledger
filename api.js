const BASE = "/api";

async function http(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = "Request failed (" + res.status + ")";
    try {
      const j = await res.json();
      if (j.error) msg = j.error;
    } catch (e) {}
    throw new Error(msg);
  }
  return res.json();
}

function qs(params) {
  const clean = Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== ""));
  const s = new URLSearchParams(clean).toString();
  return s ? "?" + s : "";
}

export const api = {
  getSettings: () => http("GET", "/settings"),
  updateSettings: (data) => http("PUT", "/settings", data),

  getStaff: () => http("GET", "/staff"),
  createStaff: (data) => http("POST", "/staff", data),
  updateStaff: (id, data) => http("PUT", `/staff/${id}`, data),
  deleteStaff: (id) => http("DELETE", `/staff/${id}`),

  getShifts: (params) => http("GET", "/shifts" + qs(params)),
  createShift: (data) => http("POST", "/shifts", data),
  updateShift: (id, data) => http("PUT", `/shifts/${id}`, data),
  deleteShift: (id) => http("DELETE", `/shifts/${id}`),

  getTasks: (date) => http("GET", "/tasks" + qs({ date })),
  createTask: (data) => http("POST", "/tasks", data),
  updateTask: (id, data) => http("PUT", `/tasks/${id}`, data),
  deleteTask: (id) => http("DELETE", `/tasks/${id}`),

  getPayments: (params) => http("GET", "/payments" + qs(params)),
  createPayment: (data) => http("POST", "/payments", data),
  deletePayment: (id) => http("DELETE", `/payments/${id}`),
  getPaymentsSummary: () => http("GET", "/payments/summary"),
  getStaffPaymentHistory: (staffId) => http("GET", `/payments/staff/${staffId}`),
};
