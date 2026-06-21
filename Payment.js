const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema(
  {
    staffId: { type: mongoose.Schema.Types.ObjectId, ref: "Staff", required: true },
    date: { type: String, required: true }, // YYYY-MM-DD, when the payment was made
    amount: { type: Number, required: true },
    note: { type: String, default: "" },
  },
  { timestamps: true } // createdAt doubles as an audit trail
);

PaymentSchema.index({ staffId: 1, date: -1 });
PaymentSchema.index({ date: -1 });

module.exports = mongoose.models.Payment || mongoose.model("Payment", PaymentSchema);
