const express = require('express');
const mongoose = require('mongoose'); // 1. Import mongoose
const app = express();

app.use(express.json()); // Allows your server to accept JSON data

// 2. Point directly to your secret Vercel variable.
// Keep this exactly as written—do NOT paste your real link here.
const dbURI = process.env.MONGODB_URI;

// 3. Connect to your MongoDB Atlas cluster
mongoose.connect(dbURI)
  .then(() => {
    console.log("🚀 MongoDB Atlas connected successfully via Vercel!");
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
  });

// Simple test route to verify the server is live
app.get('/', (req, res) => {
    res.send("Server is running smoothly!");
});

// Start the server (Vercel handles the port automatically, but 5000 is standard for local testing)
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const Staff = require('./models/Staff');
const Shift = require('./models/Shift');
const Task = require('./models/Task');
const Payment = require('./models/Payment');
const Settings = require('./models/Settings');

const app = express();
app.use(cors());
app.use(express.json());

// ---------- DB connection, cached across warm serverless invocations ----------
let connPromise = null;
function ensureDB() {
  if (mongoose.connection.readyState === 1) return Promise.resolve();
  if (!connPromise) {
    if (!process.env.MONGODB_URI) {
      return Promise.reject(new Error("MONGODB_URI is not set"));
    }
    connPromise = mongoose.connect(process.env.MONGODB_URI, {
      dbName: "home_staff_ledger",
    });
  }
  return connPromise;
}

app.use(async (req, res, next) => {
  try {
    await ensureDB();
    next();
  } catch (e) {
    console.error("DB connection error:", e.message);
    res.status(500).json({ error: "Database not connected. Check the MONGODB_URI environment variable." });
  }
});

// ============ Settings ============
app.get('/api/settings', async (req, res) => {
  let s = await Settings.findOne({ key: "household" });
  if (!s) s = await Settings.create({ key: "household" });
  res.json(s);
});

app.put('/api/settings', async (req, res) => {
  const s = await Settings.findOneAndUpdate(
    { key: "household" },
    { title: req.body.title },
    { upsert: true, new: true }
  );
  res.json(s);
});

// ============ Staff ============
app.get('/api/staff', async (req, res) => {
  res.json(await Staff.find().sort({ createdAt: 1 }));
});

app.post('/api/staff', async (req, res) => {
  res.json(await Staff.create(req.body));
});

app.put('/api/staff/:id', async (req, res) => {
  res.json(await Staff.findByIdAndUpdate(req.params.id, req.body, { new: true }));
});

app.delete('/api/staff/:id', async (req, res) => {
  await Staff.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// ============ Shifts ============
app.get('/api/shifts', async (req, res) => {
  const q = {};
  if (req.query.start && req.query.end) {
    q.date = { $gte: req.query.start, $lte: req.query.end };
  }
  if (req.query.staffId) q.staffId = req.query.staffId;
  res.json(await Shift.find(q));
});

app.post('/api/shifts', async (req, res) => {
  const { repeatUntil, ...base } = req.body;
  const created = [await Shift.create(base)];
  if (repeatUntil) {
    let cur = new Date(base.date + "T00:00:00");
    const until = new Date(repeatUntil + "T00:00:00");
    for (;;) {
      cur = new Date(cur);
      cur.setDate(cur.getDate() + 7);
      if (cur > until) break;
      const ds = cur.toISOString().slice(0, 10);
      created.push(await Shift.create({ ...base, date: ds }));
    }
  }
  res.json(created);
});

app.put('/api/shifts/:id', async (req, res) => {
  res.json(await Shift.findByIdAndUpdate(req.params.id, req.body, { new: true }));
});

app.delete('/api/shifts/:id', async (req, res) => {
  await Shift.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// ============ Tasks ============
app.get('/api/tasks', async (req, res) => {
  const q = {};
  if (req.query.date) q.date = req.query.date;
  res.json(await Task.find(q));
});

app.post('/api/tasks', async (req, res) => {
  res.json(await Task.create(req.body));
});

app.put('/api/tasks/:id', async (req, res) => {
  res.json(await Task.findByIdAndUpdate(req.params.id, req.body, { new: true }));
});

app.delete('/api/tasks/:id', async (req, res) => {
  await Task.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// ============ Payments ============
// Every payment is its own permanent record, so "history" is never lost or
// overwritten — it's just queried different ways below.

app.get('/api/payments', async (req, res) => {
  const q = {};
  if (req.query.staffId) q.staffId = req.query.staffId;
  if (req.query.month) q.date = { $regex: "^" + req.query.month };
  res.json(await Payment.find(q).sort({ date: -1, createdAt: -1 }));
});

app.post('/api/payments', async (req, res) => {
  res.json(await Payment.create(req.body));
});

app.delete('/api/payments/:id', async (req, res) => {
  await Payment.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// Collective view: lifetime total, month-by-month total, and per-worker totals
app.get('/api/payments/summary', async (req, res) => {
  const [all, staff] = await Promise.all([
    Payment.find().sort({ date: -1 }),
    Staff.find(),
  ]);

  const lifetimeTotal = all.reduce((a, p) => a + p.amount, 0);

  const monthlyMap = {};
  all.forEach((p) => {
    const ym = p.date.slice(0, 7);
    monthlyMap[ym] = (monthlyMap[ym] || 0) + p.amount;
  });
  const monthly = Object.entries(monthlyMap)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, total]) => ({ month, total }));

  const byStaff = staff
    .map((s) => {
      const mine = all.filter((p) => String(p.staffId) === String(s._id));
      return {
        staffId: s._id,
        name: s.name,
        color: s.color,
        role: s.role,
        total: mine.reduce((a, p) => a + p.amount, 0),
        count: mine.length,
      };
    })
    .sort((a, b) => b.total - a.total);

  res.json({ lifetimeTotal, monthly, byStaff });
});

// Individual view: every payment ever made to one specific worker
app.get('/api/payments/staff/:staffId', async (req, res) => {
  const history = await Payment.find({ staffId: req.params.staffId }).sort({ date: -1, createdAt: -1 });
  const total = history.reduce((a, p) => a + p.amount, 0);
  res.json({ total, count: history.length, history });
});

module.exports = app;
