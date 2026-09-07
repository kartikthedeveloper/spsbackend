const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/expenseController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/', ctrl.listExpenses);
router.post('/', authorize('admin', 'branch_manager', 'staff'), ctrl.createExpense);
router.patch('/:id', authorize('admin', 'branch_manager'), ctrl.updateExpense);
router.delete('/:id', authorize('admin', 'branch_manager'), ctrl.deleteExpense);

router.get('/budgets/all', ctrl.listBudgets);
router.post('/budgets', authorize('admin', 'branch_manager'), ctrl.setBudget);

module.exports = router;
