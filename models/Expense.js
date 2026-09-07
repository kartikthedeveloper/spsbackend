const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema(
  {
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    category: {
      type: String,
      enum: ['rent', 'utilities', 'salary', 'marketing', 'maintenance', 'supplies', 'other'],
      required: true,
    },
    title: { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    notes: { type: String, trim: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Expense', expenseSchema);
