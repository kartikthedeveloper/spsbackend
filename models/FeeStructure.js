const mongoose = require('mongoose');

const feeStructureSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    name: { type: String, required: true, trim: true }, // e.g. "Full Stack - Standard"
    feeItems: [
      {
        label: { type: String, required: true }, // Tuition Fee, Exam Fee, etc.
        amount: { type: Number, required: true },
      },
    ],
    totalAmount: { type: Number, required: true },
    paymentFrequency: {
      type: String,
      enum: ['one_time', 'monthly', 'quarterly', 'installments'],
      default: 'one_time',
    },
    numberOfInstallments: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FeeStructure', feeStructureSchema);
