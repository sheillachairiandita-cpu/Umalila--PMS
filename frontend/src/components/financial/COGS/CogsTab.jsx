import React from 'react';
import { Calculator } from 'lucide-react';
import CogsProfilesTable from './CogsProfilesTable';

function CogsTab({
  profiles,
  villas,
  loading,
  onCreate,
  onEdit,
  onDelete,
}) {
  return (
    <div className="section-card">
      <div className="section-card__header">
        <Calculator size={15} color="var(--navy)" />
        <h3 className="section-card__title">Villa Cost Profiles</h3>
        <span className="section-card__count">{profiles.length} profiles</span>
      </div>
      <div className="section-card__body">
        <p className="cogs-tab__intro">
          COGS is calculated automatically from each villa&apos;s cost profile — no manual entry per reservation.
          Formula: Fixed Stay Cost + (Cost Per Night × Nights).
        </p>
        <CogsProfilesTable
          profiles={profiles}
          villas={villas}
          loading={loading}
          onCreate={onCreate}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}

export default CogsTab;
