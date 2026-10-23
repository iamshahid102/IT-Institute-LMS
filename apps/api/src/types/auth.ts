import type { Role } from '@lms/shared';

export interface AuthContext {
  userId: string;
  sessionId: string;
  role: Role;
  email: string;
  fullName: string;
  /** Present for STUDENT accounts that are linked to a student record. */
  studentId?: string;
}
