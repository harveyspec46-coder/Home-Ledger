const mongoose = require('mongoose');

const ShiftSchema = new mongoose.Schema(
  {
    staffId: { type: mongoose.Schema.Types.ObjectId, ref: "Staff", required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    hour: { type: Number, required: true }, // 24h start hour
    duration: { type: Number, default: 2 }, // hours
    task: { type: String, default: "" },
  },
  { timestamps: true }
);

ShiftSchema.index({ date: 1 });
ShiftSchema.index({ staffId: 1 });

module.exports = mongoose.models.Shift || mongoose.model("Shift", ShiftSchema);
