const base = 'http://127.0.0.1:4000/api/v1';
let cookies = new Map();

function cookieHeader() {
  return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

function storeCookies(response) {
  for (const raw of response.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(';');
    const index = pair.indexOf('=');
    cookies.set(pair.slice(0, index), pair.slice(index + 1));
  }
}

async function call(method, path, body, extraHeaders = {}) {
  const csrf = cookies.get('lms_csrf');
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(cookies.size ? { cookie: cookieHeader() } : {}),
      ...(csrf ? { 'x-csrf-token': csrf } : {}),
      ...extraHeaders,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  storeCookies(response);
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('json')) {
    const buffer = await response.arrayBuffer();
    return { status: response.status, body: { bytes: buffer.byteLength }, headers: response.headers };
  }
  return { status: response.status, body: await response.json(), headers: response.headers };
}

async function login(email, password) {
  cookies = new Map();
  await call('GET', '/auth/csrf');
  const result = await call('POST', '/auth/login', { email, password });
  console.log(`login ${email}:`, result.status, result.body?.data?.user?.role ?? result.body?.error?.code);
  return result;
}

await login('admin@institute.test', 'Admin#12345');

const students = await call('GET', '/students?pageSize=3');
console.log('students:', students.status, students.body.meta?.total, students.body.data?.[0]?.studentNumber);

const courses = await call('GET', '/courses');
console.log('courses:', courses.status, courses.body.data?.length);

const batches = await call('GET', '/batches');
console.log('batches:', batches.status, batches.body.data?.length, batches.body.data?.[0]?.enrolledCount);

const sessions = await call('GET', '/attendance/sessions?pageSize=5');
console.log('sessions:', sessions.status, sessions.body.meta?.total);
const openSession = sessions.body.data?.find((s) => s.status === 'OPEN');
console.log('open session:', openSession?.id, openSession?.batch?.code);

const student = students.body.data?.[0];
const manual = await call('POST', '/attendance/manual', {
  sessionId: openSession?.id,
  studentNumber: student?.studentNumber,
  status: 'PRESENT',
});
console.log(
  'manual attendance:',
  manual.status,
  manual.body?.data?.record?.status ?? manual.body?.error?.code,
  manual.body?.error?.message ?? '',
);

const duplicate = await call('POST', '/attendance/manual', {
  sessionId: openSession?.id,
  studentNumber: student?.studentNumber,
  status: 'PRESENT',
});
console.log('duplicate attendance:', duplicate.status, duplicate.body?.error?.code);

const invoice = await call('POST', '/invoices', {
  enrollmentId: students.body.data?.[0]?.id ? undefined : undefined,
  dueAt: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
  items: [{ description: 'Verification fee', quantity: 1, unitAmountMinor: 500000, itemType: 'TUITION' }],
});
console.log('invoice without enrollment:', invoice.status, invoice.body?.error?.code);

const enrollments = await call('GET', '/enrollments?pageSize=2');
console.log('enrollments:', enrollments.status, enrollments.body.meta?.total);
const enrollmentId = enrollments.body.data?.[0]?.id;

const newInvoice = await call('POST', '/invoices', {
  enrollmentId,
  dueAt: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
  items: [{ description: 'Verification fee', quantity: 1, unitAmountMinor: 500000, itemType: 'TUITION' }],
});
console.log('invoice created:', newInvoice.status, newInvoice.body?.data?.invoiceNumber, newInvoice.body?.data?.totalMinor);
const invoiceId = newInvoice.body?.data?.id;

const idempotencyKey = `verify-${Date.now()}`;
const paymentBody = { invoiceId, amountMinor: 200000, method: 'CASH' };
const payment = await call('POST', '/payments', paymentBody, { 'Idempotency-Key': idempotencyKey });
console.log('payment:', payment.status, payment.body?.data?.paymentNumber, payment.body?.error?.message ?? '');
const replay = await call('POST', '/payments', paymentBody, { 'Idempotency-Key': idempotencyKey });
console.log('payment replay:', replay.status, replay.headers.get('idempotent-replayed'), replay.body?.data?.paymentNumber);
const conflict = await call('POST', '/payments', { ...paymentBody, amountMinor: 300000 }, {
  'Idempotency-Key': idempotencyKey,
});
console.log('idempotency conflict:', conflict.status, conflict.body?.error?.code);

const overpay = await call('POST', '/payments', { invoiceId, amountMinor: 999999, method: 'CASH' }, {
  'Idempotency-Key': `overpay-${Date.now()}`,
});
console.log('overpayment rejected:', overpay.status, overpay.body?.error?.code);

const receipt = await call('GET', `/payments/${payment.body?.data?.id}/receipt`);
console.log('receipt pdf bytes:', receipt.status, receipt.body?.bytes);

const invoiceDetail = await call('GET', `/invoices/${invoiceId}`);
console.log(
  'invoice balance:',
  invoiceDetail.status,
  invoiceDetail.body?.data?.paidMinor,
  invoiceDetail.body?.data?.outstandingMinor,
  invoiceDetail.body?.data?.status,
);

const enrollment = await call('GET', `/enrollments/${enrollmentId}`);
console.log(
  'enrollment attendance:',
  enrollment.status,
  JSON.stringify(enrollment.body?.data?.attendance ?? enrollment.body?.error?.code),
);

const ledger = await call('GET', `/students/${students.body.data?.[0]?.id}/fee-ledger`);
console.log('ledger:', ledger.status, ledger.body?.data?.summary);

const eligibility = await call('GET', `/certificates/eligibility/${enrollmentId}`);
console.log(
  'certificate eligibility:',
  eligibility.status,
  eligibility.body?.data?.eligible,
  eligibility.body?.data?.checks?.map((c) => `${c.key}:${c.passed}`).join(','),
);

const verify = await call('GET', '/public/certificates/verify/does-not-exist-token');
console.log('public verify unknown:', verify.status, verify.body?.error?.code);

const settings = await call('PATCH', '/settings', { instituteName: 'National Institute of Information Technology' });
console.log('settings update:', settings.status);

const users = await call('GET', '/users');
console.log('users:', users.status, users.body.meta?.total);

await login('frontdesk@institute.test', 'Frontdesk#12345');
const fdCertRevoke = await call('POST', `/certificates/00000000-0000-0000-0000-000000000000/revoke`, { reason: 'testing' });
console.log('front desk revoke certificate (403/404):', fdCertRevoke.status, fdCertRevoke.body?.error?.code);
const fdCollections = await call('GET', '/reports/fees/collections');
console.log('front desk collections (403):', fdCollections.status, fdCollections.body?.error?.code);
const fdPayments = await call('GET', '/payments?pageSize=5');
console.log('front desk payments:', fdPayments.status, fdPayments.body?.meta?.total);

await login('fatima.noor@student.test', 'Student#12345');
const profile = await call('GET', '/me/profile');
console.log('student profile:', profile.status, profile.body?.data?.studentNumber);
const meFees = await call('GET', '/me/fees');
console.log('student fees:', meFees.status, meFees.body?.data?.summary?.outstandingMinor);
const qr = await call('POST', '/me/attendance/qr');
console.log('student qr:', qr.status, Boolean(qr.body?.data?.token));
const adminUsers = await call('GET', '/users');
console.log('student users endpoint (403):', adminUsers.status, adminUsers.body?.error?.code);
const otherId = '00000000-0000-0000-0000-000000000000';
const foreignCert = await call('GET', `/me/certificates/${otherId}/download`);
console.log('foreign certificate (404):', foreignCert.status, foreignCert.body?.error?.code);
const overview = await call('GET', '/me/overview');
console.log('student overview:', overview.status, overview.body?.data?.attendance?.percentage);
