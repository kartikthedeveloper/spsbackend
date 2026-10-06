const ContactMessage = require("../models/ContactMessage");

// ==========================================
// CREATE CONTACT MESSAGE
// ==========================================

exports.createContactMessage = async (req, res) => {
  try {
    const { name, contactNumber, message, date } = req.body;

    if (!name || !contactNumber || !message) {
      return res.status(400).json({
        success: false,
        message: "Name, contact number and message are required",
      });
    }

    const newContact = await ContactMessage.create({
      name,
      contactNumber,
      message,
      date: date || new Date(),
    });

    res.status(201).json({
      success: true,
      message: "Contact message created successfully",
      data: newContact,
    });
  } catch (error) {
    console.error("Create Contact Error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// ==========================================
// GET ALL CONTACT MESSAGES
// ==========================================

exports.getAllContactMessages = async (req, res) => {
  try {
    const contacts = await ContactMessage.find()
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: contacts.length,
      data: contacts,
    });
  } catch (error) {
    console.error("Get Contacts Error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// ==========================================
// GET SINGLE CONTACT MESSAGE
// ==========================================

exports.getContactMessageById = async (req, res) => {
  try {
    const contact = await ContactMessage.findById(req.params.id);

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact message not found",
      });
    }

    res.status(200).json({
      success: true,
      data: contact,
    });
  } catch (error) {
    console.error("Get Single Contact Error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// ==========================================
// UPDATE CONTACT MESSAGE
// ==========================================

exports.updateContactMessage = async (req, res) => {
  try {
    const { name, contactNumber, message, date } = req.body;

    const updatedContact = await ContactMessage.findByIdAndUpdate(
      req.params.id,
      {
        name,
        contactNumber,
        message,
        date,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedContact) {
      return res.status(404).json({
        success: false,
        message: "Contact message not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Contact message updated successfully",
      data: updatedContact,
    });
  } catch (error) {
    console.error("Update Contact Error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// ==========================================
// DELETE CONTACT MESSAGE
// ==========================================

exports.deleteContactMessage = async (req, res) => {
  try {
    const deletedContact =
      await ContactMessage.findByIdAndDelete(req.params.id);

    if (!deletedContact) {
      return res.status(404).json({
        success: false,
        message: "Contact message not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Contact message deleted successfully",
    });
  } catch (error) {
    console.error("Delete Contact Error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
