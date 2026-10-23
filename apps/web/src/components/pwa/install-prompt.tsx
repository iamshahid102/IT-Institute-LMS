'use client';

import * as React from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'lms-install-dismissed';

export function InstallPrompt() {
  const [event, setEvent] = React.useState<InstallEvent | null>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (window.localStorage.getItem(DISMISS_KEY) === '1') return;

    const handler = (browserEvent: Event) => {
      browserEvent.preventDefault();
      setEvent(browserEvent as InstallEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!visible || !event) return null;

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card px-3 py-2.5 text-sm shadow-card sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <Download className="h-4 w-4 text-primary" />
        <span>Install the institute app for quicker access on this device.</span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={async () => {
            await event.prompt();
            const choice = await event.userChoice;
            if (choice.outcome === 'accepted') setVisible(false);
          }}
        >
          Install
        </Button>
        <Button size="sm" variant="ghost" onClick={dismiss} aria-label="Dismiss install prompt">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
