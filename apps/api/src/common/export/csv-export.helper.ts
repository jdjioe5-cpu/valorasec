/**
 * CSV Export Helper for ValoraSec Data Export (Issue #53)
 * Follows RFC 4180 for standard comma-separated value formatting.
 */

export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) {
    return '""';
  }

  let str: string;
  if (typeof value === 'object') {
    str = JSON.stringify(value);
  } else {
    str = String(value);
  }

  // Escape double quotes by doubling them
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function toCsvString(headers: string[], rows: unknown[][]): string {
  const headerLine = headers.map((h) => escapeCsvField(h)).join(',');
  const rowLines = rows.map((row) => row.map((cell) => escapeCsvField(cell)).join(','));

  // Prepend UTF-8 BOM (\uFEFF) for Excel compatibility
  return '\uFEFF' + [headerLine, ...rowLines].join('\r\n');
}

export interface RawFinding {
  id?: string;
  ruleId?: string;
  severity?: string;
  title?: string;
  description?: string;
  recommendation?: string;
  location?: {
    file?: string;
    line?: number;
  };
  file?: string;
  line?: number;
}

export function formatProjectCsv(project: {
  id: string;
  name: string;
  network: string;
  status: string;
  createdAt: Date | string;
  contracts?: Array<{
    id: string;
    name: string;
    address: string;
  }>;
  scans?: Array<{
    id: string;
    contractId: string;
    status: string;
    startedAt: Date | string;
    findings?: unknown;
  }>;
}): string {
  const headers = [
    'Project ID',
    'Project Name',
    'Network',
    'Project Status',
    'Project Created At',
    'Contract ID',
    'Contract Name',
    'Contract Address',
    'Scan ID',
    'Scan Status',
    'Scan Started At',
    'Finding ID',
    'Severity',
    'Title',
    'Description',
    'Recommendation',
    'File',
    'Line',
  ];

  const rows: unknown[][] = [];
  const contractsMap = new Map((project.contracts || []).map((c) => [c.id, c]));

  if (!project.scans || project.scans.length === 0) {
    // If no scans exist, export project contracts
    if (!project.contracts || project.contracts.length === 0) {
      rows.push([
        project.id,
        project.name,
        project.network,
        project.status,
        project.createdAt,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
      ]);
    } else {
      for (const contract of project.contracts) {
        rows.push([
          project.id,
          project.name,
          project.network,
          project.status,
          project.createdAt,
          contract.id,
          contract.name,
          contract.address,
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
        ]);
      }
    }
  } else {
    for (const scan of project.scans) {
      const contract = contractsMap.get(scan.contractId);
      const findingsList: RawFinding[] = Array.isArray(scan.findings)
        ? (scan.findings as RawFinding[])
        : [];

      if (findingsList.length === 0) {
        rows.push([
          project.id,
          project.name,
          project.network,
          project.status,
          project.createdAt,
          contract?.id || scan.contractId,
          contract?.name || '',
          contract?.address || '',
          scan.id,
          scan.status,
          scan.startedAt,
          '',
          '',
          '',
          '',
          '',
          '',
          '',
        ]);
      } else {
        for (const finding of findingsList) {
          const file = finding.location?.file || finding.file || '';
          const line = finding.location?.line || finding.line || '';

          rows.push([
            project.id,
            project.name,
            project.network,
            project.status,
            project.createdAt,
            contract?.id || scan.contractId,
            contract?.name || '',
            contract?.address || '',
            scan.id,
            scan.status,
            scan.startedAt,
            finding.id || finding.ruleId || '',
            finding.severity || '',
            finding.title || '',
            finding.description || '',
            finding.recommendation || '',
            file,
            line,
          ]);
        }
      }
    }
  }

  return toCsvString(headers, rows);
}

export function formatReportCsv(report: {
  id: string;
  title: string;
  status: string;
  verifiedOnChain: boolean;
  transactionHash?: string | null;
  createdAt: Date | string;
  projectId: string;
  contractId: string;
  project?: { name: string };
  contract?: { name: string; address: string };
  findings?: unknown;
}): string {
  const headers = [
    'Report ID',
    'Report Title',
    'Status',
    'Verified On Chain',
    'Transaction Hash',
    'Report Created At',
    'Project ID',
    'Project Name',
    'Contract ID',
    'Contract Name',
    'Contract Address',
    'Finding ID',
    'Severity',
    'Title',
    'Description',
    'Recommendation',
    'File',
    'Line',
  ];

  const rows: unknown[][] = [];
  const findingsList: RawFinding[] = Array.isArray(report.findings)
    ? (report.findings as RawFinding[])
    : [];

  const baseReportRow = [
    report.id,
    report.title,
    report.status,
    report.verifiedOnChain,
    report.transactionHash || '',
    report.createdAt,
    report.projectId,
    report.project?.name || '',
    report.contractId,
    report.contract?.name || '',
    report.contract?.address || '',
  ];

  if (findingsList.length === 0) {
    rows.push([...baseReportRow, '', '', '', '', '', '', '']);
  } else {
    for (const finding of findingsList) {
      const file = finding.location?.file || finding.file || '';
      const line = finding.location?.line || finding.line || '';

      rows.push([
        ...baseReportRow,
        finding.id || finding.ruleId || '',
        finding.severity || '',
        finding.title || '',
        finding.description || '',
        finding.recommendation || '',
        file,
        line,
      ]);
    }
  }

  return toCsvString(headers, rows);
}
