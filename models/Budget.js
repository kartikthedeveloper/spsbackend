const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema(
  {
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    category: { type: String, required: true },
    monthlyLimit: { type: Number, required: true },
  },
  { timestamps: true }
);

budgetSchema.index({ branch: 1, category: 1 }, { unique: true });

module.exports = mongoose.model('Budget', budgetSchema);
