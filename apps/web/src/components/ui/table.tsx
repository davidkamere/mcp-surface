import {
  forwardRef,
  useState,
  useMemo,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

export interface Column<T> {
  key: string;
  header: string;
  accessor: (row: T) => ReactNode;
  width?: string;
  align?: "left" | "center" | "right";
  sortable?: boolean;
  render?: (value: unknown, row: T) => ReactNode;
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyAccessor: (row: T) => string;
  isLoading?: boolean;
  emptyMessage?: string;
  emptyAction?: ReactNode;
  onRowClick?: (row: T) => void;
  striped?: boolean;
  hoverable?: boolean;
  density?: "comfortable" | "compact";
  className?: string;
}

function TableHeader<T>({
  columns,
  sortConfig,
  onSort,
  density,
}: {
  columns: Column<T>[];
  sortConfig: { key: string; direction: "asc" | "desc" } | null;
  onSort: (key: string) => void;
  density: "comfortable" | "compact";
}) {
  return (
    <thead className="bg-[var(--color-bg-tertiary)]">
      <tr>
        {columns.map((column) => (
          <th
            key={column.key}
            scope="col"
            className={`
              px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider
              ${column.align === "center" ? "text-center" : ""}
              ${column.align === "right" ? "text-right" : ""}
              ${column.sortable ? "cursor-pointer select-none hover:text-[var(--color-text-primary)]" : ""}
              ${density === "compact" ? "py-2" : ""}
            `}
            style={{ width: column.width }}
            onClick={() => column.sortable && onSort(column.key)}
            aria-sort={sortConfig?.key === column.key ? (sortConfig.direction === "asc" ? "ascending" : "descending") : "none"}
          >
            <div className="flex items-center gap-1.5 justify-center">
              {column.header}
              {column.sortable && (
                <span className="flex flex-col">
                  {sortConfig?.key === column.key && sortConfig.direction === "asc" ? (
                    <ChevronUp className="h-3 w-3 text-[var(--color-text-primary)]" />
                  ) : sortConfig?.key === column.key && sortConfig.direction === "desc" ? (
                    <ChevronDown className="h-3 w-3 text-[var(--color-text-primary)]" />
                  ) : (
                    <ChevronsUpDown className="h-3 w-3 text-[var(--color-text-tertiary)]" />
                  )}
                </span>
              )}
            </div>
          </th>
        ))}
      </tr>
    </thead>
  );
}

function TableBody<T>({
  columns,
  data,
  keyAccessor,
  onRowClick,
  striped,
  hoverable,
  density,
  renderCell,
}: {
  columns: Column<T>[];
  data: T[];
  keyAccessor: (row: T) => string;
  onRowClick?: (row: T) => void;
  striped: boolean;
  hoverable: boolean;
  density: "comfortable" | "compact";
  renderCell?: (column: Column<T>, row: T) => ReactNode;
}) {
  if (data.length === 0) {
    return null;
  }

  return (
    <tbody>
      {data.map((row, rowIndex) => (
        <tr
          key={keyAccessor(row)}
          className={`
            border-t border-[var(--color-border-primary)]
            ${striped && rowIndex % 2 === 1 ? "bg-[var(--color-bg-tertiary)]" : ""}
            ${hoverable ? "hover:bg-[var(--color-surface-hover)]" : ""}
            ${onRowClick ? "cursor-pointer" : ""}
            transition-colors duration-fast
          `}
          onClick={() => onRowClick?.(row)}
        >
          {columns.map((column) => (
            <td
              key={column.key}
              className={`
                px-4 py-3 text-sm text-[var(--color-text-primary)]
                ${column.align === "center" ? "text-center" : ""}
                ${column.align === "right" ? "text-right" : ""}
                ${density === "compact" ? "py-2" : ""}
              `}
            >
              {renderCell ? renderCell(column, row) : column.accessor(row)}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

function TableFooter<T>({
  columns,
}: {
  columns: Column<T>[];
}) {
  return (
    <tfoot>
      <tr>
        {columns.map((column) => (
          <th key={column.key} className="px-4 py-2 text-xs text-[var(--color-text-tertiary)]" />
        ))}
      </tr>
    </tfoot>
  );
}

export function Table<T>({
  columns,
  data,
  keyAccessor,
  isLoading = false,
  emptyMessage = "No data available",
  emptyAction,
  onRowClick,
  striped = true,
  hoverable = true,
  density = "comfortable",
  className = "",
}: TableProps<T>) {
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

  const sortedData = useMemo(() => {
    if (!sortConfig) return data;
    const column = columns.find((c) => c.key === sortConfig.key);
    if (!column) return data;
    return [...data].sort((a, b) => {
      const aValue = column.accessor(a);
      const bValue = column.accessor(b);
      if (aValue === bValue) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;
      const direction = sortConfig.direction === "asc" ? 1 : -1;
      return String(aValue) > String(bValue) ? direction : -direction;
    });
  }, [data, sortConfig, columns]);

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  return (
    <div className={`overflow-x-auto rounded-lg border border-[var(--color-border-primary)] ${className}`}>
      {isLoading ? (
        <div className="p-8 text-center">
          <div className="inline-flex items-center gap-2 text-[var(--color-text-secondary)]">
            <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Loading...
          </div>
        </div>
      ) : sortedData.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-[var(--color-text-secondary)] mb-4">{emptyMessage}</p>
          {emptyAction}
        </div>
      ) : (
        <table className="w-full" role="grid">
          <TableHeader columns={columns} sortConfig={sortConfig} onSort={handleSort} density={density} />
          <TableBody
            columns={columns}
            data={sortedData}
            keyAccessor={keyAccessor}
            onRowClick={onRowClick}
            striped={striped}
            hoverable={hoverable}
            density={density}
          />
          <TableFooter columns={columns} />
        </table>
      )}
    </div>
  );
}

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  showPageSize?: boolean;
  pageSizeOptions?: number[];
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  showPageSize = false,
  pageSizeOptions = [10, 25, 50, 100],
  className = "",
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = useMemo(() => {
    const result: (number | "ellipsis")[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) result.push(i);
    } else {
      result.push(1);
      if (currentPage > 3) result.push("ellipsis");

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) result.push(i);

      if (currentPage < totalPages - 2) result.push("ellipsis");
      result.push(totalPages);
    }
    return result;
  }, [currentPage, totalPages]);

  return (
    <div className={`flex items-center justify-between px-4 py-3 border-t border-[var(--color-border-primary)] ${className}`}>
      <div className="text-sm text-[var(--color-text-secondary)]">
        Page {currentPage} of {totalPages}
      </div>
      <div className="flex items-center gap-2">
        {showPageSize && (
          <select
            value={pageSizeOptions[0]}
            onChange={(e) => console.log("Page size:", e.target.value)}
            className="px-2 py-1 text-sm border border-[var(--color-border-primary)] rounded-md bg-[var(--color-surface-primary)] text-[var(--color-text-primary)]"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </select>
        )}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-1">
          {pages.map((page, index) =>
            page === "ellipsis" ? (
              <span key={index} className="px-2 text-[var(--color-text-tertiary)]">
                ...
              </span>
            ) : (
              <button
                key={index}
                onClick={() => onPageChange(page as number)}
                className={`
                  px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                  ${page === currentPage
                    ? "bg-[var(--color-bg-brand)] text-[var(--color-text-inverse)]"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
                  }
                `}
              >
                {page}
              </button>
            )
          )}
        </div>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function ChevronLeft({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRight({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}