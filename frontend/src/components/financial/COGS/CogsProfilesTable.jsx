import React, { useMemo, useState } from 'react';
import { Edit, Filter, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../ui';
import TableActionButton from '../../TableActionButton';
import TablePagination from '../../ui/TablePagination';
import { formatRp } from '../../../utils/formatCurrency';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function CogsProfilesTable({
  profiles,
  properties,
  loading,
  onCreate,
  onEdit,
  onDelete,
}) {
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filtered = useMemo(() => {
    let data = [...profiles];

    if (propertyFilter !== 'all') {
      data = data.filter((p) => p.propertyId === propertyFilter);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      data = data.filter((p) => (p.propertyName || '').toLowerCase().includes(q));
    }

    return data.sort((a, b) => (a.propertyName || '').localeCompare(b.propertyName || ''));
  }, [profiles, propertyFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const startIdx = (currentPage - 1) * itemsPerPage;
  const paginated = filtered.slice(startIdx, startIdx + itemsPerPage);

  return (
    <div>
      <div className="filter-bar filter-bar--expense-ledger">
        <div>
          <label className="filter-bar__label">Property</label>
          <select
            className="filter-bar__select"
            value={propertyFilter}
            onChange={(e) => { setPropertyFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="all">All Properties</option>
            {(properties || []).map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="filter-bar__label">Property</label>
          <input
            className="filter-bar__select"
            type="search"
            placeholder="Search property name…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          />
        </div>

        <div className="filter-bar__actions">
          <Button variant="primary" icon={Plus} onClick={onCreate}>
            Create Cost Profile
          </Button>
        </div>
      </div>

      <div className="table-result-count">
        {filtered.length === 0
          ? 'No cost profiles'
          : `Showing ${startIdx + 1}–${Math.min(startIdx + itemsPerPage, filtered.length)} of ${filtered.length} profile${filtered.length !== 1 ? 's' : ''}`}
      </div>

      {loading ? (
        <div className="empty-state">Loading cost profiles…</div>
      ) : paginated.length === 0 ? (
        <div className="empty-state empty-state--dashed">
          <Filter size={30} color="var(--text-light)" style={{ marginBottom: 10 }} />
          <p className="text-muted" style={{ fontSize: '0.85rem' }}>
            No property cost profiles yet. Create one to enable automatic COGS calculation.
          </p>
        </div>
      ) : (
        <div className="table-scroll-wrap">
          <table className="pms-table pms-table--financial">
            <thead>
              <tr>
                <th>Property Name</th>
                <th className="text-right">Fixed Stay Cost</th>
                <th className="text-right">Cost Per Night</th>
                <th>Last Updated</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium">{p.propertyName}</td>
                  <td className="text-right font-mono">{formatRp(p.fixedStayCost)}</td>
                  <td className="text-right font-mono">{formatRp(p.costPerNight)}</td>
                  <td>{formatDate(p.updatedAt || p.createdAt)}</td>
                  <td>
                    <div className="table-actions table-actions--center">
                      <TableActionButton
                        icon={Edit}
                        title="Edit"
                        onClick={() => onEdit(p)}
                      />
                      <TableActionButton
                        icon={Trash2}
                        title="Delete"
                        variant="danger"
                        onClick={() => onDelete(p)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length > itemsPerPage && (
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
}

export default CogsProfilesTable;
