const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
  key: { type: String, default: "household", unique: true },
  title: { type: String, default: "Home Staff Ledger" },
});

module.exports = mongoose.models.Settings || mongoose.model("Settings", SettingsSchema);
