const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    maxDiscountPercent: { type: Number, default: 10 }, // branch-level discount ceiling; Admin can override
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Branch', branchSchema);
