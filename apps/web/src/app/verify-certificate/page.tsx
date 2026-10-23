'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { BadgeCheck, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

export default function VerifyCertificateIndexPage() {
  const router = useRouter();
  const [code, setCode] = React.useState('');

  return (
    <div className="flex min-h-dvh flex-col bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-2 px-4">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold">Certificate verification</span>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-lg flex-1 items-center px-4 py-12">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-xl">Verify an institute certificate</CardTitle>
            <CardDescription>
              Enter the verification code printed on the certificate, or scan the QR code on the PDF.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                const trimmed = code.trim();
                if (trimmed) router.push(`/verify-certificate/${encodeURIComponent(trimmed)}`);
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="code">Verification code</Label>
                <Input
                  id="code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="Paste the code from the certificate"
                  autoComplete="off"
                  required
                  minLength={10}
                />
              </div>
              <Button type="submit" className="w-full" disabled={code.trim().length < 10}>
                <BadgeCheck className="h-4 w-4" /> Check certificate
              </Button>
            </form>
            <p className="mt-4 text-xs text-muted-foreground">
              Verification shows only the certificate status, course, issue date and the approved student name.
              Fees, contact details and login identifiers are never published.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
