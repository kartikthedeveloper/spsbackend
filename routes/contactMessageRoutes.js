const express = require("express");

const router = express.Router();

const {
  createContactMessage,
  getAllContactMessages,
  getContactMessageById,
  updateContactMessage,
  deleteContactMessage,
} = require("../controllers/contactMessageController");


// CREATE
router.post("/contact", createContactMessage);

// GET ALL
router.get("/contact", getAllContactMessages);

// GET SINGLE
router.get("/contact/:id", getContactMessageById);

// UPDATE
router.put("/contact/:id", updateContactMessage);

// DELETE
router.delete("/contact/:id", deleteContactMessage);

module.exports = router;
