/**
 * Attendance policy resolution.
 *
 * Eligible sessions are FINALIZED, non-cancelled class sessions of the enrollment's
 * batch that fall inside the enrollment's active window. Sessions an eligible student
 * has no record for are counted as absent, so unmarked students cannot inflate a
 * percentage. `ABSENT` always counts in the denominator; `EXCUSED` is waived when
 * `excusedCountsInDenominator` is false; `LATE` counts as present only when
 * `lateCountsAsPresent` is true.
 */
export interface AttendancePolicy {
  lateCountsAsPresent: boolean;
  excusedCountsInDenominator: boolean;
}

export interface AttendanceCounts {
  present: number;
  absent: number;
  late: number;
  excused: number;
}

export interface AttendanceSummary extends AttendanceCounts {
  eligibleSessions: number;
  countedPresent: number;
  denominator: number;
  percentage: number;
}

export const DEFAULT_ATTENDANCE_POLICY: AttendancePolicy = {
  lateCountsAsPresent: false,
  excusedCountsInDenominator: false,
};

export function computeAttendance(counts: AttendanceCounts, policy: AttendancePolicy): AttendanceSummary {
  const present = Math.max(0, counts.present);
  const absent = Math.max(0, counts.absent);
  const late = Math.max(0, counts.late);
  const excused = Math.max(0, counts.excused);
  const eligibleSessions = present + absent + late + excused;
  const denominator = Math.max(0, eligibleSessions - (policy.excusedCountsInDenominator ? 0 : excused));
  const countedPresent = present + (policy.lateCountsAsPresent ? late : 0);
  const percentage = denominator === 0 ? 0 : Math.round((countedPresent / denominator) * 1000) / 10;

  return {
    present,
    absent,
    late,
    excused,
    eligibleSessions,
    countedPresent,
    denominator,
    percentage,
  };
}

export function isAttendanceEligibleStatus(status: string): boolean {
  return status === 'FINALIZED';
}
