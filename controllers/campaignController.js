const Campaign = require('../models/Campaign');
const Lead = require('../models/Lead');
const Student = require('../models/Student');
const { sendEmail, buildWhatsAppLink } = require('../utils/email');

exports.sendCampaign = async (req, res) => {
  try {
    const { title, message, channel, audience, branch } = req.body;
    const branchFilter = req.user.role === 'admin' ? (branch ? { branch } : {}) : { branch: req.user.branch };

    let recipients = [];
    if (audience === 'leads' || audience === 'both') {
      const leads = await Lead.find({ ...branchFilter, stage: { $nin: ['lost'] } });
      recipients = recipients.concat(leads.map((l) => ({ name: l.fullName, email: l.email, phone: l.phone })));
    }
    if (audience === 'students' || audience === 'both') {
      const students = await Student.find({ ...branchFilter, isActive: true });
      recipients = recipients.concat(students.map((s) => ({ name: s.name, email: s.email, phone: s.phone })));
    }

    let sentCount = 0;
    let whatsappLinks = [];

    if (channel === 'email') {
      for (const r of recipients) {
        if (!r.email) continue;
        await sendEmail({ to: r.email, subject: title, html: `<p>Dear ${r.name},</p><p>${message}</p>` });
        sentCount += 1;
      }
    } else {
      // whatsapp_manual: generate click-to-chat links for staff to send by hand (free, no API)
      whatsappLinks = recipients
        .filter((r) => r.phone)
        .map((r) => ({ name: r.name, phone: r.phone, link: buildWhatsAppLink(r.phone, message) }));
      sentCount = whatsappLinks.length;
    }

    const campaign = await Campaign.create({
      title,
      message,
      channel,
      audience,
      branch: branch || null,
      sentBy: req.user._id,
      recipientCount: sentCount,
    });

    res.status(201).json({ campaign, whatsappLinks });
  } catch (err) {
    res.status(400).json({ message: 'Could not send campaign', error: err.message });
  }
};

exports.listCampaigns = async (req, res) => {
  const filter = req.user.role !== 'admin' ? { branch: req.user.branch } : {};
  const campaigns = await Campaign.find(filter).populate('sentBy', 'name').sort({ sentAt: -1 });
  res.json({ campaigns });
};
