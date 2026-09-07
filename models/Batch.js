const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    trainer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    timing: { type: String, trim: true }, // e.g. "Mon-Fri, 5:00 PM - 6:30 PM"
    capacity: { type: Number, default: 30 },
    status: { type: String, enum: ['upcoming', 'ongoing', 'completed', 'cancelled'], default: 'upcoming' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Batch', batchSchema);
