const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    admissionId: { type: String, required: true, unique: true }, // e.g. SP-2026-0001
    name: { type: String, required: true, trim: true },
    fatherName: { type: String, trim: true },
    dob: { type: Date },
    gender: { type: String, enum: ['male', 'female', 'other'], default: 'male' },
    phone: { type: String, required: true, trim: true },
    altPhone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    photoUrl: { type: String, trim: true },

    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', default: null },

    documents: [
      {
        name: String,
        url: String,
        uploadedAt: { type: Date, default: Date.now },
      },
    ],

    admissionStatus: {
      type: String,
      enum: ['enquiry', 'form_filled', 'documents_pending', 'confirmed', 'cancelled'],
      default: 'confirmed',
    },
    admissionDate: { type: Date, default: Date.now },

    // Fee snapshot fields (source of truth remains FeeStructure + Payment)
    totalFee: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    discountApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    idCardExpiry: { type: Date },
    isActive: { type: Boolean, default: true },

    leadSource: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', default: null },
  },
  { timestamps: true }
);

studentSchema.index({ name: 'text', phone: 'text', admissionId: 'text' });

module.exports = mongoose.model('Student', studentSchema);
