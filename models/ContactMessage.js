const mongoose = require("mongoose");

const contactMessageSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            trim: true,
        },

        contactNumber: {
            type: String,
            required: true,
            trim: true,
        },

        message: {
            type: String,
            trim: true,
        },

        date: {
            type: Date,
            required: true,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model(
    "ContactMessage",
    contactMessageSchema
);
