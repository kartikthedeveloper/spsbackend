const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema(
  {
    leadId: { type: String, required: true, unique: true },
    fullName: { type: String, trim: true },
    phone: { type: String, required: true, trim: true },
    altPhone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },

    source: {
      type: String,
      enum: ['website', 'referral', 'social_media', 'walk_in', 'call', 'ad_campaign', 'other'],
      default: 'other',
    },
    priority: { type: String, enum: ['hot', 'warm', 'cold'], default: 'warm' },
    customMessage: { type: String, trim: true, default: '' },
    stage: {
      type: String,
      enum: ['new', 'contacted', 'demo_scheduled', 'follow_up', 'converted', 'lost'],
      default: 'new',
    },

    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    interestedCourse: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', default: null },
    budgetRange: { type: String, trim: true },

    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    leadOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // ✅ Notes (existing) — general activity
    notes: [
      {
        text: String,
        addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        addedAt: { type: Date, default: Date.now },
      },
    ],

    // ✅ NEW: Remarks history (date-wise, multiple entries)
    remarks: [
      {
        text: { type: String, required: true, trim: true },
        addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        addedAt: { type: Date, default: Date.now },
      },
    ],

    // ✅ NEW: Expected coming / visit date (kab aane ko bola hai)
    comingDate: { type: Date, default: null },

    followUpAt: { type: Date },
    lastContactedAt: { type: Date },
    convertedAt: { type: Date },
    convertedStudent: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null },
    lostReason: { type: String, trim: true },
  },
  { timestamps: true }
);

leadSchema.index({ fullName: 'text', phone: 'text', leadId: 'text' });
leadSchema.index({ comingDate: 1, createdAt: -1 });

module.exports = mongoose.model('Lead', leadSchema);
