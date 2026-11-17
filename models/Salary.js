const mongoose = require('mongoose');

const salarySchema = new mongoose.Schema(
  {
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      required: true,
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    year: {
      type: Number,
      required: true,
      min: 2000,
      max: 2100,
    },
    baseSalary: {
      type: Number,
      required: true,
      min: 0,
    },
    kpiScore: {
      type: Number,
      default: 100,
      min: 0,
      max: 200,
    },
    kpiAdjustment: {
      type: Number,
      default: 0,
    },
    deductions: {
      type: Number,
      default: 0,
      min: 0,
    },
    netSalary: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'paid'],
      default: 'pending',
    },
    paidOn: {
      type: Date,
      default: null,
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

salarySchema.index(
  { staff: 1, month: 1, year: 1 },
  { unique: true }
);

salarySchema.index({
  branch: 1,
  year: 1,
  month: 1,
  status: 1,
});

module.exports = mongoose.model('Salary', salarySchema);
