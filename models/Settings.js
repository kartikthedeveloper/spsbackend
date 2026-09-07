const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    instituteName: { type: String, default: 'Success Point' },
    logoUrl: { type: String, default: '' },
    primaryColor: { type: String, default: '#1E3A5F' },
    accentColor: { type: String, default: '#D9822B' },

    feeReminderDaysBefore: { type: Number, default: 7 },
    feeReminderOnDue: { type: Boolean, default: true },
    feeReminderDaysAfter: { type: Number, default: 3 },

    attendanceAlertThreshold: { type: Number, default: 75 }, // % below which alerts fire

    leadFollowUpFrequencyDays: { type: Number, default: 1 },

    requireApprovalAboveDiscountPercent: { type: Number, default: 10 },
    requireApprovalAboveExpense: { type: Number, default: 5000 },

    idCardValidityMonths: { type: Number, default: 12 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settings', settingsSchema);
