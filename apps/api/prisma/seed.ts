/**
 * Deterministic development seed data. Never run against production.
 * All accounts are synthetic. Documented credentials live in the root README.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hash as argonHash } from '@node-rs/argon2';

const prisma = new PrismaClient();

const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

/** Asia/Karachi is UTC+5 all year. */
function atLocal(daysFromNow: number, hour: number, minute = 0): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysFromNow, hour - 5, minute, 0),
  );
}

function dateOnly(daysFromNow: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysFromNow));
}

async function reset(): Promise<void> {
  await prisma.attendanceRecord.deleteMany();
  await prisma.paymentReversal.deleteMany();
  await prisma.paymentAllocation.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.assessmentResult.deleteMany();
  await prisma.assessment.deleteMany();
  await prisma.certificate.deleteMany();
  await prisma.qrToken.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.classSession.deleteMany();
  await prisma.batchSchedule.deleteMany();
  await prisma.batch.deleteMany();
  await prisma.feePlanItem.deleteMany();
  await prisma.feePlan.deleteMany();
  await prisma.course.deleteMany();
  await prisma.instructor.deleteMany();
  await prisma.student.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.idempotencyRecord.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.authSession.deleteMany();
  await prisma.user.deleteMany();
  await prisma.counter.deleteMany();
}

async function main(): Promise<void> {
  await reset();

  const [adminHash, frontDeskHash, studentHash] = await Promise.all([
    argonHash('Admin#12345', ARGON),
    argonHash('Frontdesk#12345', ARGON),
    argonHash('Student#12345', ARGON),
  ]);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@institute.test',
      fullName: 'Ayesha Khan',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      passwordHash: adminHash,
    },
  });

  await prisma.user.create({
    data: {
      email: 'frontdesk@institute.test',
      fullName: 'Bilal Ahmed',
      role: 'FRONT_DESK',
      status: 'ACTIVE',
      passwordHash: frontDeskHash,
    },
  });

  await prisma.instituteSetting.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      instituteName: 'National Institute of Information Technology',
      shortName: 'NIIT',
      currency: 'PKR',
      timeZone: 'Asia/Karachi',
      addressLine: '2nd Floor, PECHS Block 6, Karachi',
      phone: '+92 21 3456 7890',
      email: 'info@niit.test',
      signatoryName: 'Dr. Imran Siddiqui',
      signatoryTitle: 'Director, NIIT',
      certificateLegalText:
        'This certificate confirms successful completion of the stated programme and is verifiable at the institute verification portal.',
    },
    update: {},
  });

  const instructorA = await prisma.instructor.create({
    data: {
      fullName: 'Sana Malik',
      email: 'sana.malik@niit.test',
      phone: '+92 300 1112233',
      specialization: 'Full-stack web development',
    },
  });
  const instructorB = await prisma.instructor.create({
    data: {
      fullName: 'Hamza Raza',
      email: 'hamza.raza@niit.test',
      phone: '+92 300 4455667',
      specialization: 'Design and data fundamentals',
    },
  });

  const webCourse = await prisma.course.create({
    data: {
      code: 'WEB-101',
      title: 'Full-Stack Web Development',
      description: 'Modern JavaScript, React, Node.js and PostgreSQL for production web applications.',
      durationValue: 12,
      durationUnit: 'WEEKS',
      defaultFeeMinor: 6_000_000,
      status: 'ACTIVE',
    },
  });
  const designCourse = await prisma.course.create({
    data: {
      code: 'GD-201',
      title: 'Graphic Design Essentials',
      description: 'Design foundations, typography, and brand systems with industry tools.',
      durationValue: 8,
      durationUnit: 'WEEKS',
      defaultFeeMinor: 4_500_000,
      status: 'ACTIVE',
    },
  });
  const pythonCourse = await prisma.course.create({
    data: {
      code: 'PY-101',
      title: 'Python Programming',
      description: 'Programming fundamentals, automation and data handling with Python.',
      durationValue: 10,
      durationUnit: 'WEEKS',
      defaultFeeMinor: 5_500_000,
      status: 'ACTIVE',
    },
  });

  const webBatch = await prisma.batch.create({
    data: {
      courseId: webCourse.id,
      instructorId: instructorA.id,
      code: 'WEB-2026-A',
      name: 'Web Development — Morning A',
      startDate: dateOnly(-30),
      endDate: dateOnly(60),
      capacity: 25,
      status: 'ACTIVE',
    },
  });
  const designBatch = await prisma.batch.create({
    data: {
      courseId: designCourse.id,
      instructorId: instructorB.id,
      code: 'GD-2026-A',
      name: 'Graphic Design — Evening A',
      startDate: dateOnly(-14),
      endDate: dateOnly(45),
      capacity: 20,
      status: 'ACTIVE',
    },
  });
  await prisma.batch.create({
    data: {
      courseId: pythonCourse.id,
      instructorId: instructorB.id,
      code: 'PY-2026-A',
      name: 'Python — Weekend A',
      startDate: dateOnly(14),
      endDate: dateOnly(90),
      capacity: 20,
      status: 'PLANNED',
    },
  });

  await prisma.batchSchedule.createMany({
    data: [
      { batchId: webBatch.id, dayOfWeek: 1, startTime: '09:00', endTime: '12:00', room: 'Lab 1' },
      { batchId: webBatch.id, dayOfWeek: 3, startTime: '09:00', endTime: '12:00', room: 'Lab 1' },
      { batchId: webBatch.id, dayOfWeek: 5, startTime: '09:00', endTime: '12:00', room: 'Lab 1' },
      { batchId: designBatch.id, dayOfWeek: 2, startTime: '18:00', endTime: '20:30', room: 'Studio 2' },
      { batchId: designBatch.id, dayOfWeek: 4, startTime: '18:00', endTime: '20:30', room: 'Studio 2' },
    ],
  });

  const studentSeeds = [
    { name: 'Fatima Noor', guardian: 'Noor Ahmed', email: 'fatima.noor@student.test', phone: '+92 300 1000001', account: true },
    { name: 'Ali Hassan', guardian: 'Hassan Ali', email: 'ali.hassan@student.test', phone: '+92 300 1000002', account: true },
    { name: 'Zainab Qureshi', guardian: 'Qureshi Imran', email: 'zainab.qureshi@student.test', phone: '+92 300 1000003', account: false },
    { name: 'Usman Tariq', guardian: 'Tariq Mehmood', email: 'usman.tariq@student.test', phone: '+92 300 1000004', account: false },
    { name: 'Maryam Shah', guardian: 'Shahid Ali', email: 'maryam.shah@student.test', phone: '+92 300 1000005', account: false },
    { name: 'Bilal Zafar', guardian: 'Zafar Iqbal', email: 'bilal.zafar@student.test', phone: '+92 300 1000006', account: false },
  ];

  const students = [];
  for (let index = 0; index < studentSeeds.length; index += 1) {
    const seed = studentSeeds[index]!;
    const user = seed.account
      ? await prisma.user.create({
          data: {
            email: seed.email,
            fullName: seed.name,
            role: 'STUDENT',
            status: 'ACTIVE',
            passwordHash: studentHash,
          },
        })
      : null;

    students.push(
      await prisma.student.create({
        data: {
          userId: user?.id ?? null,
          studentNumber: `STU-2026-${String(index + 1).padStart(6, '0')}`,
          fullName: seed.name,
          guardianName: seed.guardian,
          phone: seed.phone,
          email: seed.email,
          address: `${index + 10} Shahrah-e-Faisal, Karachi`,
          dateOfBirth: dateOnly(-365 * (20 + index)),
          admissionDate: dateOnly(-40 + index),
          status: 'ACTIVE',
          createdById: admin.id,
        },
      }),
    );
  }

  const enrollments = [];
  const enrollmentPlan = [
    { student: 0, batch: webBatch.id, fee: 6_000_000, status: 'ACTIVE' as const },
    { student: 1, batch: webBatch.id, fee: 5_500_000, status: 'ACTIVE' as const },
    { student: 2, batch: designBatch.id, fee: 4_500_000, status: 'ACTIVE' as const },
    { student: 3, batch: webBatch.id, fee: 6_000_000, status: 'COMPLETED' as const },
    { student: 4, batch: designBatch.id, fee: 4_200_000, status: 'ACTIVE' as const },
  ];

  for (const plan of enrollmentPlan) {
    const student = students[plan.student]!;
    enrollments.push(
      await prisma.enrollment.create({
        data: {
          studentId: student.id,
          batchId: plan.batch,
          joinedAt: dateOnly(-30),
          status: plan.status,
          agreedFeeMinor: plan.fee,
          ...(plan.status === 'COMPLETED' ? { completedAt: dateOnly(-1) } : {}),
        },
      }),
    );
  }

  const finalisedHistory = [
    { days: -21, topic: 'Environment setup and Git workflow' },
    { days: -16, topic: 'HTML, CSS and responsive layout' },
    { days: -9, topic: 'React components and state' },
    { days: -3, topic: 'REST APIs with Express' },
  ];

  for (const entry of finalisedHistory) {
    const session = await prisma.classSession.create({
      data: {
        batchId: webBatch.id,
        startsAt: atLocal(entry.days, 9),
        endsAt: atLocal(entry.days, 12),
        status: 'FINALIZED',
        topic: entry.topic,
        openedById: admin.id,
        openedAt: atLocal(entry.days, 8, 45),
        finalizedById: admin.id,
        finalizedAt: atLocal(entry.days, 12, 5),
      },
    });

    const webEnrollments = enrollments.filter((enrollment) => enrollment.batchId === webBatch.id);
    for (let index = 0; index < webEnrollments.length; index += 1) {
      const enrollment = webEnrollments[index]!;
      const status = index === 0 ? 'PRESENT' : index === 1 ? 'LATE' : 'ABSENT';
      await prisma.attendanceRecord.create({
        data: {
          sessionId: session.id,
          enrollmentId: enrollment.id,
          status,
          method: index === 0 ? 'QR' : 'MANUAL',
          markedById: admin.id,
          markedAt: atLocal(entry.days, 9, 10),
        },
      });
    }
  }

  for (const days of [-7, -2]) {
    const session = await prisma.classSession.create({
      data: {
        batchId: designBatch.id,
        startsAt: atLocal(days, 18),
        endsAt: atLocal(days, 20, 30),
        status: 'FINALIZED',
        topic: 'Typography and layout systems',
        openedById: admin.id,
        openedAt: atLocal(days, 17, 50),
        finalizedById: admin.id,
        finalizedAt: atLocal(days, 20, 35),
      },
    });
    const designEnrollments = enrollments.filter((enrollment) => enrollment.batchId === designBatch.id);
    for (const enrollment of designEnrollments) {
      await prisma.attendanceRecord.create({
        data: {
          sessionId: session.id,
          enrollmentId: enrollment.id,
          status: 'PRESENT',
          markedById: admin.id,
        },
      });
    }
  }

  const openSession = await prisma.classSession.create({
    data: {
      batchId: webBatch.id,
      startsAt: atLocal(0, 9),
      endsAt: atLocal(0, 12),
      status: 'OPEN',
      topic: 'Authentication and sessions',
      openedById: admin.id,
      openedAt: atLocal(0, 8, 45),
    },
  });

  await prisma.classSession.create({
    data: {
      batchId: webBatch.id,
      startsAt: atLocal(2, 9),
      endsAt: atLocal(2, 12),
      status: 'SCHEDULED',
      topic: 'Database modelling with Prisma',
    },
  });

  const cancelled = await prisma.classSession.create({
    data: {
      batchId: webBatch.id,
      startsAt: atLocal(-5, 9),
      endsAt: atLocal(-5, 12),
      status: 'CANCELLED',
      topic: 'Public holiday',
      cancelledById: admin.id,
      cancelledAt: atLocal(-6, 10),
    },
  });
  void cancelled;
  void openSession;

  await prisma.feePlan.create({
    data: {
      name: 'Web Development — 2 installments',
      courseId: webCourse.id,
      currency: 'PKR',
      totalFeeMinor: 6_000_000,
      installmentCount: 2,
      description: 'Fifty percent at admission and fifty percent by week six.',
      items: {
        create: [
          { description: 'Admission and registration', amountMinor: 500_000, sequence: 1 },
          { description: 'Tuition — installment 1', amountMinor: 2_500_000, sequence: 2 },
          { description: 'Tuition — installment 2', amountMinor: 3_000_000, sequence: 3 },
        ],
      },
    },
  });

  let invoiceSequence = 0;
  for (const enrollment of enrollments) {
    for (let part = 0; part < 2; part += 1) {
      invoiceSequence += 1;
      const half = Math.floor(enrollment.agreedFeeMinor / 2);
      const total = part === 0 ? enrollment.agreedFeeMinor - half : half;
      const subtotal = total + 200_000;
      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber: `INV-2026-${String(invoiceSequence).padStart(6, '0')}`,
          enrollmentId: enrollment.id,
          issuedAt: dateOnly(part === 0 ? -30 : -10),
          dueAt: dateOnly(part === 0 ? -20 : 15),
          currency: 'PKR',
          subtotalMinor: subtotal,
          discountMinor: 200_000,
          totalMinor: total,
          status: 'ISSUED',
          createdById: admin.id,
          items: {
            create: [
              {
                description: part === 0 ? 'Admission and registration' : 'Tuition — installment 2',
                quantity: 1,
                unitAmountMinor: subtotal,
                lineTotalMinor: subtotal,
                itemType: part === 0 ? 'ADMISSION' : 'TUITION',
              },
            ],
          },
        },
      });

      if (part === 0) {
        const payFull = enrollment.studentId === students[0]?.id;
        const payPartial = enrollment.studentId === students[1]?.id;
        if (payFull || payPartial) {
          const amount = payFull ? total : Math.floor(total / 2);
          await prisma.$transaction(async (tx) => {
            const payment = await tx.payment.create({
              data: {
                paymentNumber: `RCPT-2026-${String(invoiceSequence).padStart(6, '0')}`,
                invoiceId: invoice.id,
                amountMinor: amount,
                currency: 'PKR',
                method: payFull ? 'CASH' : 'BANK_TRANSFER',
                reference: payFull ? null : 'TRX-SEED-0001',
                receivedById: admin.id,
              },
            });
            await tx.paymentAllocation.create({
              data: { paymentId: payment.id, invoiceId: invoice.id, allocatedAmountMinor: amount },
            });
            await tx.invoice.update({
              where: { id: invoice.id },
              data: {
                status: amount >= total ? 'PAID' : amount > 0 ? 'PARTIALLY_PAID' : 'ISSUED',
              },
            });
          });
        }
      }
    }
  }

  const quiz = await prisma.assessment.create({
    data: {
      courseId: webCourse.id,
      batchId: webBatch.id,
      title: 'JavaScript fundamentals',
      maxMarks: 100,
      passMarks: 50,
      assessmentDate: dateOnly(-7),
      status: 'PUBLISHED',
    },
  });
  const project = await prisma.assessment.create({
    data: {
      courseId: webCourse.id,
      batchId: webBatch.id,
      title: 'Capstone project',
      maxMarks: 100,
      passMarks: 60,
      assessmentDate: dateOnly(-1),
      status: 'PUBLISHED',
    },
  });

  const webEnrollments = enrollments.filter((enrollment) => enrollment.batchId === webBatch.id);
  for (let index = 0; index < webEnrollments.length; index += 1) {
    const enrollment = webEnrollments[index]!;
    await prisma.assessmentResult.createMany({
      data: [
        {
          assessmentId: quiz.id,
          enrollmentId: enrollment.id,
          marksObtained: 82 - index * 12,
          status: 82 - index * 12 >= 50 ? 'PASS' : 'FAIL',
          recordedById: admin.id,
          recordedAt: atLocal(-6, 14),
        },
        {
          assessmentId: project.id,
          enrollmentId: enrollment.id,
          marksObtained: 88 - index * 15,
          status: 88 - index * 15 >= 60 ? 'PASS' : 'FAIL',
          recordedById: admin.id,
          recordedAt: atLocal(0, 14),
        },
      ],
    });
  }

  await prisma.announcement.createMany({
    data: [
      {
        title: 'Mid-term assessment schedule published',
        body: 'The mid-term assessment timetable for all active batches is now available. Please check your batch schedule and arrive fifteen minutes early.',
        audience: 'STUDENTS',
        status: 'PUBLISHED',
        publishedAt: atLocal(-2, 10),
        createdById: admin.id,
      },
      {
        title: 'Institute closed for maintenance on Friday',
        body: 'Labs and offices will close at 1:00 PM this Friday for scheduled maintenance. Evening batches will run online as communicated by your instructor.',
        audience: 'EVERYONE',
        status: 'PUBLISHED',
        publishedAt: atLocal(-1, 16),
        createdById: admin.id,
      },
    ],
  });

  const firstStudentUser = students[0]?.userId;
  if (firstStudentUser) {
    await prisma.notification.createMany({
      data: [
        {
          userId: firstStudentUser,
          type: 'FEE_DUE',
          title: 'Installment due soon',
          body: 'Your second installment is due in 15 days. Visit the fees section for details.',
          link: '/student/fees',
          createdAt: atLocal(-1, 9),
        },
        {
          userId: firstStudentUser,
          type: 'ANNOUNCEMENT',
          title: 'Mid-term assessment schedule published',
          body: 'The mid-term assessment timetable for your batch is now available.',
          link: '/student/announcements',
          readAt: atLocal(0, 8),
          createdAt: atLocal(-2, 10),
        },
      ],
    });
  }

  // Align business-number counters with the seeded identifiers so new records
  // never collide with seeded ones.
  const year = new Date().getUTCFullYear();
  const counters: Array<[string, number]> = [
    [`student:${year}`, students.length],
    [`invoice:${year}`, invoiceSequence],
    [`receipt:${year}`, invoiceSequence],
    [`certificate:${year}`, 0],
  ];
  for (const [name, value] of counters) {
    await prisma.counter.upsert({
      where: { name },
      create: { name, value },
      update: { value },
    });
  }

  console.log('Seed complete.');
  console.log('  Super Admin : admin@institute.test / Admin#12345');
  console.log('  Front Desk  : frontdesk@institute.test / Frontdesk#12345');
  console.log('  Student     : fatima.noor@student.test / Student#12345');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
