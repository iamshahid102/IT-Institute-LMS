'use client';

import Link from 'next/link';
import { RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="rounded-full bg-muted p-4 text-muted-foreground">
        <WifiOff className="h-7 w-7" />
      </span>
      <h1 className="text-xl font-semibold">You are offline</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        The network is unavailable. Pages you already visited may open, but attendance, payments and other
        changes require a connection and are never saved while offline.
      </p>
      <div className="flex gap-2">
        <Button onClick={() => window.location.reload()}>
          <RefreshCw className="h-4 w-4" /> Try again
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">Go to start page</Link>
        </Button>
      </div>
    </div>
  );
}
