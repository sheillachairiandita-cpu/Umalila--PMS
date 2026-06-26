import React, { useEffect, useState } from 'react';
import { Calculator } from 'lucide-react';
import { Modal, Button, Input, Select, Alert } from '../../ui';

function CogsProfileModal({ isOpen, onClose, onSave, profile, villas, existingVillaIds }) {
  const isEdit = !!profile?.id;
  const [villaId, setVillaId] = useState('');
  const [fixedStayCost, setFixedStayCost] = useState('');
  const [costPerNight, setCostPerNight] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setVillaId(profile?.villaId || '');
    setFixedStayCost(profile?.fixedStayCost != null ? String(profile.fixedStayCost) : '');
    setCostPerNight(profile?.costPerNight != null ? String(profile.costPerNight) : '');
    setError('');
  }, [isOpen, profile]);

  const availableVillas = (villas || []).filter((v) => {
    if (isEdit && v.id === profile?.villaId) return true;
    return !(existingVillaIds || []).includes(v.id);
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isEdit && !villaId) {
      setError('Please select a villa.');
      return;
    }

    setSubmitting(true);
    try {
      await onSave({
        villaId: isEdit ? profile.villaId : villaId,
        fixedStayCost: Number(fixedStayCost) || 0,
        costPerNight: Number(costPerNight) || 0,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save cost profile.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <Modal.Header
        title={isEdit ? 'Edit Cost Profile' : 'Create Cost Profile'}
        subtitle="Set operational costs per villa stay"
        icon={Calculator}
        onClose={onClose}
      />
      <form onSubmit={handleSubmit}>
        <Modal.Body>
          {error && <Alert variant="error">{error}</Alert>}

          {!isEdit && (
            <div className="form-field">
              <Select
                label="Villa"
                value={villaId}
                onChange={(e) => setVillaId(e.target.value)}
                options={availableVillas.map((v) => ({ value: v.id, label: v.name }))}
                placeholder="Select villa…"
                required
              />
            </div>
          )}

          {isEdit && (
            <div className="form-field">
              <label className="form-label">Villa</label>
              <Input value={profile?.villaName || '—'} disabled />
            </div>
          )}

          <div className="form-field">
            <label className="form-label">Fixed Stay Cost (Rp)</label>
            <Input
              type="number"
              min="0"
              step="1000"
              value={fixedStayCost}
              onChange={(e) => setFixedStayCost(e.target.value)}
              placeholder="e.g. 150000"
            />
            <p className="pricing-form-hint">One-time cost per reservation (laundry, deep cleaning, amenities)</p>
          </div>

          <div className="form-field">
            <label className="form-label">Cost Per Night (Rp)</label>
            <Input
              type="number"
              min="0"
              step="1000"
              value={costPerNight}
              onChange={(e) => setCostPerNight(e.target.value)}
              placeholder="e.g. 50000"
            />
            <p className="pricing-form-hint">Variable cost per occupied night (utilities, consumables, breakfast)</p>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Profile'}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}

export default CogsProfileModal;
