export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export interface EmailSendResult {
  messageId: string;
  success: boolean;
  error?: string;
}

export interface EmailTransport {
  send(options: EmailOptions): Promise<EmailSendResult>;
}

export const EMAIL_TRANSPORT = 'EMAIL_TRANSPORT';
