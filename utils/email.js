const nodemailer = require('nodemailer');

// Uses plain SMTP (e.g. a free Gmail account + App Password). This keeps
// reminders/notifications free to run instead of a paid SMS/WhatsApp Business
// API. If SMTP credentials aren't configured, we log instead of throwing so
// the rest of the app keeps working in a fresh dev setup.
let transporter = null;
const getTransporter = () => {
  if (transporter) return transporter;
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
};

const sendEmail = async ({ to, subject, html }) => {
  const t = getTransporter();
  if (!t) {
    console.log(`[email disabled - no SMTP configured] Would send to ${to}: ${subject}`);
    return { skipped: true };
  }
  return t.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
  });
};

// Builds a WhatsApp "click-to-chat" link (free, no API key needed).
// Staff can tap this to open a pre-filled WhatsApp message to the contact.
const buildWhatsAppLink = (phone, message) => {
  const digits = String(phone).replace(/[^\d]/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
};

module.exports = { sendEmail, buildWhatsAppLink };
