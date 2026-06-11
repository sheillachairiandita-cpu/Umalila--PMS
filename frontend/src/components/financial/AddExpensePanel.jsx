import React, { useState } from 'react';
import { X, Receipt } from 'lucide-react';
import { Button, Input, Select, FileUpload, Alert } from '../ui';
import { EXPENSE_CATEGORY_OPTIONS } from '../../utils/statusConfigs';

function AddExpensePanel({ isOpen, onClose, onSubmit }) {
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [proof, setProof] = useState(null);
  const [proofError, setProofError] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setCategory('');
    setDescription('');
    setAmount('');
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setProof(null);
    setProofError('');
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleProofChange = (file, err) => {
    setProof(file);
    setProofError(err || '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!category || !amount || !expenseDate) {
      setError('Category, amount, and expense date are required.');
      return;
    }

    if (Number(amount) <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        category,
        description,
        amount: Number(amount),
        transactionDate: expenseDate,
        proof,
      });
      resetForm();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to submit expense.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="slide-over-overlay" onClick={handleClose} aria-hidden="true" />
      <aside className="slide-over-panel" role="dialog" aria-labelledby="add-expense-title">
        <div className="slide-over-panel__header">
          <div className="slide-over-panel__title-wrap">
            <Receipt size={18} />
            <h2 id="add-expense-title" className="slide-over-panel__title">Add New Expense</h2>
          </div>
          <button type="button" className="icon-btn-ghost" onClick={handleClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form className="slide-over-panel__body" onSubmit={handleSubmit}>
          {error && <Alert type="error" message={error} />}

          <Select
            label="Category"
            required
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={EXPENSE_CATEGORY_OPTIONS}
            placeholder="Select category…"
          />

          <Input
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What was this expense for?"
          />

          <Input
            label="Amount"
            type="number"
            required
            min="0"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
          />

          <Input
            label="Expense Date"
            type="date"
            required
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            helpText="When the money was actually transferred."
          />

          <FileUpload
            label="Proof of Payment"
            value={proof}
            onChange={handleProofChange}
            error={proofError}
            accept="image/*,.pdf"
          />

          <div className="slide-over-panel__footer">
            <Button variant="secondary" type="button" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              Submit Expense
            </Button>
          </div>
        </form>
      </aside>
    </>
  );
}

export default AddExpensePanel;
