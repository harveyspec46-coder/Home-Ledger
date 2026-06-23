const mongoose = require('mongoose');

const ROLES = ["Cook", "Gardener", "Landscaping", "Housekeeper", "Cleaning", "Handyman", "Contractor", "Driver", "Nanny", "Other"];

const StaffSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    role: { type: String, enum: ROLES, default: "Other" },
    phone: { type: String, default: "" },
    employmentType: { type: String, enum: ["regular", "flexible"], default: "regular" },
    status: { type: String, enum: ["active", "paused"], default: "active" },
    payType: { type: String, enum: ["daily", "hourly", "monthly"], default: "daily" },
    payRate: { type: Number, default: 0 },
    notes: { type: String, default: "" },
    color: { type: String, default: "#4A5568" },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Staff || mongoose.model("Staff", StaffSchema);
module.exports.ROLES = ROLES;
