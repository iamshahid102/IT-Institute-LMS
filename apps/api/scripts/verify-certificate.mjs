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

async function call(method, path, body) {
  const csrf = cookies.get('lms_csrf');
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(cookies.size ? { cookie: cookieHeader() } : {}),
      ...(csrf ? { 'x-csrf-token': csrf } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  storeCookies(response);
  const type = response.headers.get('content-type') ?? '';
  if (!type.includes('json')) return { status: response.status, bytes: (await response.arrayBuffer()).byteLength };
  return { status: response.status, body: await response.json() };
}

cookies = new Map();
await call('GET', '/auth/csrf');
await call('POST', '/auth/login', { email: 'admin@institute.test', password: 'Admin#12345' });

await call('PATCH', '/settings', { certificateRequireAttendance: false, certificateRequireFullPayment: false });

const enrollments = await call('GET', '/enrollments?status=COMPLETED&pageSize=5');
const enrollment = enrollments.body?.data?.[0];
console.log('completed enrollment:', enrollments.status, enrollment?.id, enrollment?.student?.fullName);

const eligibility = await call('GET', `/certificates/eligibility/${enrollment.id}`);
console.log('eligible:', eligibility.body?.data?.eligible, eligibility.body?.data?.checks?.map((c) => c.key));

const issued = await call('POST', '/certificates/issue', { enrollmentId: enrollment.id });
console.log('issue:', issued.status, issued.body?.data?.certificateNumber, issued.body?.error?.message ?? '');
const certificateId = issued.body?.data?.id;

const duplicate = await call('POST', '/certificates/issue', { enrollmentId: enrollment.id });
console.log('duplicate issue:', duplicate.status, duplicate.body?.error?.code);

const download = await call('GET', `/certificates/${certificateId}/download`);
console.log('download pdf bytes:', download.status, download.bytes);

const code = issued.body?.data?.verificationCode;
const verify = await call('GET', `/public/certificates/verify/${code}`);
console.log('public verify:', verify.status, verify.body?.data?.status, verify.body?.data?.studentName, verify.body?.data?.courseTitle);

const revoke = await call('POST', `/certificates/${certificateId}/revoke`, { reason: 'Issued against the wrong enrollment.' });
console.log('revoke:', revoke.status, revoke.body?.data?.status ?? revoke.body?.error?.message);

const verifyRevoked = await call('GET', `/public/certificates/verify/${code}`);
console.log('verify after revoke:', verifyRevoked.status, verifyRevoked.body?.data?.status, verifyRevoked.body?.data?.revokedAt);

// Student download of own certificate must work for issued certificates, and be blocked once revoked.
cookies = new Map();
await call('GET', '/auth/csrf');
await call('POST', '/auth/login', { email: 'usman.tariq@student.test', password: 'Student#12345' });

await call('PATCH', '/settings', { certificatePublicShowName: false });
const reissue = await (async () => {
  cookies = new Map();
  await call('GET', '/auth/csrf');
  await call('POST', '/auth/login', { email: 'admin@institute.test', password: 'Admin#12345' });
  const again = await call('POST', '/certificates/issue', { enrollmentId: enrollment.id });
  console.log('reissue after revoke:', again.status, again.body?.data?.certificateNumber);
  return again.body?.data;
})();

cookies = new Map();
await call('GET', '/auth/csrf');
await call('POST', '/auth/login', { email: 'usman.tariq@student.test', password: 'Student#12345' });
const own = await call('GET', `/me/certificates/${reissue?.id}/download`);
console.log('student own download:', own.status, own.bytes);
const foreign = await call('GET', `/me/certificates/${certificateId}/download`);
console.log('student foreign/revoked download:', foreign.status, foreign.body?.error?.code ?? foreign.bytes);
