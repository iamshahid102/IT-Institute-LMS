import type { Express } from 'express';
import request from 'supertest';

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: 'SUPER_ADMIN' | 'FRONT_DESK' | 'STUDENT';
  status: string;
  studentId?: string;
  permissions: string[];
}

export interface ApiError {
  code: string;
  message: string;
  requestId: string;
  details?: Array<{ field: string; message: string }>;
}

export function dataOf<T>(response: request.Response): T {
  return (response.body as { data: T }).data;
}

export function errorOf(response: request.Response): ApiError {
  return (response.body as { error: ApiError }).error;
}

const API = '/api/v1';

/**
 * Cookie-aware test client. Each instance keeps its own cookie jar, so two clients can be
 * signed in as different users at the same time. Unsafe requests automatically echo the CSRF
 * cookie the API issued, mirroring what the browser client does.
 */
export class ApiClient {
  readonly agent: ReturnType<typeof request.agent>;
  csrfToken = '';

  private constructor(app: Express) {
    this.agent = request.agent(app);
  }

  static async create(app: Express): Promise<ApiClient> {
    const client = new ApiClient(app);
    await client.refreshCsrf();
    return client;
  }

  async refreshCsrf(): Promise<void> {
    const response = await this.agent.get(`${API}/auth/csrf`);
    const body = response.body as { data?: { csrfToken?: string | null } };
    if (!body.data?.csrfToken) {
      throw new Error(`CSRF bootstrap failed with status ${response.status}`);
    }
    this.csrfToken = body.data.csrfToken;
  }

  get(path: string): request.Test {
    return this.agent.get(`${API}${path}`);
  }

  post(path: string, body?: unknown): request.Test {
    const call = this.agent.post(`${API}${path}`).set('X-CSRF-Token', this.csrfToken);
    return body === undefined ? call : call.send(body as object);
  }

  patch(path: string, body?: unknown): request.Test {
    const call = this.agent.patch(`${API}${path}`).set('X-CSRF-Token', this.csrfToken);
    return body === undefined ? call : call.send(body as object);
  }

  delete(path: string): request.Test {
    return this.agent.delete(`${API}${path}`).set('X-CSRF-Token', this.csrfToken);
  }

  /** Signs in and returns the authenticated user returned by the API. */
  async login(email: string, password: string): Promise<SessionUser> {
    const response = await this.post('/auth/login', { email, password });
    if (response.status !== 200) {
      throw new Error(`Login failed for ${email} with status ${response.status}`);
    }
    const body = response.body as { data?: { user?: SessionUser } };
    if (!body.data?.user) throw new Error('Login response did not include a user');
    return body.data.user;
  }
}
