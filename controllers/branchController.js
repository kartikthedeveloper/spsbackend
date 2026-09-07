const Branch = require('../models/Branch');

exports.createBranch = async (req, res) => {
  try {
    const branch = await Branch.create(req.body);
    res.status(201).json({ branch });
  } catch (err) {
    res.status(400).json({ message: 'Could not create branch', error: err.message });
  }
};

exports.listBranches = async (req, res) => {
  const filter = req.user.role === 'admin' ? {} : { _id: req.user.branch };
  const branches = await Branch.find(filter).populate('manager', 'name email');
  res.json({ branches });
};

exports.getBranch = async (req, res) => {
  const branch = await Branch.findById(req.params.id).populate('manager', 'name email');
  if (!branch) return res.status(404).json({ message: 'Branch not found' });
  res.json({ branch });
};

exports.updateBranch = async (req, res) => {
  const branch = await Branch.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!branch) return res.status(404).json({ message: 'Branch not found' });
  res.json({ branch });
};

exports.deleteBranch = async (req, res) => {
  await Branch.findByIdAndUpdate(req.params.id, { isActive: false });
  res.json({ message: 'Branch deactivated' });
};
