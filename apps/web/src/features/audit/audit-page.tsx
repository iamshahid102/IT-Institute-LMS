'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Search } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { dateTimeLabel, labelize } from '@/lib/format';
import { qs } from '@/lib/query';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ErrorState } from '@/components/ui/empty-state';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  requestId: string | null;
  createdAt: string;
  actor: { id: string; fullName: string; email: string; role: string } | null;
}

const ENTITY_TYPES = [
  'User',
  'Student',
  'Enrollment',
  'ClassSession',
  'AttendanceRecord',
  'Invoice',
  'Payment',
  'Certificate',
  'Assessment',
  'Announcement',
  'InstituteSetting',
];

export function AuditPage() {
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [entityType, setEntityType] = React.useState('ALL');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [page, setPage] = React.useState(1);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['audit', page, debouncedSearch, entityType, from, to],
    queryFn: async () =>
      apiFetch<{ data: AuditRow[]; meta: { total: number } }>(
        `/audit-logs${qs({
          page,
          pageSize: 25,
          action: debouncedSearch || undefined,
          entityType: entityType === 'ALL' ? undefined : entityType,
          from: from || undefined,
          to: to || undefined,
        })}`,
      ),
  });

  const columns = React.useMemo<ColumnDef<AuditRow, unknown>[]>(
    () => [
      {
        id: 'time',
        header: 'When',
        accessorKey: 'createdAt',
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">{dateTimeLabel(row.original.createdAt)}</span>
        ),
      },
      {
        id: 'actor',
        header: 'Actor',
        accessorFn: (row) => row.actor?.fullName ?? 'System',
        cell: ({ row }) => (
          <div>
            <p className="text-sm">{row.original.actor?.fullName ?? 'System'}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.actor ? labelize(row.original.actor.role) : '—'}
            </p>
          </div>
        ),
      },
      {
        id: 'action',
        header: 'Action',
        accessorKey: 'action',
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.action}</span>,
      },
      {
        id: 'entity',
        header: 'Entity',
        accessorFn: (row) => row.entityType,
        cell: ({ row }) => (
          <div>
            <Badge variant="neutral">{row.original.entityType}</Badge>
            {row.original.entityId ? (
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">{row.original.entityId.slice(0, 8)}…</p>
            ) : null}
          </div>
        ),
      },
      {
        id: 'metadata',
        header: 'Details',
        cell: ({ row }) => (
          <p className="max-w-[320px] truncate font-mono text-[11px] text-muted-foreground">
            {row.original.metadata ? JSON.stringify(row.original.metadata) : '—'}
          </p>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Audit log"
        description="Security-sensitive actions such as corrections, reversals, issuance and permission changes."
        backHref="/admin"
        backLabel="Dashboard"
      />

      <div className="grid gap-2 rounded-xl border bg-card p-3 shadow-card lg:grid-cols-[1fr_200px_150px_150px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Filter by action"
            className="pl-9"
            aria-label="Filter by action"
          />
        </div>
        <Select
          value={entityType}
          onValueChange={(value) => {
            setEntityType(value);
            setPage(1);
          }}
        >
          <SelectTrigger aria-label="Entity type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All entities</SelectItem>
            {ENTITY_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={from}
          onChange={(event) => {
            setFrom(event.target.value);
            setPage(1);
          }}
          aria-label="From date"
        />
        <div className="flex gap-2">
          <Input
            type="date"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
            aria-label="To date"
          />
          {from || to ? (
            <Button
              variant="ghost"
              onClick={() => {
                setFrom('');
                setTo('');
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <ErrorState message="Audit logs could not be loaded." onRetry={() => void refetch()} />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={data?.data ?? []}
            isLoading={isLoading}
            emptyTitle="No audit entries"
            emptyDescription="Audited actions will appear here as staff work in the system."
          />
          <Pagination page={page} pageSize={25} total={data?.meta.total ?? 0} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
