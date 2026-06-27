import React, { useEffect, useState } from 'react';
import { Calculator } from 'lucide-react';
import { Modal, Button, Input, Select, Alert } from '../../ui';

function CogsProfileModal({ isOpen, onClose, onSave, profile, properties, existingPropertyIds }) {
  const isEdit = !!profile?.id;
  const [propertyId, setPropertyId] = useState('');
  const [fixedStayCost, setFixedStayCost] = useState('');
  const [costPerNight, setCostPerNight] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setPropertyId(profile?.propertyId || '');
    setFixedStayCost(profile?.fixedStayCost != null ? String(profile.fixedStayCost) : '');
    setCostPerNight(profile?.costPerNight != null ? String(profile.costPerNight) : '');
    setError('');
  }, [isOpen, profile]);

  const availableProperties = (properties || []).filter((v) => {
    if (isEdit && v.id === profile?.propertyId) return true;
    return !(existingPropertyIds || []).includes(v.id);
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isEdit && !propertyId) {
      setError('Please select a property.');
      return;
    }

    setSubmitting(true);
    try {
      await onSave({
        propertyId: isEdit ? profile.propertyId : propertyId,
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
        subtitle="Set operational costs per property stay"
        icon={Calculator}
        onClose={onClose}
      />
      <form onSubmit={handleSubmit}>
        <Modal.Body>
          {error && <Alert variant="error">{error}</Alert>}

          {!isEdit && (
            <div className="form-field">
              <Select
                label="Property"
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                options={availableProperties.map((v) => ({ value: v.id, label: v.name }))}
                placeholder="Select property…"
                required
              />
            </div>
          )}

          {isEdit && (
            <div className="form-field">
              <label className="form-label">Property</label>
              <Input value={profile?.propertyName || '—'} disabled />
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
