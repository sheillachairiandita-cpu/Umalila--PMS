import React, { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import { Modal, Button, Input, Select, Alert } from '../ui';
import { EXPENSE_CATEGORY_OPTIONS } from '../../utils/statusConfigs';

function EditExpenseModal({ expense, onClose, onSave }) {
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!expense) return;
    setCategory(expense.category || '');
    setDescription(expense.description || '');
    setAmount(String(expense.amount ?? ''));
    setExpenseDate(expense.transactionDate || '');
    setError('');
  }, [expense]);

  if (!expense) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!category || !amount || !expenseDate) {
      setError('Category, amount, and expense date are required.');
      return;
    }

    setSaving(true);
    try {
      await onSave(expense.id, {
        category,
        description,
        amount: Number(amount),
        transactionDate: expenseDate,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update expense.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={!!expense} onClose={onClose} size="md">
      <Modal.Header title={`Edit Expense — ${expense.displayId || ''}`} icon={Pencil} />
      <Modal.Body>
        <form id="edit-expense-form" className="expense-edit-form" onSubmit={handleSubmit}>
          {error && <Alert type="error" message={error} />}

          <Select
            label="Category"
            required
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={EXPENSE_CATEGORY_OPTIONS}
          />

          <Input
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <Input
            label="Amount"
            type="number"
            required
            min="0"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          <Input
            label="Expense Date"
            type="date"
            required
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
          />
        </form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="primary" type="submit" form="edit-expense-form" loading={saving}>
          Save Changes
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default EditExpenseModal;
