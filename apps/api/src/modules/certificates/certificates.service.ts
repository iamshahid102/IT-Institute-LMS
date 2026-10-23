import type { CertificateStatus, Role } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { storage } from '../../services/storage';
import { recordAudit } from '../../utils/audit';
import { randomToken, sha256Buffer } from '../../utils/crypto';
import { businessRule, conflict, notFound } from '../../utils/errors';
import { nextBusinessNumber } from '../../utils/numbers';
import { getEnrollmentAttendance } from '../attendance/attendance.stats';
import { getSettings } from '../settings/settings.service';
import { buildCertificatePdf } from './certificate.pdf';

interface ActorMeta {
  actorId: string;
  actorRole: Role;
  requestId?: string | null;
  ip?: string | null;
}

export interface EligibilityCheck {
  key: string;
  label: string;
  passed: boolean;
  detail: string;
}

async function outstandingForEnrollment(enrollmentId: string): Promise<number> {
  const invoices = await prisma.invoice.findMany({
    where: { enrollmentId, status: { not: 'VOID' } },
    select: { totalMinor: true, payments: { select: { amountMinor: true, reversedAmountMinor: true } } },
  });
  let outstanding = 0;
  for (const invoice of invoices) {
    const paid = invoice.payments.reduce((sum, payment) => sum + payment.amountMinor - payment.reversedAmountMinor, 0);
    outstanding += Math.max(0, invoice.totalMinor - paid);
  }
  return outstanding;
}

export async function getEligibility(enrollmentId: string) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      student: { select: { id: true, studentNumber: true, fullName: true } },
      batch: { select: { id: true, code: true, courseId: true, course: { select: { title: true } } } },
    },
  });
  if (!enrollment) throw notFound('Enrollment not found.');

  const settings = await getSettings();
  const attendance = await getEnrollmentAttendance(enrollmentId);
  const outstanding = await outstandingForEnrollment(enrollmentId);

  const checks: EligibilityCheck[] = [
    {
      key: 'completion',
      label: 'Enrollment completed',
      passed: enrollment.status === 'COMPLETED',
      detail:
        enrollment.status === 'COMPLETED'
          ? 'The enrollment is marked completed.'
          : `Current enrollment status is ${enrollment.status}.`,
    },
  ];

  if (settings.certificateRequireAttendance) {
    checks.push({
      key: 'attendance',
      label: 'Attendance threshold',
      passed: attendance.percentage >= settings.attendanceThresholdPercent,
      detail: `${attendance.percentage}% attendance against a required ${settings.attendanceThresholdPercent}%.`,
    });
  }

  if (settings.certificateRequireFullPayment) {
    checks.push({
      key: 'fees',
      label: 'Fees settled',
      passed: outstanding <= 0,
      detail: outstanding <= 0 ? 'No outstanding balance.' : `${outstanding / 100} outstanding on this enrollment.`,
    });
  }

  if (settings.certificateRequireAssessmentsPassed) {
    const assessments = await prisma.assessment.findMany({
      where: {
        status: 'PUBLISHED',
        courseId: enrollment.batch.courseId,
        OR: [{ batchId: null }, { batchId: enrollment.batchId }],
      },
      include: { results: { where: { enrollmentId } } },
    });
    const failed = assessments.filter((assessment) => {
      const result = assessment.results[0];
      return !result || result.status !== 'PASS';
    });
    checks.push({
      key: 'assessments',
      label: 'Assessments passed',
      passed: failed.length === 0,
      detail:
        failed.length === 0
          ? `${assessments.length} published assessment(s) passed or none required.`
          : `${failed.length} assessment(s) not passed: ${failed.map((assessment) => assessment.title).join(', ')}.`,
    });
  }

  const existing = await prisma.certificate.findFirst({
    where: { enrollmentId, status: 'ISSUED' },
    select: { id: true, certificateNumber: true, issuedAt: true },
  });

  return {
    enrollmentId,
    student: enrollment.student,
    courseTitle: enrollment.batch.course.title,
    batchCode: enrollment.batch.code,
    checks,
    eligible: checks.every((check) => check.passed),
    existingCertificate: existing,
  };
}

export async function issueCertificate(actor: ActorMeta, enrollmentId: string) {
  const eligibility = await getEligibility(enrollmentId);
  if (eligibility.existingCertificate) {
    throw conflict('An active certificate already exists for this enrollment.');
  }
  if (!eligibility.eligible) {
    const failed = eligibility.checks.filter((check) => !check.passed).map((check) => check.label);
    throw businessRule(`Certificate eligibility is not met: ${failed.join('; ')}.`);
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      student: { select: { fullName: true, studentNumber: true } },
      batch: {
        select: {
          code: true,
          startDate: true,
          endDate: true,
          course: { select: { title: true } },
        },
      },
    },
  });
  if (!enrollment) throw notFound('Enrollment not found.');

  const settings = await getSettings();
  const certificateId = randomUUID();
  const verificationCode = randomToken(18);
  const verificationUrl = `${env.APP_PUBLIC_URL}/verify-certificate/${verificationCode}`;

  const pdf = await buildCertificatePdf({
    instituteName: settings.instituteName,
    studentName: enrollment.student.fullName,
    courseTitle: enrollment.batch.course.title,
    batchCode: enrollment.batch.code,
    startedOn: enrollment.joinedAt,
    completedOn: enrollment.completedAt ?? new Date(),
    issuedOn: new Date(),
    certificateNumber: 'PENDING',
    verificationUrl,
    signatoryName: settings.signatoryName,
    signatoryTitle: settings.signatoryTitle,
    legalText: settings.certificateLegalText,
    logoStorageKey: settings.logoStorageKey,
  });

  const certificate = await prisma.$transaction(async (tx) => {
    const certificateNumber = await nextBusinessNumber(tx, 'certificate', settings.certificatePrefix);
    return tx.certificate.create({
      data: {
        id: certificateId,
        certificateNumber,
        verificationCode,
        enrollmentId,
        status: 'ISSUED',
        issuedById: actor.actorId,
        storageKey: `certificates/${certificateId}.pdf`,
        contentHash: sha256Buffer(Buffer.from(pdf)),
      },
    });
  });

  // Re-render with the final number, then persist the private file.
  const finalPdf = await buildCertificatePdf({
    instituteName: settings.instituteName,
    studentName: enrollment.student.fullName,
    courseTitle: enrollment.batch.course.title,
    batchCode: enrollment.batch.code,
    startedOn: enrollment.joinedAt,
    completedOn: enrollment.completedAt ?? new Date(),
    issuedOn: certificate.issuedAt,
    certificateNumber: certificate.certificateNumber,
    verificationUrl,
    signatoryName: settings.signatoryName,
    signatoryTitle: settings.signatoryTitle,
    legalText: settings.certificateLegalText,
    logoStorageKey: settings.logoStorageKey,
  });

  await storage.put(certificate.storageKey, Buffer.from(finalPdf), 'application/pdf');
  await prisma.certificate.update({
    where: { id: certificate.id },
    data: { contentHash: sha256Buffer(Buffer.from(finalPdf)) },
  });

  await recordAudit(prisma, {
    actorId: actor.actorId,
    actorRole: actor.actorRole,
    action: 'CERTIFICATE_ISSUED',
    entityType: 'Certificate',
    entityId: certificate.id,
    requestId: actor.requestId,
    ip: actor.ip,
    metadata: {
      certificateNumber: certificate.certificateNumber,
      studentNumber: enrollment.student.studentNumber,
      enrollmentId,
    },
  });

  return {
    id: certificate.id,
    certificateNumber: certificate.certificateNumber,
    verificationCode: certificate.verificationCode,
    status: certificate.status,
    issuedAt: certificate.issuedAt,
    courseTitle: enrollment.batch.course.title,
  };
}

export async function listCertificates(query: {
  page: number;
  pageSize: number;
  status?: CertificateStatus;
  studentId?: string;
  search?: string;
}) {
  const where = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.studentId ? { enrollment: { studentId: query.studentId } } : {}),
    ...(query.search
      ? {
          OR: [
            { certificateNumber: { contains: query.search, mode: 'insensitive' as const } },
            { enrollment: { student: { fullName: { contains: query.search, mode: 'insensitive' as const } } } },
            {
              enrollment: {
                student: { studentNumber: { contains: query.search, mode: 'insensitive' as const } },
              },
            },
          ],
        }
      : {}),
  };

  const [total, certificates] = await prisma.$transaction([
    prisma.certificate.count({ where }),
    prisma.certificate.findMany({
      where,
      include: {
        enrollment: {
          include: {
            student: { select: { id: true, studentNumber: true, fullName: true } },
            batch: { select: { code: true, name: true, course: { select: { title: true } } } },
          },
        },
        issuedBy: { select: { id: true, fullName: true } },
        revokedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { issuedAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return { items: certificates, total };
}

export async function getCertificate(certificateId: string) {
  const certificate = await prisma.certificate.findUnique({
    where: { id: certificateId },
    include: {
      enrollment: {
        include: {
          student: { select: { id: true, studentNumber: true, fullName: true } },
          batch: { select: { code: true, name: true, course: { select: { title: true } } } },
        },
      },
      issuedBy: { select: { id: true, fullName: true } },
      revokedBy: { select: { id: true, fullName: true } },
    },
  });
  if (!certificate) throw notFound('Certificate not found.');
  return certificate;
}

export async function revokeCertificate(actor: ActorMeta, certificateId: string, reason: string) {
  const certificate = await prisma.certificate.findUnique({ where: { id: certificateId } });
  if (!certificate) throw notFound('Certificate not found.');
  if (certificate.status === 'REVOKED') throw businessRule('This certificate is already revoked.');

  const updated = await prisma.certificate.update({
    where: { id: certificateId },
    data: {
      status: 'REVOKED',
      revokedAt: new Date(),
      revokedById: actor.actorId,
      revocationReason: reason,
    },
  });

  await recordAudit(prisma, {
    actorId: actor.actorId,
    actorRole: actor.actorRole,
    action: 'CERTIFICATE_REVOKED',
    entityType: 'Certificate',
    entityId: certificateId,
    requestId: actor.requestId,
    ip: actor.ip,
    metadata: { certificateNumber: certificate.certificateNumber, reason },
  });

  return updated;
}

export async function getCertificateFile(certificateId: string) {
  const certificate = await prisma.certificate.findUnique({ where: { id: certificateId } });
  if (!certificate) throw notFound('Certificate not found.');
  if (!(await storage.exists(certificate.storageKey))) {
    throw notFound('The certificate file is not available. Contact the institute administrator.');
  }
  const file = await storage.get(certificate.storageKey);
  return {
    buffer: file,
    filename: `${certificate.certificateNumber}.pdf`,
    certificate,
  };
}

export async function verifyCertificate(code: string) {
  const certificate = await prisma.certificate.findUnique({
    where: { verificationCode: code },
    include: {
      enrollment: {
        include: {
          student: { select: { fullName: true } },
          batch: { include: { course: { select: { title: true, code: true } } } },
        },
      },
    },
  });
  if (!certificate) throw notFound('No certificate matches this verification code.');

  const settings = await getSettings();

  return {
    certificateNumber: certificate.certificateNumber,
    status: certificate.status,
    courseTitle: certificate.enrollment.batch.course.title,
    courseCode: certificate.enrollment.batch.course.code,
    issuedAt: certificate.issuedAt,
    revokedAt: certificate.revokedAt,
    ...(settings.certificatePublicShowName ? { studentName: certificate.enrollment.student.fullName } : {}),
    instituteName: settings.instituteName,
  };
}
