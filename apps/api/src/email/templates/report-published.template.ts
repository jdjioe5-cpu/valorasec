import { ReportPublishedData } from '../email.types';
import { renderBaseTemplate } from './base.template';

export function renderReportPublishedEmail(data: ReportPublishedData): {
  subject: string;
  html: string;
  text: string;
} {
  const { userName, reportTitle, projectName, findingsCount, reportUrl, unsubscribeUrl } = data;

  const subject = `[ValoraSec] New audit report published: ${reportTitle}`;

  const contentHtml = `
    <p style="margin: 0 0 16px 0;">Hello ${userName || 'there'},</p>
    <p style="margin: 0 0 20px 0;">
      A comprehensive audit report has been published for your project <strong>${projectName}</strong>.
    </p>

    <!-- Report Box -->
    <div style="background-color: #1E293B; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #334155;">
      <div style="font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #94A3B8; margin-bottom: 6px;">Published Report</div>
      <div style="font-size: 18px; font-weight: 700; color: #F8FAFC;">
        ${reportTitle}
      </div>
      <div style="margin-top: 12px; font-size: 14px; color: #38BDF8;">
        &bull; Contains ${findingsCount} security evaluation finding${findingsCount === 1 ? '' : 's'}
      </div>
    </div>

    <p style="margin: 0 0 12px 0;">
      You can now share this report with auditors, stakeholders, and community members.
    </p>
  `;

  const html = renderBaseTemplate({
    title: 'Audit Report Published',
    previewText: `Security report "${reportTitle}" for ${projectName} is now ready to view.`,
    contentHtml,
    ctaText: 'View Audit Report',
    ctaUrl: reportUrl,
    unsubscribeUrl,
  });

  const text = `Hello ${userName || 'there'},

A new audit report "${reportTitle}" has been published for project "${projectName}".
Total findings: ${findingsCount}

View the published report: ${reportUrl}

To unsubscribe: ${unsubscribeUrl}`;

  return { subject, html, text };
}
