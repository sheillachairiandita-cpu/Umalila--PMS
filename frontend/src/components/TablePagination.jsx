import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

function TablePagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  return (
    <div className="pagination">
      <button
        type="button"
        className="pagination__btn"
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
      >
        <ChevronLeft size={14} />
      </button>

      {Array.from({ length: totalPages }, (_, i) => i + 1)
        .filter((p) => Math.abs(p - currentPage) <= 1 || p === 1 || p === totalPages)
        .map((page, idx, arr) => {
          const showEllipsis = idx > 0 && arr[idx - 1] !== page - 1;
          return (
            <React.Fragment key={page}>
              {showEllipsis && <span className="pagination__ellipsis">…</span>}
              <button
                type="button"
                className={`pagination__btn pagination__btn--page ${currentPage === page ? 'pagination__btn--active' : ''}`}
                onClick={() => onPageChange(page)}
              >
                {page}
              </button>
            </React.Fragment>
          );
        })}

      <button
        type="button"
        className="pagination__btn"
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
      >
        <ChevronRight size={14} />
      </button>

      <span className="pagination__label">Page {currentPage} of {totalPages}</span>
    </div>
  );
}

export default TablePagination;
