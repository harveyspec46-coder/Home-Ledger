const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema(
  {
    date: { type: String, required: true }, // YYYY-MM-DD
    text: { type: String, required: true },
    staffId: { type: mongoose.Schema.Types.ObjectId, ref: "Staff", default: null },
    done: { type: Boolean, default: false },
  },
  { timestamps: true }
);

TaskSchema.index({ date: 1 });

module.exports = mongoose.models.Task || mongoose.model("Task", TaskSchema);
