'use client';

import { useParams } from 'next/navigation';
import { SessionRoster } from '@/features/attendance/session-roster';

export default function FrontDeskSessionDetailPage() {
  const params = useParams<{ id: string }>();
  return <SessionRoster sessionId={params.id} mode="front-desk" />;
}
