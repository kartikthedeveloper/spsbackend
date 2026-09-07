const mongoose = require('mongoose');

const salarySchema = new mongoose.Schema(
  {
    staff: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    month: { type: Number, required: true }, // 1-12
    year: { type: Number, required: true },
    baseSalary: { type: Number, required: true },
    kpiScore: { type: Number, default: 100 }, // percentage, drives auto-calc bonus/deduction
    kpiAdjustment: { type: Number, default: 0 }, // computed amount, +/-
    deductions: { type: Number, default: 0 },
    netSalary: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'paid'], default: 'pending' },
    paidOn: { type: Date },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

salarySchema.index({ staff: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('Salary', salarySchema);
