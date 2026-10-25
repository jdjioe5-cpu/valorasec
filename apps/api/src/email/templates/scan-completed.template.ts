import { ScanCompletedData } from '../email.types';
import { renderBaseTemplate } from './base.template';

export function renderScanCompletedEmail(data: ScanCompletedData): {
  subject: string;
  html: string;
  text: string;
} {
  const { userName, projectName, contractName, score, findingsCount, scanUrl, unsubscribeUrl } =
    data;

  const subject = `[ValoraSec] Security scan completed for ${contractName} (${score}/100)`;

  const scoreColor = score >= 80 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444';
  const scoreBadgeBg =
    score >= 80
      ? 'rgba(16, 185, 129, 0.15)'
      : score >= 50
        ? 'rgba(245, 158, 11, 0.15)'
        : 'rgba(239, 68, 68, 0.15)';

  const contentHtml = `
    <p style="margin: 0 0 16px 0;">Hello ${userName || 'there'},</p>
    <p style="margin: 0 0 20px 0;">
      A static analysis security scan has completed for contract <strong>${contractName}</strong> in project <strong>${projectName}</strong>.
    </p>

    <!-- Score Box -->
    <div style="background-color: #1E293B; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #334155;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="vertical-align: middle;">
            <div style="font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #94A3B8;">Security Score</div>
            <div style="font-size: 32px; font-weight: 800; color: ${scoreColor}; margin-top: 4px;">
              ${score}<span style="font-size: 16px; color: #64748B;">/100</span>
            </div>
          </td>
          <td align="right" style="vertical-align: middle;">
            <div style="display: inline-block; background-color: ${scoreBadgeBg}; color: ${scoreColor}; border: 1px solid ${scoreColor}40; border-radius: 20px; padding: 6px 14px; font-size: 13px; font-weight: 600;">
              ${findingsCount} Finding${findingsCount === 1 ? '' : 's'} Detected
            </div>
          </td>
        </tr>
      </table>
    </div>

    <p style="margin: 0 0 12px 0;">
      Review the detailed findings and remediation guidelines to ensure your Soroban contract is secure before production deployment.
    </p>
  `;

  const html = renderBaseTemplate({
    title: 'Security Scan Completed',
    previewText: `Security scan for ${contractName} finished with score ${score}/100 and ${findingsCount} findings.`,
    contentHtml,
    ctaText: 'View Scan Results',
    ctaUrl: scanUrl,
    unsubscribeUrl,
  });

  const text = `Hello ${userName || 'there'},

A security scan has completed for contract "${contractName}" in project "${projectName}".

Security Score: ${score}/100
Findings Detected: ${findingsCount}

View your scan results: ${scanUrl}

To unsubscribe: ${unsubscribeUrl}`;

  return { subject, html, text };
}
