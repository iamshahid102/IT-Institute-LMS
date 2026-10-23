'use client';

import { useParams } from 'next/navigation';
import { InvoiceDetail } from '@/features/fees/invoice-detail';

export default function AdminInvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  return <InvoiceDetail invoiceId={params.id} mode="admin" />;
}
