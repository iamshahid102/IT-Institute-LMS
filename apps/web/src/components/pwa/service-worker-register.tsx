'use client';

import * as React from 'react';
import { toast } from 'sonner';

export function ServiceWorkerRegister() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    let refreshing = false;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              toast.message('A new version is available', {
                description: 'Reload to update the app shell.',
                action: { label: 'Reload', onClick: () => window.location.reload() },
                duration: 12_000,
              });
            }
          });
        });

        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (refreshing) return;
          refreshing = true;
        });
      } catch {
        // Installation is an enhancement; the app remains fully usable online.
      }
    };

    void register();
  }, []);

  return null;
}
