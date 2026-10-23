import QRCode from 'qrcode';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { storage } from '../../services/storage';

export interface CertificatePdfData {
  instituteName: string;
  studentName: string;
  courseTitle: string;
  batchCode: string;
  startedOn: Date;
  completedOn: Date;
  issuedOn: Date;
  certificateNumber: string;
  verificationUrl: string;
  signatoryName?: string | null;
  signatoryTitle?: string | null;
  legalText?: string | null;
  logoStorageKey?: string | null;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export async function buildCertificatePdf(data: CertificatePdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([841.89, 595.28]); // A4 landscape
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();
  const ink = rgb(0.1, 0.12, 0.16);
  const muted = rgb(0.38, 0.42, 0.48);
  const accent = rgb(0.04, 0.36, 0.36);
  const gold = rgb(0.68, 0.55, 0.28);

  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.995, 0.993, 0.98) });
  page.drawRectangle({ x: 24, y: 24, width: width - 48, height: height - 48, borderColor: accent, borderWidth: 2 });
  page.drawRectangle({ x: 34, y: 34, width: width - 68, height: height - 68, borderColor: gold, borderWidth: 0.8 });

  let logoBottom = height - 90;
  if (data.logoStorageKey) {
    try {
      const logo = await storage.get(data.logoStorageKey);
      const image = logo.subarray(0, 4).toString('hex') === '89504e47'
        ? await pdf.embedPng(logo)
        : await pdf.embedJpg(logo);
      const scaled = image.scaleToFit(90, 60);
      page.drawImage(image, { x: width / 2 - scaled.width / 2, y: height - 104, width: scaled.width, height: scaled.height });
      logoBottom = height - 112;
    } catch {
      logoBottom = height - 90;
    }
  }

  const instituteSize = 22;
  page.drawText(data.instituteName.toUpperCase(), {
    x: width / 2 - sansBold.widthOfTextAtSize(data.instituteName.toUpperCase(), instituteSize) / 2,
    y: logoBottom,
    size: instituteSize,
    font: sansBold,
    color: accent,
  });

  const title = 'CERTIFICATE OF COMPLETION';
  page.drawText(title, {
    x: width / 2 - serifBold.widthOfTextAtSize(title, 34) / 2,
    y: height - 185,
    size: 34,
    font: serifBold,
    color: ink,
  });
  page.drawLine({
    start: { x: width / 2 - 90, y: height - 200 },
    end: { x: width / 2 + 90, y: height - 200 },
    thickness: 1.2,
    color: gold,
  });

  const intro = 'This is to certify that';
  page.drawText(intro, {
    x: width / 2 - serif.widthOfTextAtSize(intro, 15) / 2,
    y: height - 245,
    size: 15,
    font: serif,
    color: muted,
  });

  const nameSize = data.studentName.length > 32 ? 30 : 38;
  page.drawText(data.studentName, {
    x: width / 2 - serifBold.widthOfTextAtSize(data.studentName, nameSize) / 2,
    y: height - 295,
    size: nameSize,
    font: serifBold,
    color: ink,
  });

  const courseLine = 'has successfully completed the programme';
  page.drawText(courseLine, {
    x: width / 2 - serif.widthOfTextAtSize(courseLine, 14) / 2,
    y: height - 332,
    size: 14,
    font: serif,
    color: muted,
  });

  const courseSize = data.courseTitle.length > 48 ? 20 : 24;
  page.drawText(data.courseTitle, {
    x: width / 2 - serifBold.widthOfTextAtSize(data.courseTitle, courseSize) / 2,
    y: height - 368,
    size: courseSize,
    font: serifBold,
    color: accent,
  });

  const dates = `${formatDate(data.startedOn)} — ${formatDate(data.completedOn)}  ·  Batch ${data.batchCode}`;
  page.drawText(dates, {
    x: width / 2 - sans.widthOfTextAtSize(dates, 11) / 2,
    y: height - 396,
    size: 11,
    font: sans,
    color: muted,
  });

  if (data.legalText) {
    const words = data.legalText.split(' ');
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (sans.widthOfTextAtSize(candidate, 9) > 500) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
    lines.slice(0, 3).forEach((line, index) => {
      page.drawText(line, {
        x: width / 2 - sans.widthOfTextAtSize(line, 9) / 2,
        y: height - 428 - index * 13,
        size: 9,
        font: sans,
        color: muted,
      });
    });
  }

  // Signatory
  const signY = 130;
  page.drawLine({ start: { x: 120, y: signY + 18 }, end: { x: 320, y: signY + 18 }, thickness: 0.8, color: muted });
  if (data.signatoryName) {
    page.drawText(data.signatoryName, { x: 120, y: signY, size: 11, font: sansBold, color: ink });
  }
  if (data.signatoryTitle) {
    page.drawText(data.signatoryTitle, { x: 120, y: signY - 14, size: 9, font: sans, color: muted });
  }

  // QR + verification details
  const qrPng = await QRCode.toBuffer(data.verificationUrl, {
    type: 'png',
    width: 220,
    margin: 1,
    errorCorrectionLevel: 'M',
  });
  const qrImage = await pdf.embedPng(qrPng);
  const qrSize = 88;
  page.drawImage(qrImage, { x: width - 150, y: 92, width: qrSize, height: qrSize });
  page.drawText('Scan to verify', {
    x: width - 150,
    y: 78,
    size: 8,
    font: sans,
    color: muted,
  });

  page.drawText(`Certificate no. ${data.certificateNumber}`, {
    x: 80,
    y: 76,
    size: 9,
    font: sansBold,
    color: ink,
  });
  page.drawText(`Issued ${formatDate(data.issuedOn)}`, {
    x: 80,
    y: 62,
    size: 8,
    font: sans,
    color: muted,
  });
  page.drawText(data.verificationUrl, {
    x: 80,
    y: 48,
    size: 7,
    font: sans,
    color: muted,
  });

  return pdf.save();
}
