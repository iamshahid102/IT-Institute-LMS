import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { formatMinor } from '@lms/shared';

interface ReceiptData {
  instituteName: string;
  instituteAddress?: string | null;
  institutePhone?: string | null;
  paymentNumber: string;
  receivedAt: Date;
  studentName: string;
  studentNumber: string;
  batchCode: string;
  invoiceNumber: string;
  amountMinor: number;
  currency: string;
  method: string;
  reference?: string | null;
  receivedByName: string;
  invoiceTotalMinor: number;
  outstandingMinor: number;
}

export async function buildReceiptPdf(data: ReceiptData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 419.53]); // A5 landscape
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const ink = rgb(0.09, 0.13, 0.2);
  const muted = rgb(0.42, 0.48, 0.55);
  const accent = rgb(0.05, 0.42, 0.4);

  const { width, height } = page.getSize();
  page.drawRectangle({ x: 0, y: height - 6, width, height: 6, color: accent });
  page.drawText(data.instituteName.slice(0, 60), { x: 40, y: height - 52, size: 16, font: bold, color: ink });
  let metaY = height - 70;
  for (const line of [data.instituteAddress, data.institutePhone].filter(Boolean) as string[]) {
    page.drawText(line.slice(0, 90), { x: 40, y: metaY, size: 8, font, color: muted });
    metaY -= 11;
  }

  page.drawText('PAYMENT RECEIPT', { x: 40, y: height - 112, size: 12, font: bold, color: accent });
  page.drawText(`Receipt no. ${data.paymentNumber}`, {
    x: width - 40 - bold.widthOfTextAtSize(`Receipt no. ${data.paymentNumber}`, 10),
    y: height - 108,
    size: 10,
    font: bold,
    color: ink,
  });
  const issued = data.receivedAt.toISOString().slice(0, 10);
  page.drawText(`Date: ${issued}`, {
    x: width - 40 - font.widthOfTextAtSize(`Date: ${issued}`, 9),
    y: height - 122,
    size: 9,
    font,
    color: muted,
  });

  const rows: Array<[string, string]> = [
    ['Student', `${data.studentName} (${data.studentNumber})`],
    ['Batch', data.batchCode],
    ['Invoice', data.invoiceNumber],
    ['Payment method', data.method.replace(/_/g, ' ') + (data.reference ? ` — ref ${data.reference}` : '')],
    ['Received by', data.receivedByName],
  ];

  let y = height - 156;
  for (const [label, value] of rows) {
    page.drawText(label, { x: 40, y, size: 9, font, color: muted });
    page.drawText(value.slice(0, 70), { x: 150, y, size: 9, font, color: ink });
    y -= 17;
  }

  page.drawRectangle({ x: 40, y: y - 62, width: width - 80, height: 62, color: rgb(0.95, 0.97, 0.97) });
  page.drawText('Amount received', { x: 56, y: y - 22, size: 9, font, color: muted });
  page.drawText(formatMinor(data.amountMinor, data.currency), {
    x: 56,
    y: y - 44,
    size: 16,
    font: bold,
    color: ink,
  });
  page.drawText(`Invoice total: ${formatMinor(data.invoiceTotalMinor, data.currency)}`, {
    x: width - 56 - font.widthOfTextAtSize(`Invoice total: ${formatMinor(data.invoiceTotalMinor, data.currency)}`, 8),
    y: y - 22,
    size: 8,
    font,
    color: muted,
  });
  const balanceLabel = `Remaining balance: ${formatMinor(data.outstandingMinor, data.currency)}`;
  page.drawText(balanceLabel, {
    x: width - 56 - font.widthOfTextAtSize(balanceLabel, 8),
    y: y - 38,
    size: 8,
    font,
    color: muted,
  });

  page.drawText('This is a computer-generated receipt. No signature is required.', {
    x: 40,
    y: 28,
    size: 7,
    font,
    color: muted,
  });

  return pdf.save();
}
