'use client';

import * as React from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronsUpDown, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from './skeleton';

interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (row: T) => void;
  initialSorting?: SortingState;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  isLoading = false,
  emptyTitle = 'No records yet',
  emptyDescription = 'Records will appear here once they are created.',
  onRowClick,
  initialSorting = [],
  className,
}: DataTableProps<T>) {
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className={cn('overflow-hidden rounded-xl border bg-card shadow-card', className)}>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  return (
                    <th key={header.id} className="whitespace-nowrap px-4 py-3 font-medium">
                      {header.isPlaceholder ? null : (
                        <button
                          type="button"
                          disabled={!canSort}
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn(
                            'inline-flex items-center gap-1.5',
                            canSort ? 'hover:text-foreground' : 'cursor-default',
                          )}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort ? (
                            header.column.getIsSorted() === 'asc' ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : header.column.getIsSorted() === 'desc' ? (
                              <ArrowDown className="h-3 w-3" />
                            ) : (
                              <ChevronsUpDown className="h-3 w-3 opacity-40" />
                            )
                          ) : null}
                        </button>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <tr key={`skeleton-${index}`} className="border-t">
                  {columns.map((column, columnIndex) => (
                    <td key={String(column.id ?? columnIndex)} className="px-4 py-3.5">
                      <Skeleton className="h-4 w-full max-w-[160px]" />
                    </td>
                  ))}
                </tr>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <tr className="border-t">
                <td colSpan={columns.length} className="px-4 py-14 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                    <span className="rounded-full bg-muted p-2.5 text-muted-foreground">
                      <Inbox className="h-5 w-5" />
                    </span>
                    <p className="text-sm font-medium">{emptyTitle}</p>
                    <p className="text-xs text-muted-foreground">{emptyDescription}</p>
                  </div>
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    'border-t transition-colors hover:bg-muted/40',
                    onRowClick && 'cursor-pointer focus-within:bg-muted/40',
                  )}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3.5 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
