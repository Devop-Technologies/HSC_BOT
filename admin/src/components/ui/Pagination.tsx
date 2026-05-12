'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  from: number;
  to: number;
  onPageChange: (page: number) => void;
  /** Singular label for items, e.g. "service" → "Showing 1–10 of 45 services" */
  itemLabel?: string;
}

export default function Pagination({
  page,
  totalPages,
  total,
  from,
  to,
  onPageChange,
  itemLabel = 'item',
}: PaginationProps) {
  const pluralLabel = total === 1 ? itemLabel : `${itemLabel}s`;

  // Build page number list with ellipsis
  const pageNums = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((p) => {
      if (totalPages <= 7) return true;
      if (p === 1 || p === totalPages) return true;
      if (Math.abs(p - page) <= 1) return true;
      return false;
    })
    .reduce<(number | '...')[]>((acc, p, idx, arr) => {
      if (
        idx > 0 &&
        typeof arr[idx - 1] === 'number' &&
        (p as number) - (arr[idx - 1] as number) > 1
      ) {
        acc.push('...');
      }
      acc.push(p);
      return acc;
    }, []);

  const btnBase: React.CSSProperties = {
    background: 'var(--color-page-bg)',
    border: '1px solid var(--color-card-border)',
    color: 'var(--color-text-secondary)',
  };

  const btnActive: React.CSSProperties = {
    background: 'var(--color-accent)',
    border: '1px solid transparent',
    color: '#fff',
  };

  return (
    <div className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Info text */}
      <p className="text-xs text-center sm:text-left" style={{ color: 'var(--color-text-muted)' }}>
        Showing {from}–{to} of {total} {pluralLabel}
      </p>

      {/* Page controls (only if more than 1 page) */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 flex-wrap">
          {/* Prev */}
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
            className="flex items-center gap-1 px-3 h-8 rounded-lg text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            style={btnBase}
          >
            <ChevronLeft size={13} />
            Prev
          </button>

          {/* Page numbers */}
          {pageNums.map((p, idx) =>
            p === '...' ? (
              <span
                key={`ellipsis-${idx}`}
                className="w-8 h-8 flex items-center justify-center text-xs"
                style={{ color: 'var(--color-text-muted)' }}
              >
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p as number)}
                className="w-8 h-8 rounded-lg text-xs font-medium"
                style={page === p ? btnActive : btnBase}
              >
                {p}
              </button>
            )
          )}

          {/* Next */}
          <button
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="flex items-center gap-1 px-3 h-8 rounded-lg text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            style={btnBase}
          >
            Next
            <ChevronRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
