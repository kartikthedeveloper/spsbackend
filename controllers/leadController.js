const Lead = require('../models/Lead');
const Student = require('../models/Student');
const { generateId } = require('../utils/idGenerator');
const { buildWhatsAppLink } = require('../utils/email');

exports.createLead = async (req, res) => {
  try {
    const branch = req.user.role === 'admin' ? req.body.branch : req.user.branch;
    const leadId = await generateId(Lead, 'leadId', 'LD');
    const lead = await Lead.create({
      ...req.body,
      branch,
      leadId,
      leadOwner: req.body.leadOwner || req.user._id,
    });
    res.status(201).json({ lead });
  } catch (err) {
    res.status(400).json({ message: 'Could not create lead', error: err.message });
  }
};

exports.listLeads = async (req, res) => {
  const filter = {};
  if (req.user.role !== 'admin') filter.branch = req.user.branch;
  else if (req.query.branch) filter.branch = req.query.branch;
  if (req.query.stage) filter.stage = req.query.stage;
  if (req.query.priority) filter.priority = req.query.priority;
  if (req.query.assignedTo) filter.assignedTo = req.query.assignedTo;
  if (req.query.search) filter.$text = { $search: req.query.search };

  const leads = await Lead.find(filter)
    .populate('assignedTo', 'name')
    .populate('interestedCourse', 'name')
    .sort({ createdAt: -1 });
  res.json({ leads });
};

// Kanban board: leads grouped by stage
exports.pipeline = async (req, res) => {
  const filter = {};
  if (req.user.role !== 'admin') filter.branch = req.user.branch;
  else if (req.query.branch) filter.branch = req.query.branch;

  const leads = await Lead.find(filter).populate('assignedTo', 'name').populate('interestedCourse', 'name');
  const stages = ['new', 'contacted', 'demo_scheduled', 'follow_up', 'converted', 'lost'];
  const board = Object.fromEntries(stages.map((s) => [s, []]));
  leads.forEach((l) => board[l.stage]?.push(l));
  res.json({ board });
};

exports.getLead = async (req, res) => {
  const lead = await Lead.findById(req.params.id)
    .populate('assignedTo', 'name')
    .populate('leadOwner', 'name')
    .populate('interestedCourse', 'name')
    .populate('notes.addedBy', 'name');
  if (!lead) return res.status(404).json({ message: 'Lead not found' });
  const whatsappLink = buildWhatsAppLink(
    lead.phone,
    `Hi ${lead.fullName}, this is Success Point regarding your enquiry about ${
      lead.interestedCourse?.name || 'our courses'
    }.`
  );
  res.json({ lead, whatsappLink });
};

exports.updateLead = async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) return res.status(404).json({ message: 'Lead not found' });
  Object.assign(lead, req.body);
  if (req.body.stage === 'contacted') lead.lastContactedAt = new Date();
  await lead.save();
  res.json({ lead });
};

exports.addNote = async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) return res.status(404).json({ message: 'Lead not found' });
  lead.notes.push({ text: req.body.text, addedBy: req.user._id });
  lead.lastContactedAt = new Date();
  await lead.save();
  res.json({ lead });
};

exports.reassignLead = async (req, res) => {
  const lead = await Lead.findByIdAndUpdate(
    req.params.id,
    { assignedTo: req.body.assignedTo },
    { new: true }
  );
  if (!lead) return res.status(404).json({ message: 'Lead not found' });
  res.json({ lead });
};

// Convert a lead directly into a student admission record (one click)
exports.convertLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    const { generateId: genId } = require('../utils/idGenerator');
    const admissionId = await genId(Student, 'admissionId', 'SP');

    const student = await Student.create({
      admissionId,
      name: lead.fullName,
      phone: lead.phone,
      altPhone: lead.altPhone,
      email: lead.email,
      branch: lead.branch,
      course: req.body.course || lead.interestedCourse,
      batch: req.body.batch || null,
      totalFee: req.body.totalFee || 0,
      leadSource: lead._id,
    });

    lead.stage = 'converted';
    lead.convertedAt = new Date();
    lead.convertedStudent = student._id;
    await lead.save();

    res.status(201).json({ student, lead });
  } catch (err) {
    res.status(400).json({ message: 'Could not convert lead', error: err.message });
  }
};

exports.followUpsDue = async (req, res) => {
  const filter = { followUpAt: { $lte: new Date() }, stage: { $nin: ['converted', 'lost'] } };
  if (req.user.role !== 'admin') filter.branch = req.user.branch;
  const leads = await Lead.find(filter).populate('assignedTo', 'name').sort({ followUpAt: 1 });
  res.json({ leads });
};
