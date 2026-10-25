import { VerificationCompletedData } from '../email.types';
import { renderBaseTemplate } from './base.template';

export function renderVerificationCompletedEmail(data: VerificationCompletedData): {
  subject: string;
  html: string;
  text: string;
} {
  const { userName, reportTitle, transactionHash, network, auditRecordUrl, unsubscribeUrl } = data;

  const subject = `[ValoraSec] Audit verified on Stellar ${network}: ${reportTitle}`;

  const contentHtml = `
    <p style="margin: 0 0 16px 0;">Hello ${userName || 'there'},</p>
    <p style="margin: 0 0 20px 0;">
      Your security audit report has been permanently anchored and verified on the <strong>Stellar ${network}</strong> blockchain.
    </p>

    <!-- Verification Card -->
    <div style="background-color: #1E293B; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #10B98150; border-left: 4px solid #10B981;">
      <div style="font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #10B981; font-weight: 700; margin-bottom: 6px;">
        On-Chain Proof Verified
      </div>
      <div style="font-size: 16px; font-weight: 600; color: #F8FAFC; margin-bottom: 12px;">
        ${reportTitle}
      </div>
      <div style="font-size: 13px; color: #94A3B8; margin-bottom: 4px;">
        Transaction Hash:
      </div>
      <div style="font-family: monospace; font-size: 12px; background-color: #0F172A; padding: 8px 12px; border-radius: 4px; color: #38BDF8; word-break: break-all;">
        ${transactionHash}
      </div>
    </div>

    <p style="margin: 0 0 12px 0;">
      The cryptographic signature and immutable audit hash are now public proof of your contract's security posture.
    </p>
  `;

  const html = renderBaseTemplate({
    title: 'Audit Record Verified On-Chain',
    previewText: `Audit report "${reportTitle}" is verified on Stellar ${network}.`,
    contentHtml,
    ctaText: 'View On-Chain Audit Record',
    ctaUrl: auditRecordUrl,
    unsubscribeUrl,
  });

  const text = `Hello ${userName || 'there'},

Your audit report "${reportTitle}" has been verified on Stellar ${network}.

Transaction Hash: ${transactionHash}

View the verified audit record: ${auditRecordUrl}

To unsubscribe: ${unsubscribeUrl}`;

  return { subject, html, text };
}
