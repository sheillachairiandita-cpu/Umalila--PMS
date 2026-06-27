import React from 'react';
import { Calculator } from 'lucide-react';
import CogsProfilesTable from './CogsProfilesTable';
import SectionHeaderRow from '../../ui/SectionHeaderRow';

function CogsTab({
  profiles,
  properties,
  loading,
  onCreate,
  onEdit,
  onDelete,
}) {
  return (
    <div className="section-card">
      <div className="section-card__header">
        <SectionHeaderRow
          icon={Calculator}
          title="Property Cost Profiles"
          count={`${profiles.length} profiles`}
        />
      </div>
      <div className="section-card__body">
        <p className="cogs-tab__intro">
          COGS is calculated automatically from each property&apos;s cost profile — no manual entry per reservation.
          Formula: Fixed Stay Cost + (Cost Per Night × Nights).
        </p>
        <CogsProfilesTable
          profiles={profiles}
          properties={properties}
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
