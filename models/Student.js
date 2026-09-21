const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    admissionId: {
      type: String,
      required: true,
      unique: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    fatherName: {
      type: String,
      trim: true,
    },  

    dob: {
      type: Date,
    },

    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      default: 'male',
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    altPhone: {
      type: String,
      trim: true,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
    },

    address: {
      type: String,
      trim: true,
    },

    photoUrl: {
      type: String,
      trim: true,
    },

    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
    },

    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },

    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      default: null,
    },

    // Selected Fee Structure
    feeStructure: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FeeStructure',
      default: null,
    },

    documents: [
      {
        name: String,
        url: String,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    admissionStatus: {
      type: String,
      enum: [
        'enquiry',
        'form_filled',
        'documents_pending',
        'confirmed',
        'cancelled',
      ],
      default: 'confirmed',
    },

    admissionDate: {
      type: Date,
      default: Date.now,
    },

    // -----------------------------------
    // FEE SNAPSHOT
    // -----------------------------------

    // Original fee charged to student
    totalFee: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Discount percentage
    discountPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    // Discount amount in rupees
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },

    discountApprovedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // Fee payable by student after discount
    netFee: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Amount from student's fee that belongs to university
    universityFee: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Net institute earning/expected share
    instituteFee: {
      type: Number,
      default: 0,
      min: 0,
    },

    idCardExpiry: {
      type: Date,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    leadSource: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

studentSchema.index({
  name: 'text',
  phone: 'text',
  admissionId: 'text',
});

module.exports = mongoose.model('Student', studentSchema);
