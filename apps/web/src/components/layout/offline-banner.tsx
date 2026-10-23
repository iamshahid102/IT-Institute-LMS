'use client';

import * as React from 'react';
import { WifiOff } from 'lucide-react';

export function OfflineBanner() {
  const [offline, setOffline] = React.useState(false);

  React.useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-lg border border-warning/30 bg-[hsl(38_95%_94%)] px-3 py-2 text-sm text-[hsl(30_85%_28%)]"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>
        You are offline. Saved pages may still open, but attendance, payments and other changes need a
        connection and are never recorded while offline.
      </span>
    </div>
  );
}
