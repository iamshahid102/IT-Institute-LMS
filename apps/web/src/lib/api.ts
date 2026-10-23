export interface ApiErrorDetail {
  field: string;
  message: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ApiErrorDetail[];
  readonly requestId: string;

  constructor(status: number, code: string, message: string, details: ApiErrorDetail[] = [], requestId = '') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

async function fetchCsrfToken(): Promise<string> {
  const response = await fetch('/api/v1/auth/csrf', {
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!response.ok) throw new ApiError(response.status, 'CSRF_UNAVAILABLE', 'Could not initialise request security.');
  const payload = (await response.json()) as { data?: { csrfToken?: string } };
  return payload.data?.csrfToken ?? readCookie('lms_csrf') ?? '';
}

async function csrfToken(): Promise<string> {
  return readCookie('lms_csrf') ?? (await fetchCsrfToken());
}

const UNSAFE = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers);

  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (UNSAFE.has(method)) headers.set('X-CSRF-Token', await csrfToken());

  const response = await fetch(`/api/v1${path}`, {
    ...init,
    method,
    headers,
    credentials: 'same-origin',
    cache: 'no-store',
  });

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get('content-type') ?? '';
  if (!response.ok) {
    let code = 'REQUEST_FAILED';
    let message = 'The request could not be completed.';
    let details: ApiErrorDetail[] = [];
    let requestId = '';
    if (contentType.includes('application/json')) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: { code?: string; message?: string; details?: ApiErrorDetail[]; requestId?: string } }
        | null;
      code = payload?.error?.code ?? code;
      message = payload?.error?.message ?? message;
      details = payload?.error?.details ?? [];
      requestId = payload?.error?.requestId ?? '';
    }
    throw new ApiError(response.status, code, message, details, requestId);
  }

  if (!contentType.includes('application/json')) {
    return (await response.blob()) as T;
  }

  return (await response.json()) as T;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export async function downloadFile(path: string, filename: string): Promise<void> {
  const response = await fetch(`/api/v1${path}`, {
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new ApiError(
      response.status,
      'DOWNLOAD_FAILED',
      payload?.error?.message ?? 'The file could not be downloaded.',
    );
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function formatApiError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}
