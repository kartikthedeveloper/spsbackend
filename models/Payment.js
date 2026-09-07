const mongoose = require('mongoose');
const paymentSchema = new mongoose.Schema(
  {
    receiptNumber: { type: String, required: true, unique: true }, // e.g. RCPT-2026-0001
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    // feeStructure: { type: mongoose.Schema.Types.ObjectId, ref: 'FeeStructure' },

    amountPaid: { type: Number, required: true },
    paymentMode: { type: String, enum: ['cash', 'bank_transfer', 'upi'], required: true },
    transactionRef: { type: String, trim: true }, // UPI/bank ref number, optional
    paymentDate: { type: Date, default: Date.now },
    remarks: { type: String, trim: true },

    installmentLabel: { type: String, trim: true }, // e.g. "Installment 2 of 4"
    collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
