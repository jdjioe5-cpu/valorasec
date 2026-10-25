export interface VerificationEmailProps {
  name: string;
  verificationUrl: string;
}

export function renderVerificationEmail(props: VerificationEmailProps): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = 'Verify your email address - ValoraSec';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0b0f19;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .wrapper {
      width: 100%;
      background-color: #0b0f19;
      padding: 40px 16px;
    }
    .container {
      max-width: 580px;
      margin: 0 auto;
      background: #111827;
      border: 1px solid #1f293d;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
    }
    .header {
      padding: 32px 32px 24px 32px;
      border-bottom: 1px solid #1f293d;
      text-align: center;
    }
    .logo {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #38bdf8;
      text-decoration: none;
    }
    .content {
      padding: 32px;
    }
    h1 {
      font-size: 20px;
      font-weight: 600;
      margin-top: 0;
      margin-bottom: 16px;
      color: #f8fafc;
    }
    p {
      font-size: 15px;
      line-height: 1.6;
      color: #94a3b8;
      margin-top: 0;
      margin-bottom: 20px;
    }
    .btn-container {
      margin: 32px 0;
      text-align: center;
    }
    .btn {
      display: inline-block;
      background-color: #0284c7;
      color: #ffffff !important;
      padding: 14px 32px;
      font-size: 15px;
      font-weight: 600;
      border-radius: 8px;
      text-decoration: none;
      transition: background-color 0.2s;
    }
    .expiry-note {
      font-size: 13px;
      color: #64748b;
      margin-top: 24px;
      border-top: 1px dashed #1e293b;
      padding-top: 16px;
    }
    .url-fallback {
      word-break: break-all;
      color: #38bdf8;
      font-size: 12px;
    }
    .footer {
      padding: 24px 32px;
      background-color: #0c1220;
      border-top: 1px solid #1f293d;
      text-align: center;
      font-size: 12px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <a href="https://valorasec.dev" class="logo">VALORASEC</a>
      </div>
      <div class="content">
        <h1>Verify your email address</h1>
        <p>Hello ${props.name || 'there'},</p>
        <p>Thank you for creating an account on ValoraSec, the Stellar & Soroban smart contract security platform. Please click the button below to verify your email address and activate your account.</p>
        
        <div class="btn-container">
          <a href="${props.verificationUrl}" class="btn" target="_blank">Verify Email Address</a>
        </div>

        <div class="expiry-note">
          <p>This verification link will expire in <strong>24 hours</strong>. If you did not create a ValoraSec account, you can safely ignore this email.</p>
          <p>Button not working? Copy and paste this URL into your browser:<br>
          <span class="url-fallback">${props.verificationUrl}</span></p>
        </div>
      </div>
      <div class="footer">
        &copy; ${new Date().getFullYear()} ValoraSec Security Platform. All rights reserved.
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
ValoraSec Email Verification

Hello ${props.name || 'there'},

Please verify your email address by visiting the link below:
${props.verificationUrl}

This link will expire in 24 hours. If you did not create a ValoraSec account, please ignore this email.
  `.trim();

  return { subject, html, text };
}
