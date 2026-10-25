export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailSendResult {
  success: boolean;
  messageId: string;
}

export interface EmailTransport {
  send(options: EmailOptions): Promise<EmailSendResult>;
}

export const EMAIL_TRANSPORT = 'EMAIL_TRANSPORT';

export interface ScanCompletedData {
  userName: string;
  projectName: string;
  contractName: string;
  score: number;
  findingsCount: number;
  scanUrl: string;
  unsubscribeUrl: string;
}

export interface ReportPublishedData {
  userName: string;
  reportTitle: string;
  projectName: string;
  findingsCount: number;
  reportUrl: string;
  unsubscribeUrl: string;
}

export interface VerificationCompletedData {
  userName: string;
  reportTitle: string;
  transactionHash: string;
  network: string;
  auditRecordUrl: string;
  unsubscribeUrl: string;
}
