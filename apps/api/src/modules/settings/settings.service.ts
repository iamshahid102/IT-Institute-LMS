import { prisma } from '../../lib/prisma';

export const DEFAULT_SETTINGS = {
  instituteName: 'IT Institute',
  currency: 'PKR',
  timeZone: 'Asia/Karachi',
  lateCountsAsPresent: false,
  excusedCountsInDenominator: false,
  attendanceThresholdPercent: 75,
  certificateRequireFullPayment: true,
  certificateRequireAttendance: true,
  certificateRequireAssessmentsPassed: false,
  certificatePublicShowName: true,
  receiptPrefix: 'RCPT',
  certificatePrefix: 'CERT',
} as const;

export async function getSettings() {
  return prisma.instituteSetting.upsert({
    where: { id: 'default' },
    create: { id: 'default', ...DEFAULT_SETTINGS },
    update: {},
  });
}

export function attendancePolicyFrom(settings: {
  lateCountsAsPresent: boolean;
  excusedCountsInDenominator: boolean;
}) {
  return {
    lateCountsAsPresent: settings.lateCountsAsPresent,
    excusedCountsInDenominator: settings.excusedCountsInDenominator,
  };
}
