# Security, Privacy, and Operational Controls

**Version:** 0.1 — Mandatory engineering baseline

## 1. Security model

Assume that browser input can be manipulated. The Express API and database constraints are the trust boundary. Every protected request must authenticate the actor, authorize the action, validate inputs, and verify access to the specific record.

## 2. Authentication

- Hash passwords using Argon2id or another approved modern password hashing method.
- Use generic login and password-reset responses to reduce account enumeration.
- Apply rate limits and progressive abuse controls to login and reset endpoints.
- Prefer server-side sessions with opaque random identifiers stored in secure cookies for this application, unless a documented reason supports another model.
- Cookie settings: `HttpOnly`, `Secure` in production, appropriate `SameSite`, restricted path/domain.
- Implement CSRF protection for cookie-authenticated state-changing requests.
- Rotate/invalidate sessions after password changes, account suspension, and relevant security events.
- Expire sessions and support logout/revocation.
- Do not store access tokens or session identifiers in localStorage.
- Never log passwords, reset tokens, raw QR tokens, cookies, or authorization headers.

## 3. Authorization

- Implement a central permission policy, not scattered role-name checks alone.
- Suggested permissions include `student.read`, `student.create`, `student.update`, `student.archive`, `attendance.mark`, `attendance.correct`, `fee.receive`, `fee.reverse`, `certificate.issue`, `certificate.revoke`, `report.financial.read`, `user.manage`, `settings.manage`, and `audit.read`.
- Front Desk permissions are limited to operational needs.
- Student endpoints derive the current student from authenticated identity.
- Verify record ownership on every student-facing detail/download endpoint.
- Return 404 instead of 403 where revealing resource existence would create a privacy issue.
- Test direct API calls; hiding buttons is not a security control.

## 4. Data protection

- Use HTTPS end-to-end in production.
- Keep database and storage private; no direct public database access.
- Use least-privilege database credentials and separate dev/test/prod environments.
- Keep secrets in hosting secret managers/environment configuration.
- Define which student fields are mandatory and why they are collected.
- Collect the minimum personal data needed by the institute.
- Define retention, archival, correction, and deletion procedures with institute policy and applicable law.
- Do not expose student contact details or financial information on public certificate verification.
- Do not place personal/financial data inside QR codes.
- Avoid personal data in analytics events, URLs, and error reports.

## 5. File and PDF security

- Store certificates and uploaded documents in private object storage.
- Validate file type, size, and content where uploads are supported.
- Generate storage keys server-side; do not trust client filenames.
- Authorize each download or use a short-lived signed URL.
- Avoid caching private files in a service worker or public CDN cache.
- Consider PDF content hashes and template versioning for traceability.
- Public certificate verification should not directly expose a private PDF URL.

## 6. Attendance QR security

- QR codes should contain random opaque tokens or a non-sensitive lookup identifier.
- Store token hashes where feasible; support revocation and rotation.
- Validate session state, enrollment status, batch relationship, and permissions on the server.
- Use a database unique constraint to prevent duplicate attendance.
- For rotating session QR, include short expiry and server-side verification; do not rely on client clock alone.
- Log correction and exceptional override actions.
- Camera scanning requires HTTPS and browser permission; provide manual fallback.

## 7. Financial integrity

- Use integer minor units or exact decimal types for money.
- Calculate totals and balances server-side.
- Use database transactions for payment posting and allocations.
- Require idempotency keys for retry-prone payment submissions.
- Never physically delete posted payments.
- Model refunds/reversals as separate auditable transactions.
- Limit reversals to the original successful payment amount.
- Restrict discounts, write-offs, refunds, and fee adjustments to approved permissions.
- Define receipt-number generation to avoid collisions.
- Do not claim online payment gateway security/compliance until a gateway is selected and integrated.

## 8. Audit logging

Record, where appropriate:
- Actor ID and role/permission context.
- Action and target entity.
- Timestamp and request ID.
- Reason for attendance correction, fee reversal, certificate revocation, or privileged adjustment.
- Safe before/after metadata for high-impact fields.

Do not log secrets or unnecessarily duplicate sensitive personal information. Restrict audit log access and define retention.

## 9. API and infrastructure hardening

- Validate body, query, and path parameters.
- Use parameterized ORM queries; avoid raw SQL unless safely parameterized.
- Configure strict CORS allowlist.
- Set secure HTTP headers.
- Rate-limit sensitive/public endpoints.
- Set request body and upload size limits.
- Keep dependencies updated and run dependency/security scans.
- Separate frontend and API environment variables.
- Use request IDs and safe structured logging.
- Return generic 500 errors to clients.
- Monitor database errors, failed jobs, and unusual authentication activity.
- Back up database and test restores.
- Document RPO/RTO and retention before production.
- Use migrations; do not modify production schema manually without version control.

## 10. PWA caching policy

Safe to cache selectively:
- App shell and versioned static assets.
- Public, non-sensitive assets such as approved branding.

Do not cache by default:
- Authenticated API responses.
- Student profiles, attendance, fees, receipts.
- Private certificate PDFs.
- Session/authentication endpoints.

Clear app-specific local state on logout where applicable. Service-worker cache is not a secure vault.

## 11. Pre-launch security checklist

- [ ] Role and ownership tests cover every protected module.
- [ ] Student A cannot read Student B's records or downloads.
- [ ] Front Desk cannot perform unauthorized role/settings/refund/certificate actions.
- [ ] CSRF and cookie settings reviewed.
- [ ] Rate limits enabled.
- [ ] Private storage verified as non-public.
- [ ] No secrets in frontend bundle or repository.
- [ ] Logs exclude credentials and tokens.
- [ ] Backup restore tested.
- [ ] Dependency and configuration scan completed.
- [ ] Audit events verified for high-impact actions.
- [ ] Incident response contact and process documented.
