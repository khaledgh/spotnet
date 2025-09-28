import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Filter, RefreshCw } from 'lucide-react';

export interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  sortable?: boolean;
  sortKey?: string;
  width?: string;
  className?: string;
}

export interface PaginationState {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface SortState {
  field: string;
  direction: 'asc' | 'desc';
}

export type FilterState = Record<string, unknown>;

interface DataTableProps<T extends object> {
  columns: Column<T>[];
  data: T[];
  pagination: PaginationState;
  isLoading: boolean;
  sortState?: SortState;
  filterState?: FilterState;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSortChange?: (sortState: SortState) => void;
  onFilterChange?: (filterState: FilterState) => void;
  onRefresh?: () => void;
  keyField: keyof T;
  emptyMessage?: string;
  className?: string;
  renderRowActions?: (row: T) => React.ReactNode;
  renderFilters?: () => React.ReactNode;
}

const DataTable = <T extends object>({
  columns,
  data,
  pagination,
  isLoading,
  sortState,
  filterState,
  onPageChange,
  onPageSizeChange,
  onSortChange,
  onFilterChange,
  onRefresh,
  keyField,
  emptyMessage = 'No data found',
  className = '',
  renderRowActions,
  renderFilters
}: DataTableProps<T>) => {
  const [showFilters, setShowFilters] = useState(false);

  const hasActiveFilters = useMemo(() => {
    if (!filterState) return false;

    return Object.values(filterState).some((value) => {
      if (Array.isArray(value)) {
        return value.length > 0;
      }

      if (typeof value === 'string') {
        return value.trim() !== '' && value !== 'all';
      }

      return value !== undefined && value !== null && value !== false;
    });
  }, [filterState]);

  const handleSort = (column: Column<T>) => {
    if (!column.sortable || !onSortChange || typeof column.accessor !== 'string') return;
    
    const sortKey = column.sortKey || column.accessor as string;
    
    if (sortState && sortState.field === sortKey) {
      onSortChange({
        field: sortKey,
        direction: sortState.direction === 'asc' ? 'desc' : 'asc'
      });
    } else {
      onSortChange({
        field: sortKey,
        direction: 'asc'
      });
    }
  };

  const getSortIcon = (column: Column<T>) => {
    if (!column.sortable || typeof column.accessor !== 'string') return null;
    
    const sortKey = column.sortKey || column.accessor as string;
    
    if (sortState && sortState.field === sortKey) {
      return (
        <span className="ml-1">
          {sortState.direction === 'asc' ? '↑' : '↓'}
        </span>
      );
    }
    return null;
  };

  const renderPagination = () => {
    const { page, pageSize, totalItems, totalPages } = pagination;
    
    const startItem = (page - 1) * pageSize + 1;
    const endItem = Math.min(page * pageSize, totalItems);
    
    return (
      <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 bg-white border-t border-gray-200">
        <div className="flex items-center mb-4 sm:mb-0">
          <span className="text-sm text-gray-700">
            Showing <span className="font-medium">{totalItems > 0 ? startItem : 0}</span> to{' '}
            <span className="font-medium">{endItem}</span> of{' '}
            <span className="font-medium">{totalItems}</span> results
          </span>
          
          <div className="ml-4">
            <select
              className="input input-sm"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
            >
              {[10, 25, 50, 100].map(size => (
                <option key={size} value={size}>
                  {size} per page
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="btn btn-sm btn-outline disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          
          <div className="flex items-center">
            {totalPages <= 7 ? (
              // Show all pages if 7 or fewer
              [...Array(totalPages)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => onPageChange(i + 1)}
                  className={`btn btn-sm ${
                    page === i + 1 ? 'btn-primary' : 'btn-outline'
                  } mx-1`}
                >
                  {i + 1}
                </button>
              ))
            ) : (
              // Show limited pages with ellipsis for many pages
              <>
                <button
                  onClick={() => onPageChange(1)}
                  className={`btn btn-sm ${
                    page === 1 ? 'btn-primary' : 'btn-outline'
                  } mx-1`}
                >
                  1
                </button>
                
                {page > 3 && <span className="mx-1">...</span>}
                
                {page > 2 && (
                  <button
                    onClick={() => onPageChange(page - 1)}
                    className="btn btn-sm btn-outline mx-1"
                  >
                    {page - 1}
                  </button>
                )}
                
                {page !== 1 && page !== totalPages && (
                  <button
                    onClick={() => onPageChange(page)}
                    className="btn btn-sm btn-primary mx-1"
                  >
                    {page}
                  </button>
                )}
                
                {page < totalPages - 1 && (
                  <button
                    onClick={() => onPageChange(page + 1)}
                    className="btn btn-sm btn-outline mx-1"
                  >
                    {page + 1}
                  </button>
                )}
                
                {page < totalPages - 2 && <span className="mx-1">...</span>}
                
                <button
                  onClick={() => onPageChange(totalPages)}
                  className={`btn btn-sm ${
                    page === totalPages ? 'btn-primary' : 'btn-outline'
                  } mx-1`}
                >
                  {totalPages}
                </button>
              </>
            )}
          </div>
          
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="btn btn-sm btn-outline disabled:opacity-50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className={`card ${className}`}>
      <div className="card-content p-0">
        {(renderFilters || onRefresh) && (
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              {onFilterChange && (
                <button 
                  onClick={() => setShowFilters(!showFilters)}
                  className={`btn btn-sm ${hasActiveFilters ? 'btn-primary' : 'btn-outline'} flex items-center`}
                >
                  <Filter className="h-4 w-4 mr-1" />
                  Filters
                  {hasActiveFilters && (
                    <span className="ml-2 inline-flex h-2 w-2 rounded-full bg-blue-500"></span>
                  )}
                </button>
              )}
            </div>
            
            {onRefresh && (
              <button 
                onClick={onRefresh}
                className="btn btn-sm btn-outline"
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        )}
        
        {showFilters && renderFilters && (
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            {renderFilters()}
          </div>
        )}
        
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead className="table-header">
              <tr>
                {columns.map((column, index) => (
                  <th 
                    key={index}
                    className={`table-head ${column.sortable ? 'cursor-pointer' : ''} ${column.className || ''}`}
                    style={{ width: column.width }}
                    onClick={() => column.sortable && handleSort(column)}
                  >
                    <div className="flex items-center">
                      {column.header}
                      {getSortIcon(column)}
                    </div>
                  </th>
                ))}
                {renderRowActions && <th className="table-head">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={columns.length + (renderRowActions ? 1 : 0)} className="table-cell text-center py-8">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    </div>
                  </td>
                </tr>
              ) : data.length > 0 ? (
                data.map((row) => (
                  <tr key={String(row[keyField])} className="table-row">
                    {columns.map((column, cellIndex) => (
                      <td key={cellIndex} className="table-cell">
                        {typeof column.accessor === 'function'
                          ? column.accessor(row)
                          : (row[column.accessor] as React.ReactNode)}
                      </td>
                    ))}
                    {renderRowActions && (
                      <td className="table-cell">
                        {renderRowActions(row)}
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length + (renderRowActions ? 1 : 0)} className="table-cell text-center py-8">
                    <div className="text-gray-500">{emptyMessage}</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {pagination && renderPagination()}
      </div>
    </div>
  );
};

export default DataTable;
