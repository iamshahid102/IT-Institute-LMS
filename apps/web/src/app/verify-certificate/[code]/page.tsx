import { VerifyCertificateResult } from '@/features/certificates/verify-result';

export default async function VerifyCertificatePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <VerifyCertificateResult code={code} />;
}
