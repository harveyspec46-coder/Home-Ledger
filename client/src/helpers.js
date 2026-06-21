export const ROLES = ["Cook", "Gardener", "Housekeeper", "Driver", "Nanny", "Other"];
export const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
export const DAY_FULL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
export const PERSON_COLORS = ["#C2436B", "#4C5FA8", "#3F8F5F", "#C97A2B", "#2E8B8B", "#7A4F8C", "#4A5568", "#B5563C"];
export const SCHEDULE_START_HOUR = 6;
export const SCHEDULE_END_HOUR = 21;

export function pad(n) { return String(n).padStart(2, "0"); }
export function fmtDate(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
export function todayYM() { const d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1); }
export function parseDate(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
export function uid() { return Math.random().toString(36).slice(2, 9); }
export function money(n) {
  return (Math.round((n || 0) * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
export function initials(name) {
  return (name || "").trim().split(/\s+/).slice(0, 2).map((p) => (p[0] ? p[0].toUpperCase() : "")).join("");
}
export function hourLabel(h) {
  const ampm = h >= 12 ? "pm" : "am";
  let hh = h % 12;
  if (hh === 0) hh = 12;
  return hh + ampm;
}
export function startOfWeek(dateStr) {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() - d.getDay());
  return d;
}
export function monthLabel(ym) {
  const [y, m] = ym.split("-").map(Number);
  return MONTH_NAMES[m - 1] + " " + y;
}
