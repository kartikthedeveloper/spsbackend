const Expense = require('../models/Expense');
const Budget = require('../models/Budget');

exports.createExpense = async (req, res) => {
  try {
    const branch = req.user.role === 'admin' ? req.body.branch : req.user.branch;
    const expense = await Expense.create({ ...req.body, branch, recordedBy: req.user._id });

    // Check against monthly budget for this category, if one is configured
    const budget = await Budget.findOne({ branch, category: expense.category });
    let budgetWarning = null;
    if (budget) {
      const start = new Date(expense.date);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      const spent = await Expense.aggregate([
        { $match: { branch: expense.branch, category: expense.category, date: { $gte: start, $lt: end } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]);
      const totalSpent = spent[0]?.total || 0;
      if (totalSpent > budget.monthlyLimit) {
        budgetWarning = `Category "${expense.category}" has exceeded its monthly budget of ₹${budget.monthlyLimit} (spent ₹${totalSpent}).`;
      }
    }

    res.status(201).json({ expense, budgetWarning });
  } catch (err) {
    res.status(400).json({ message: 'Could not record expense', error: err.message });
  }
};

exports.listExpenses = async (req, res) => {
  const filter = {};
  if (req.user.role !== 'admin') filter.branch = req.user.branch;
  else if (req.query.branch) filter.branch = req.query.branch;
  if (req.query.category) filter.category = req.query.category;
  if (req.query.from || req.query.to) {
    filter.date = {};
    if (req.query.from) filter.date.$gte = new Date(req.query.from);
    if (req.query.to) filter.date.$lte = new Date(req.query.to);
  }
  const expenses = await Expense.find(filter).populate('recordedBy', 'name').sort({ date: -1 });
  res.json({ expenses });
};

exports.updateExpense = async (req, res) => {
  const expense = await Expense.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!expense) return res.status(404).json({ message: 'Expense not found' });
  res.json({ expense });
};

exports.deleteExpense = async (req, res) => {
  await Expense.findByIdAndDelete(req.params.id);
  res.json({ message: 'Expense deleted' });
};

// ---- Budgets ----
exports.setBudget = async (req, res) => {
  const branch = req.user.role === 'admin' ? req.body.branch : req.user.branch;
  const budget = await Budget.findOneAndUpdate(
    { branch, category: req.body.category },
    { monthlyLimit: req.body.monthlyLimit },
    { new: true, upsert: true }
  );
  res.json({ budget });
};

exports.listBudgets = async (req, res) => {
  const filter = {};
  if (req.user.role !== 'admin') filter.branch = req.user.branch;
  else if (req.query.branch) filter.branch = req.query.branch;
  const budgets = await Budget.find(filter);
  res.json({ budgets });
};
