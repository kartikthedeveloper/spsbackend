const mongoose = require('mongoose');

// NOTE: There is no free bulk-WhatsApp API (WhatsApp Business API / Twilio /
// Gupshup all charge per message). To keep this 100% free, campaigns are
// delivered by email (free via SMTP) and by generating "click-to-chat"
// wa.me links that staff can tap through manually for WhatsApp outreach,
// instead of an automated paid WhatsApp Business API integration.
const campaignSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    channel: { type: String, enum: ['email', 'whatsapp_manual'], default: 'email' },
    audience: { type: String, enum: ['leads', 'students', 'both'], default: 'both' },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null }, // null = all branches
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipientCount: { type: Number, default: 0 },
    sentAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Campaign', campaignSchema);
