import { describe, expect, it } from 'vitest';
import { computeAttendance } from '@lms/shared';

const base = { present: 10, absent: 2, late: 1, excused: 1 };

describe('computeAttendance', () => {
  it('excludes late and excused sessions from the counted attendance by default', () => {
    const summary = computeAttendance(base, {
      lateCountsAsPresent: false,
      excusedCountsInDenominator: false,
    });

    expect(summary.eligibleSessions).toBe(14);
    expect(summary.denominator).toBe(13);
    expect(summary.countedPresent).toBe(10);
    expect(summary.percentage).toBe(76.9);
  });

  it('counts late as present when the institute policy says so', () => {
    const summary = computeAttendance(base, {
      lateCountsAsPresent: true,
      excusedCountsInDenominator: false,
    });

    expect(summary.countedPresent).toBe(11);
    expect(summary.percentage).toBe(84.6);
  });

  it('includes excused sessions in the denominator when configured', () => {
    const summary = computeAttendance(base, {
      lateCountsAsPresent: false,
      excusedCountsInDenominator: true,
    });

    expect(summary.denominator).toBe(14);
    expect(summary.percentage).toBe(71.4);
  });

  it('returns zero instead of dividing by zero when nothing counts', () => {
    const summary = computeAttendance(
      { present: 0, absent: 0, late: 0, excused: 3 },
      { lateCountsAsPresent: false, excusedCountsInDenominator: false },
    );

    expect(summary.denominator).toBe(0);
    expect(summary.percentage).toBe(0);
    expect(Number.isNaN(summary.percentage)).toBe(false);
  });

  it('reports 100% when every eligible session was attended', () => {
    const summary = computeAttendance(
      { present: 8, absent: 0, late: 0, excused: 0 },
      { lateCountsAsPresent: false, excusedCountsInDenominator: false },
    );

    expect(summary.percentage).toBe(100);
    expect(summary.eligibleSessions).toBe(8);
  });

  it('treats unmarked sessions as absent so they cannot inflate the percentage', () => {
    const summary = computeAttendance(
      { present: 3, absent: 1, late: 0, excused: 0 },
      { lateCountsAsPresent: false, excusedCountsInDenominator: false },
    );

    expect(summary.percentage).toBe(75);
  });

  it('ignores negative counts from corrupt input', () => {
    const summary = computeAttendance(
      { present: -2, absent: 2, late: -1, excused: -1 },
      { lateCountsAsPresent: true, excusedCountsInDenominator: false },
    );

    expect(summary.eligibleSessions).toBe(2);
    expect(summary.countedPresent).toBe(0);
    expect(summary.percentage).toBe(0);
  });
});
