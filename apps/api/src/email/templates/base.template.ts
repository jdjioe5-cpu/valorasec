export interface BaseTemplateOptions {
  title: string;
  previewText: string;
  contentHtml: string;
  ctaText?: string;
  ctaUrl?: string;
  unsubscribeUrl: string;
}

export function renderBaseTemplate(options: BaseTemplateOptions): string {
  const { title, previewText, contentHtml, ctaText, ctaUrl, unsubscribeUrl } = options;

  const ctaSection =
    ctaText && ctaUrl
      ? `
      <div style="margin: 32px 0 24px 0; text-align: center;">
        <a href="${ctaUrl}" style="background-color: #3B82F6; color: #FFFFFF; font-weight: 600; font-size: 14px; line-height: 1; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; box-shadow: 0 0 15px rgba(59, 130, 246, 0.4);">
          ${ctaText}
        </a>
      </div>
    `
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark light">
  <meta name="supported-color-schemes" content="dark light">
  <title>${title}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #0A0D14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #E2E8F0;">
  <!-- Preview Text -->
  <div style="display: none; max-height: 0px; overflow: hidden;">
    ${previewText}
  </div>

  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0A0D14; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Container -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #111827; border: 1px solid #1E293B; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);">
          <!-- Header -->
          <tr>
            <td style="padding: 28px 32px; background: linear-gradient(135deg, #0F172A 0%, #1E1B4B 100%); border-bottom: 1px solid #312E81;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <span style="font-size: 22px; font-weight: 800; letter-spacing: -0.5px; color: #FFFFFF;">
                      VALORA<span style="color: #38BDF8;">SEC</span>
                    </span>
                    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #818CF8; margin-top: 2px;">
                      Soroban Smart Contract Security
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px;">
              <h1 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #F8FAFC;">
                ${title}
              </h1>
              <div style="font-size: 15px; line-height: 1.6; color: #94A3B8;">
                ${contentHtml}
              </div>
              ${ctaSection}
            </td>
          </tr>

          <!-- Footer with Unsubscribe -->
          <tr>
            <td style="padding: 24px 32px; background-color: #0B0F19; border-top: 1px solid #1E293B; font-size: 12px; line-height: 1.5; color: #64748B; text-align: center;">
              <p style="margin: 0 0 8px 0;">
                You are receiving this email because you have notifications enabled in your ValoraSec account.
              </p>
              <p style="margin: 0;">
                <a href="${unsubscribeUrl}" style="color: #94A3B8; text-decoration: underline;">
                  Unsubscribe or manage preferences
                </a>
                &nbsp;&bull;&nbsp;
                <span>&copy; ${new Date().getFullYear()} ValoraSec. All rights reserved.</span>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
