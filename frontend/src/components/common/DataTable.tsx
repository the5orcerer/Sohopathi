import React, { useState } from 'react';
import { Loader2, Inbox } from 'lucide-react';
import { Pagination } from './Pagination';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T, index: number) => React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
  pagination?: {
    pageSize?: number;
    showSizeChanger?: boolean;
    pageSizeOptions?: number[];
  };
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  emptyMessage = 'No records found',
  onRowClick,
  pagination,
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(pagination?.pageSize || 10);

  const displayData = pagination
    ? data.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : data;
  if (isLoading) {
    return (
      <div
        style={{
          padding: '3rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem',
          color: 'var(--text-muted)',
        }}
      >
        <Loader2 size={24} className="animate-spin" color="var(--primary)" />
        <span style={{ fontSize: '0.85rem' }}>Loading data...</span>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div
        style={{
          padding: '3rem 1.5rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          color: 'var(--text-muted)',
          textAlign: 'center',
        }}
      >
        <Inbox size={32} strokeWidth={1.5} />
        <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{emptyMessage}</span>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto', width: '100%' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <thead>
          <tr
            style={{
              borderBottom: '1px solid var(--border-subtle)',
              color: 'var(--text-muted)',
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  padding: '0.75rem 1rem',
                  textAlign: col.align || 'left',
                  width: col.width,
                  whiteSpace: 'nowrap',
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayData.map((item, idx) => (
            <tr
              key={keyExtractor(item, (currentPage - 1) * pageSize + idx)}
              onClick={() => onRowClick && onRowClick(item)}
              style={{
                borderBottom: '1px solid var(--border-subtle)',
                cursor: onRowClick ? 'pointer' : 'default',
                transition: 'background var(--transition-fast)',
              }}
              onMouseEnter={(e) => {
                if (onRowClick) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
              }}
              onMouseLeave={(e) => {
                if (onRowClick) e.currentTarget.style.background = 'transparent';
              }}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  style={{
                    padding: '0.85rem 1rem',
                    textAlign: col.align || 'left',
                    color: 'var(--text-primary)',
                    verticalAlign: 'middle',
                  }}
                >
                  {col.render ? col.render(item, (currentPage - 1) * pageSize + idx) : (item as any)[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {pagination && data.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalItems={data.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={pagination.showSizeChanger !== false ? setPageSize : undefined}
          pageSizeOptions={pagination.pageSizeOptions}
        />
      )}
    </div>
  );
}
