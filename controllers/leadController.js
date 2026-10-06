const Lead = require('../models/Lead');
const Student = require('../models/Student');
const { generateId } = require('../utils/idGenerator');
const { buildWhatsAppLink } = require('../utils/email');

/**
 * =========================================================
 * CREATE LEAD
 * POST /api/leads
 * =========================================================
 */
exports.createLead = async (req, res) => {
  try {
    const branch =
      req.user.role === 'admin'
        ? req.body.branch
        : req.user.branch;

    if (!branch) {
      return res.status(400).json({
        message: 'Branch is required',
      });
    }

    const leadId = await generateId(
      Lead,
      'leadId',
      'LD'
    );

    const lead = await Lead.create({
      ...req.body,
      leadId,
      branch,
      leadOwner:
        req.body.leadOwner || req.user._id,
    });

    const populatedLead = await Lead.findById(lead._id)
      .populate('assignedTo', 'name')
      .populate('leadOwner', 'name')
      .populate('interestedCourse', 'name');

    res.status(201).json({
      message: 'Lead created successfully',
      lead: populatedLead,
    });
  } catch (err) {
    console.error('Create Lead Error:', err);

    res.status(400).json({
      message: 'Could not create lead',
      error: err.message,
    });
  }
};


/**
 * =========================================================
 * LIST ALL LEADS
 * GET /api/leads
 * =========================================================
 */
exports.listLeads = async (req, res) => {
  try {
    const filter = {};

    if (req.user.role !== 'admin') {
      filter.branch = req.user.branch;
    } else if (req.query.branch) {
      filter.branch = req.query.branch;
    }

    if (req.query.stage) filter.stage = req.query.stage;
    if (req.query.priority) filter.priority = req.query.priority;
    if (req.query.assignedTo) filter.assignedTo = req.query.assignedTo;
    if (req.query.source) filter.source = req.query.source;

    if (req.query.search) {
      filter.$text = { $search: req.query.search };
    }

    const leads = await Lead.find(filter)
      .populate('assignedTo', 'name email')
      .populate('leadOwner', 'name email')
      .populate('interestedCourse', 'name')
      .populate('branch', 'name')
      // ✅ Sort: comingDate asc (nulls last), then createdAt desc
      .sort({ comingDate: 1, createdAt: -1 });

    res.json({ count: leads.length, leads });
  } catch (err) {
    console.error('List Leads Error:', err);
    res.status(500).json({
      message: 'Could not fetch leads',
      error: err.message,
    });
  }
};

/**
 * =========================================================
 * GET SINGLE LEAD
 * GET /api/leads/:id
 * =========================================================
 */
exports.getLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate('assignedTo', 'name email')
      .populate('leadOwner', 'name email')
      .populate('interestedCourse', 'name')
      .populate('branch', 'name')
      .populate('convertedStudent', 'name admissionId')
      .populate('notes.addedBy', 'name')
      .populate('remarks.addedBy', 'name');

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    const defaultMessage = `Hi ${lead.fullName}, this is Success Point regarding your enquiry about ${lead.interestedCourse?.name || 'our courses'
      }.`;

    const whatsappMessage =
      lead.customMessage?.trim() || defaultMessage;

    const whatsappLink = buildWhatsAppLink(lead.phone, whatsappMessage);

    res.json({
      lead,
      whatsappLink,
      whatsappMessage,
    });
  } catch (err) {
    console.error('Get Lead Error:', err);
    res.status(500).json({
      message: 'Could not fetch lead',
      error: err.message,
    });
  }
};

/**
 * =========================================================
 * ADD REMARK (date-wise history)
 * POST /api/leads/:id/remarks
 * =========================================================
 */
exports.addRemark = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    if (!req.body.text?.trim()) {
      return res.status(400).json({ message: 'Remark text is required' });
    }

    lead.remarks.push({
      text: req.body.text.trim(),
      addedBy: req.user._id,
      addedAt: new Date(),
    });

    // Optional: comingDate update if provided
    if (req.body.comingDate !== undefined) {
      lead.comingDate = req.body.comingDate || null;
    }

    lead.lastContactedAt = new Date();

    await lead.save();

    const updatedLead = await Lead.findById(lead._id)
      .populate('remarks.addedBy', 'name')
      .populate('notes.addedBy', 'name')
      .populate('interestedCourse', 'name')
      .populate('assignedTo', 'name')
      .populate('leadOwner', 'name');

    res.json({
      message: 'Remark added successfully',
      lead: updatedLead,
    });
  } catch (err) {
    console.error('Add Remark Error:', err);
    res.status(400).json({
      message: 'Could not add remark',
      error: err.message,
    });
  }
};


/**
 * =========================================================
 * UPDATE COMING DATE
 * PATCH /api/leads/:id/coming-date
 * =========================================================
 */
exports.updateComingDate = async (req, res) => {
  try {
    const { comingDate } = req.body;

    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      { comingDate: comingDate || null },
      { new: true, runValidators: true }
    )
      .populate('assignedTo', 'name email')
      .populate('leadOwner', 'name email')
      .populate('interestedCourse', 'name')
      .populate('remarks.addedBy', 'name');

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    res.json({
      message: 'Coming date updated successfully',
      lead,
    });
  } catch (err) {
    console.error('Update Coming Date Error:', err);
    res.status(400).json({
      message: 'Could not update coming date',
      error: err.message,
    });
  }
};
/**
 * =========================================================
 * UPDATE LEAD
 * PATCH /api/leads/:id
 * =========================================================
 */
exports.updateLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({
        message: 'Lead not found',
      });
    }

    /**
     * Prevent changing protected fields
     */
    const protectedFields = [
      'leadId',
      'branch',
      'convertedStudent',
      'convertedAt',
      'remarks',       // ✅ remarks sirf addRemark endpoint se add honge
    ];

    protectedFields.forEach((field) => {
      delete req.body[field];
    });

    /**
     * Stage related timestamps
     */
    if (
      req.body.stage &&
      req.body.stage !== lead.stage
    ) {
      if (req.body.stage === 'contacted') {
        lead.lastContactedAt = new Date();
      }

      if (req.body.stage === 'converted') {
        lead.convertedAt = new Date();
      }
    }

    /**
     * Update fields
     */
    Object.assign(lead, req.body);

    await lead.save();

    const updatedLead = await Lead.findById(lead._id)
      .populate('assignedTo', 'name email')
      .populate('leadOwner', 'name email')
      .populate('interestedCourse', 'name')
      .populate('branch', 'name')
      .populate('convertedStudent', 'name admissionId')
      .populate('notes.addedBy', 'name');

    /**
     * WhatsApp link
     */
    const defaultMessage = `Hi ${updatedLead.fullName}, this is Success Point regarding your enquiry about ${updatedLead.interestedCourse?.name ||
      'our courses'
      }.`;

    const whatsappMessage =
      updatedLead.customMessage?.trim() ||
      defaultMessage;

    const whatsappLink = buildWhatsAppLink(
      updatedLead.phone,
      whatsappMessage
    );

    res.json({
      message: 'Lead updated successfully',
      lead: updatedLead,
      whatsappLink,
      whatsappMessage,
    });
  } catch (err) {
    console.error('Update Lead Error:', err);

    res.status(400).json({
      message: 'Could not update lead',
      error: err.message,
    });
  }
};


/**
 * =========================================================
 * DELETE LEAD
 * DELETE /api/leads/:id
 * =========================================================
 */
exports.deleteLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({
        message: 'Lead not found',
      });
    }

    /**
     * Optional safety:
     * Converted leads should not be deleted accidentally.
     */
    if (
      lead.stage === 'converted' &&
      lead.convertedStudent
    ) {
      return res.status(400).json({
        message:
          'Converted lead cannot be deleted because it is linked with a student.',
      });
    }

    await Lead.findByIdAndDelete(req.params.id);

    res.json({
      message: 'Lead deleted successfully',
      leadId: lead._id,
    });
  } catch (err) {
    console.error('Delete Lead Error:', err);

    res.status(500).json({
      message: 'Could not delete lead',
      error: err.message,
    });
  }
};


/**
 * =========================================================
 * PIPELINE / KANBAN
 * GET /api/leads/pipeline
 * =========================================================
 */
exports.pipeline = async (req, res) => {
  try {
    const filter = {};

    if (req.user.role !== 'admin') {
      filter.branch = req.user.branch;
    } else if (req.query.branch) {
      filter.branch = req.query.branch;
    }

    const leads = await Lead.find(filter)
      .populate('assignedTo', 'name')
      .populate('leadOwner', 'name')
      .populate('interestedCourse', 'name')
      .populate('branch', 'name')
      .sort({ createdAt: -1 });

    const stages = [
      'new',
      'contacted',
      'demo_scheduled',
      'follow_up',
      'converted',
      'lost',
    ];

    const board = Object.fromEntries(
      stages.map((stage) => [stage, []])
    );

    leads.forEach((lead) => {
      if (board[lead.stage]) {
        board[lead.stage].push(lead);
      }
    });

    res.json({
      board,
    });
  } catch (err) {
    console.error('Pipeline Error:', err);

    res.status(500).json({
      message: 'Could not load lead pipeline',
      error: err.message,
    });
  }
};


/**
 * =========================================================
 * ADD NOTE
 * POST /api/leads/:id/notes
 * =========================================================
 */
exports.addNote = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({
        message: 'Lead not found',
      });
    }

    if (!req.body.text?.trim()) {
      return res.status(400).json({
        message: 'Note text is required',
      });
    }

    lead.notes.push({
      text: req.body.text.trim(),
      addedBy: req.user._id,
    });

    lead.lastContactedAt = new Date();

    await lead.save();

    const updatedLead = await Lead.findById(lead._id)
      .populate('assignedTo', 'name')
      .populate('leadOwner', 'name')
      .populate('interestedCourse', 'name')
      .populate('notes.addedBy', 'name');

    res.json({
      message: 'Note added successfully',
      lead: updatedLead,
    });
  } catch (err) {
    console.error('Add Note Error:', err);

    res.status(400).json({
      message: 'Could not add note',
      error: err.message,
    });
  }
};


/**
 * =========================================================
 * REASSIGN LEAD
 * PATCH /api/leads/:id/reassign
 * =========================================================
 */
exports.reassignLead = async (req, res) => {
  try {
    const { assignedTo } = req.body;

    if (!assignedTo) {
      return res.status(400).json({
        message: 'assignedTo is required',
      });
    }

    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      {
        assignedTo,
      },
      {
        new: true,
        runValidators: true,
      }
    )
      .populate('assignedTo', 'name email')
      .populate('leadOwner', 'name email');

    if (!lead) {
      return res.status(404).json({
        message: 'Lead not found',
      });
    }

    res.json({
      message: 'Lead reassigned successfully',
      lead,
    });
  } catch (err) {
    console.error('Reassign Lead Error:', err);

    res.status(400).json({
      message: 'Could not reassign lead',
      error: err.message,
    });
  }
};


/**
 * =========================================================
 * CONVERT LEAD TO STUDENT
 * POST /api/leads/:id/convert
 * =========================================================
 */
exports.convertLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({
        message: 'Lead not found',
      });
    }

    /**
     * Prevent duplicate conversion
     */
    if (
      lead.stage === 'converted' &&
      lead.convertedStudent
    ) {
      return res.status(400).json({
        message: 'This lead has already been converted',
        convertedStudent: lead.convertedStudent,
      });
    }

    /**
     * Course can come from request
     * otherwise use lead's interested course
     */
    const course =
      req.body.course ||
      lead.interestedCourse;

    if (!course) {
      return res.status(400).json({
        message:
          'Course is required before converting lead',
      });
    }

    const admissionId = await generateId(
      Student,
      'admissionId',
      'SP'
    );

    const student = await Student.create({
      admissionId,
      name: lead.fullName,
      phone: lead.phone,
      altPhone: lead.altPhone,
      email: lead.email,
      branch: lead.branch,
      course,
      batch: req.body.batch || null,
      totalFee: req.body.totalFee || 0,
      leadSource: lead._id,
    });

    /**
     * Update Lead
     */
    lead.stage = 'converted';
    lead.convertedAt = new Date();
    lead.convertedStudent = student._id;

    await lead.save();

    const updatedLead = await Lead.findById(
      lead._id
    )
      .populate('interestedCourse', 'name')
      .populate(
        'convertedStudent',
        'name admissionId'
      );

    res.status(201).json({
      message: 'Lead converted successfully',
      student,
      lead: updatedLead,
    });
  } catch (err) {
    console.error('Convert Lead Error:', err);

    res.status(400).json({
      message: 'Could not convert lead',
      error: err.message,
    });
  }
};


/**
 * =========================================================
 * FOLLOW UPS DUE
 * GET /api/leads/follow-ups/due
 * =========================================================
 */
exports.followUpsDue = async (req, res) => {
  try {
    const filter = {
      followUpAt: {
        $lte: new Date(),
      },
      stage: {
        $nin: ['converted', 'lost'],
      },
    };

    if (req.user.role !== 'admin') {
      filter.branch = req.user.branch;
    } else if (req.query.branch) {
      filter.branch = req.query.branch;
    }

    const leads = await Lead.find(filter)
      .populate('assignedTo', 'name email')
      .populate('leadOwner', 'name email')
      .populate('interestedCourse', 'name')
      .sort({
        followUpAt: 1,
      });

    res.json({
      count: leads.length,
      leads,
    });
  } catch (err) {
    console.error('Follow Ups Error:', err);

    res.status(500).json({
      message: 'Could not load follow-ups',
      error: err.message,
    });
  }
};
