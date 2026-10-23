'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import jsQR from 'jsqr';
import { Camera, CameraOff, CheckCircle2, Keyboard, ScanLine, XCircle } from 'lucide-react';
import { apiFetch, formatApiError } from '@/lib/api';
import { dateTimeLabel } from '@/lib/format';
import { qs } from '@/lib/query';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';

interface OpenSession {
  id: string;
  startsAt: string;
  topic: string | null;
  status: string;
  batch: { code: string; name: string; course: { title: string } };
}

interface FeedbackEntry {
  id: string;
  ok: boolean;
  message: string;
  at: string;
}

export function AttendanceScanner({ mode }: { mode: 'admin' | 'front-desk' }) {
  const base = mode === 'admin' ? '/admin' : '/front-desk';
  const searchParams = useSearchParams();
  const [sessionId, setSessionId] = React.useState(searchParams.get('sessionId') ?? '');
  const [cameraActive, setCameraActive] = React.useState(false);
  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<FeedbackEntry[]>([]);
  const [manualNumber, setManualNumber] = React.useState('');
  const [manualError, setManualError] = React.useState<string | null>(null);
  const [manualPending, setManualPending] = React.useState(false);

  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const frameRef = React.useRef<number | null>(null);
  const busyRef = React.useRef(false);
  const recentRef = React.useRef<Map<string, number>>(new Map());
  const markRef = React.useRef<(token: string) => Promise<void>>(async () => {});

  const sessions = useQuery({
    queryKey: ['attendance', 'sessions', 'open'],
    queryFn: async () =>
      (
        await apiFetch<{ data: OpenSession[] }>(
          `/attendance/sessions${qs({ status: 'OPEN', pageSize: 50 })}`,
        )
      ).data,
    refetchInterval: 30_000,
  });

  const selected = sessions.data?.find((session) => session.id === sessionId);

  const pushFeedback = React.useCallback((ok: boolean, message: string) => {
    setFeedback((current) =>
      [
        { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, ok, message, at: new Date().toISOString() },
        ...current,
      ].slice(0, 8),
    );
  }, []);

  const markToken = async (qrToken: string) => {
    if (!sessionId) {
      pushFeedback(false, 'Select an open session before scanning.');
      return;
    }
    const lastSeen = recentRef.current.get(qrToken) ?? 0;
    if (Date.now() - lastSeen < 4_000) return;
    recentRef.current.set(qrToken, Date.now());
    try {
      const result = await apiFetch<{ data: { student: { fullName: string; studentNumber: string } } }>(
        '/attendance/scan',
        { method: 'POST', body: JSON.stringify({ sessionId, qrToken }) },
      );
      pushFeedback(true, `${result.data.student.fullName} (${result.data.student.studentNumber}) marked present.`);
    } catch (error) {
      pushFeedback(false, formatApiError(error));
    } finally {
      window.setTimeout(() => recentRef.current.delete(qrToken), 10_000);
    }
  };

  React.useEffect(() => {
    markRef.current = markToken;
  });

  const stopCamera = React.useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }, []);

  const tick = React.useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !streamRef.current) return;

    if (video.readyState >= 2 && video.videoWidth > 0 && !busyRef.current) {
      const width = Math.min(video.videoWidth, 640);
      const height = Math.round((video.videoHeight / video.videoWidth) * width);
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (context) {
        context.drawImage(video, 0, 0, width, height);
        const image = context.getImageData(0, 0, width, height);
        const code = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' });
        if (code?.data) {
          busyRef.current = true;
          void markRef.current(code.data).finally(() => {
            window.setTimeout(() => {
              busyRef.current = false;
            }, 1_200);
          });
        }
      }
    }

    frameRef.current = window.requestAnimationFrame(tick);
  }, []);

  const startCamera = React.useCallback(async () => {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('This browser does not support camera access. Use manual marking instead.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setCameraActive(true);
      frameRef.current = window.requestAnimationFrame(tick);
    } catch {
      setCameraError(
        'Camera permission was denied or no camera is available. Allow camera access or use manual marking below.',
      );
    }
  }, [tick]);

  React.useEffect(() => stopCamera, [stopCamera]);

  const submitManual = async (event: React.FormEvent) => {
    event.preventDefault();
    setManualError(null);
    if (!sessionId) {
      setManualError('Select an open session first.');
      return;
    }
    if (!manualNumber.trim()) {
      setManualError('Enter the student number.');
      return;
    }
    setManualPending(true);
    try {
      const result = await apiFetch<{ data: { student: { fullName: string; studentNumber: string } } }>(
        '/attendance/manual',
        {
          method: 'POST',
          body: JSON.stringify({ sessionId, studentNumber: manualNumber.trim().toUpperCase(), status: 'PRESENT' }),
        },
      );
      pushFeedback(true, `${result.data.student.fullName} (${result.data.student.studentNumber}) marked present.`);
      setManualNumber('');
    } catch (error) {
      setManualError(formatApiError(error));
    } finally {
      setManualPending(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Attendance scanner"
        description="Scan a student's attendance QR while the session is open. Student QRs contain no personal data."
        backHref={`${base}/attendance/sessions`}
        backLabel="All sessions"
        actions={
          <Button variant="outline" asChild>
            <Link href={`${base}/attendance/sessions`}>Back to sessions</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Session</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sessions.isError ? (
            <ErrorState message="Open sessions could not be loaded." onRetry={() => void sessions.refetch()} />
          ) : sessions.data && sessions.data.length === 0 ? (
            <EmptyState
              title="No open session"
              description="Open a scheduled session before marking attendance."
              action={
                <Button asChild size="sm">
                  <Link href={`${base}/attendance/sessions`}>Go to sessions</Link>
                </Button>
              }
            />
          ) : (
            <>
              <Select value={sessionId} onValueChange={setSessionId}>
                <SelectTrigger aria-label="Attendance session">
                  <SelectValue placeholder="Select an open session" />
                </SelectTrigger>
                <SelectContent>
                  {(sessions.data ?? []).map((session) => (
                    <SelectItem key={session.id} value={session.id}>
                      {session.batch.code} · {dateTimeLabel(session.startsAt)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selected ? (
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <StatusBadge status={selected.status} />
                  <span>{selected.batch.course.title}</span>
                  <span>·</span>
                  <span>{selected.topic ?? 'Class session'}</span>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Camera</CardTitle>
            {cameraActive ? (
              <Button size="sm" variant="outline" onClick={stopCamera}>
                <CameraOff className="h-4 w-4" /> Stop camera
              </Button>
            ) : (
              <Button size="sm" onClick={() => void startCamera()} disabled={!sessionId}>
                <Camera className="h-4 w-4" /> Start camera
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative aspect-[4/3] overflow-hidden rounded-lg border bg-slate-950">
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                playsInline
                muted
                aria-label="Camera preview for QR scanning"
              />
              {!cameraActive ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-slate-300">
                  <ScanLine className="h-10 w-10" />
                  <p className="text-sm">
                    {sessionId ? 'Start the camera and point it at the student QR code.' : 'Select an open session to begin.'}
                  </p>
                </div>
              ) : (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-2/3 w-2/3 rounded-xl border-2 border-white/70" />
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>
            {cameraError ? (
              <p className="rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900">{cameraError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Camera frames are processed in the browser and never uploaded. Scans are validated by the server.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Keyboard className="h-4 w-4" /> Manual fallback
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitManual} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="manual-student">Student number</Label>
                <Input
                  id="manual-student"
                  value={manualNumber}
                  onChange={(event) => setManualNumber(event.target.value)}
                  placeholder="STU-2026-0001"
                  autoCapitalize="characters"
                />
              </div>
              {manualError ? <p className="text-sm text-destructive">{manualError}</p> : null}
              <Button type="submit" className="w-full" disabled={manualPending || !sessionId}>
                {manualPending ? 'Marking…' : 'Mark present'}
              </Button>
              <p className="text-xs text-muted-foreground">
                Use this when the camera is unavailable or a student cannot display their QR code.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scan results</CardTitle>
        </CardHeader>
        <CardContent>
          {feedback.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scans yet in this session.</p>
          ) : (
            <ul className="space-y-2">
              {feedback.map((entry) => (
                <li
                  key={entry.id}
                  className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
                    entry.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-destructive/30 bg-destructive/5 text-destructive'
                  }`}
                >
                  {entry.ok ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  <span className="flex-1">{entry.message}</span>
                  <span className="whitespace-nowrap text-xs opacity-70">
                    {new Date(entry.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
