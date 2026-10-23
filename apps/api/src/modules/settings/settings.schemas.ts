import { z } from 'zod';

export const updateSettingsSchema = z
  .object({
    instituteName: z.string().trim().min(2, 'Enter the institute name.').max(160).optional(),
    shortName: z.string().trim().max(40).optional(),
    currency: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/, 'Use a three-letter ISO currency code.')
      .optional(),
    timeZone: z
      .string()
      .trim()
      .min(1)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat('en-US', { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }, 'Enter a valid IANA time zone, for example Asia/Karachi.')
      .optional(),
    addressLine: z.string().trim().max(240).optional(),
    phone: z.string().trim().max(40).optional(),
    email: z.union([z.literal(''), z.email('Enter a valid email address.')]).optional(),
    lateCountsAsPresent: z.boolean().optional(),
    excusedCountsInDenominator: z.boolean().optional(),
    attendanceThresholdPercent: z.coerce
      .number()
      .int()
      .min(0)
      .max(100)
      .optional(),
    certificateRequireFullPayment: z.boolean().optional(),
    certificateRequireAttendance: z.boolean().optional(),
    certificateRequireAssessmentsPassed: z.boolean().optional(),
    certificatePublicShowName: z.boolean().optional(),
    receiptPrefix: z
      .string()
      .trim()
      .regex(/^[A-Z]{2,10}$/, 'Use 2-10 uppercase letters.')
      .optional(),
    certificatePrefix: z
      .string()
      .trim()
      .regex(/^[A-Z]{2,10}$/, 'Use 2-10 uppercase letters.')
      .optional(),
    signatoryName: z.string().trim().max(120).optional(),
    signatoryTitle: z.string().trim().max(120).optional(),
    certificateLegalText: z.string().trim().max(600).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'No settings were supplied.' });
