import React, { useState } from 'react';

interface Column<T> {
  title: string;
  dataIndex: keyof T | string;
  key: string;
  render?: (value: any, record: T, index: number) => React.ReactNode;
  sorter?: (a: T, b: T) => number;
  width?: number;
  align?: 'left' | 'center' | 'right';
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  pagination?: {
    current: number;
    pageSize: number;
    total: number;
    onChange: (page: number, pageSize: number) => void;
  };
  onRowClick?: (record: T) => void;
  rowKey?: keyof T | string;
  className?: string;
}

function Table<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  pagination,
  onRowClick,
  rowKey = 'id',
  className = '',
}: TableProps<T>) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);

  const handleSort = (column: Column<T>) => {
    if (!column.sorter) return;

    if (sortColumn === column.key) {
      if (sortOrder === 'asc') {
        setSortOrder('desc');
      } else if (sortOrder === 'desc') {
        setSortColumn(null);
        setSortOrder(null);
      } else {
        setSortOrder('asc');
      }
    } else {
      setSortColumn(column.key);
      setSortOrder('asc');
    }
  };

  const getSortedData = () => {
    if (!sortColumn || !sortOrder) return data;

    const column = columns.find((col) => col.key === sortColumn);
    if (!column || !column.sorter) return data;

    return [...data].sort(column.sorter);
  };

  const sortedData = getSortedData();
  const paginatedData = pagination
    ? sortedData.slice(
        (pagination.current - 1) * pagination.pageSize,
        pagination.current * pagination.pageSize
      )
    : sortedData;

  const getAlignClass = (align?: 'left' | 'center' | 'right') => {
    switch (align) {
      case 'center':
        return 'text-center';
      case 'right':
        return 'text-right';
      default:
        return 'text-left';
    }
  };

  return (
    <div className={`glass-card rounded-xl overflow-hidden ${className}`}>
      {/* Table container with scroll for mobile */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-primary-900/80 to-primary-700/60 border-b border-primary-700/30">
              {columns.map((column) => (
                <th
                  key={column.key}
                  onClick={() => handleSort(column)}
                  className={`
                    px-6 py-4
                    text-xs
                    font-semibold
                    text-white
                    uppercase
                    tracking-wider
                    ${column.sorter ? 'cursor-pointer hover:bg-primary-700/40 transition-colors' : ''}
                    ${getAlignClass(column.align)}
                  `}
                  style={{ width: column.width }}
                >
                  <div className="flex items-center gap-2">
                    <span>{column.title}</span>
                    {column.sorter && (
                      <div className="flex flex-col">
                        <svg
                          className={`w-3 h-3 ${
                            sortColumn === column.key && sortOrder === 'asc'
                              ? 'text-gold-600'
                              : 'text-gray-500'
                          }`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <svg
                          className={`w-3 h-3 -mt-1 ${
                            sortColumn === column.key && sortOrder === 'desc'
                              ? 'text-gold-600'
                              : 'text-gray-500'
                          }`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                  </div>
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center">
                  <div className="text-gray-400">No data available</div>
                </td>
              </tr>
            ) : (
              paginatedData.map((record, index) => (
                <tr
                  key={String(record[rowKey] || index)}
                  onClick={() => onRowClick?.(record)}
                  className={`
                    border-b
                    border-primary-700/10
                    transition-colors
                    ${
                      index % 2 === 0
                        ? 'bg-white/[0.02]'
                        : 'bg-white/[0.05]'
                    }
                    ${onRowClick ? 'hover:bg-primary-700/20 cursor-pointer' : ''}
                  `}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`
                        px-6
                        py-4
                        text-sm
                        text-gray-300
                        ${getAlignClass(column.align)}
                      `}
                    >
                      {column.render
                        ? column.render(
                            record[column.dataIndex as keyof T],
                            record,
                            index
                          )
                        : String(record[column.dataIndex as keyof T] ?? '-')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.total > 0 && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-primary-700/20 bg-white/[0.02]">
          <div className="text-sm text-gray-400">
            Showing{' '}
            <span className="font-medium text-white">
              {(pagination.current - 1) * pagination.pageSize + 1}
            </span>{' '}
            to{' '}
            <span className="font-medium text-white">
              {Math.min(
                pagination.current * pagination.pageSize,
                pagination.total
              )}
            </span>{' '}
            of <span className="font-medium text-white">{pagination.total}</span>{' '}
            results
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                pagination.onChange(
                  pagination.current - 1,
                  pagination.pageSize
                )
              }
              disabled={pagination.current === 1}
              className="
                px-3
                py-2
                rounded-lg
                text-sm
                font-medium
                border
                border-primary-700/30
                bg-white/5
                text-gray-300
                hover:bg-primary-700/20
                disabled:opacity-50
                disabled:cursor-not-allowed
                transition-all
              "
            >
              Previous
            </button>

            <div className="flex items-center gap-1">
              {Array.from(
                { length: Math.ceil(pagination.total / pagination.pageSize) },
                (_, i) => i + 1
              )
                .filter(
                  (page) =>
                    page === 1 ||
                    page === pagination.current ||
                    page === Math.ceil(pagination.total / pagination.pageSize) ||
                    Math.abs(page - pagination.current) <= 2
                )
                .map((page, idx, arr) => (
                  <React.Fragment key={page}>
                    {idx > 0 && arr[idx - 1] !== page - 1 && (
                      <span className="px-2 text-gray-500">...</span>
                    )}
                    <button
                      onClick={() =>
                        pagination.onChange(page, pagination.pageSize)
                      }
                      className={`
                        px-3
                        py-2
                        rounded-lg
                        text-sm
                        font-medium
                        border
                        transition-all
                        ${
                          pagination.current === page
                            ? 'bg-gradient-viral text-white border-gold-600 shadow-glow'
                            : 'border-primary-700/30 bg-white/5 text-gray-300 hover:bg-primary-700/20'
                        }
                      `}
                    >
                      {page}
                    </button>
                  </React.Fragment>
                ))}
            </div>

            <button
              onClick={() =>
                pagination.onChange(
                  pagination.current + 1,
                  pagination.pageSize
                )
              }
              disabled={
                pagination.current >=
                Math.ceil(pagination.total / pagination.pageSize)
              }
              className="
                px-3
                py-2
                rounded-lg
                text-sm
                font-medium
                border
                border-primary-700/30
                bg-white/5
                text-gray-300
                hover:bg-primary-700/20
                disabled:opacity-50
                disabled:cursor-not-allowed
                transition-all
              "
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Table;
