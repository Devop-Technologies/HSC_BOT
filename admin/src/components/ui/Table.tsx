'use client';

import { Loader2 } from 'lucide-react';

// ─── Th ───────────────────────────────────────────────────────

export function Th({
  children,
  className = '',
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap ${className}`}
      style={{
        color: 'var(--color-table-header-text)',
        borderBottom: '1px solid var(--color-table-border)',
      }}
    >
      {children}
    </th>
  );
}

// ─── Td ───────────────────────────────────────────────────────

export function Td({
  children,
  className = '',
  style,
}: {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <td className={`px-5 py-3.5 ${className}`} style={style}>
      {children}
    </td>
  );
}

// ─── TableRow ─────────────────────────────────────────────────

export function TableRow({
  children,
  isLast = false,
}: {
  children: React.ReactNode;
  isLast?: boolean;
}) {
  return (
    <tr
      style={{
        borderBottom: isLast ? 'none' : '1px solid var(--color-table-border)',
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = 'var(--color-table-row-hover)')
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.background = 'transparent')
      }
    >
      {children}
    </tr>
  );
}

// ─── Table ────────────────────────────────────────────────────

interface TableProps {
  /** Column header labels */
  headers: React.ReactNode[];
  /** Table body rows (use TableRow + Td inside) */
  children: React.ReactNode;
  loading?: boolean;
  isEmpty?: boolean;
  emptyText?: string;
  /** Rendered below the table inside the card (e.g. Pagination) */
  footer?: React.ReactNode;
}

export function Table({
  headers,
  children,
  loading,
  isEmpty,
  emptyText = 'No data found.',
  footer,
}: TableProps) {
  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2
          className="animate-spin"
          size={24}
          style={{ color: 'var(--color-accent)' }}
        />
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="text-center py-20">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {emptyText}
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: 'var(--color-card-bg)',
        border: '1px solid var(--color-card-border)',
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead style={{ background: 'var(--color-table-header-bg)' }}>
            <tr>
              {headers.map((h, i) => (
                <Th key={i}>{h}</Th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>

      {footer && (
        <div style={{ borderTop: '1px solid var(--color-table-border)' }}>
          {footer}
        </div>
      )}
    </div>
  );
}
