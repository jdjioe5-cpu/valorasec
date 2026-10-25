import {
  escapeCsvField,
  toCsvString,
  formatProjectCsv,
  formatReportCsv,
} from './csv-export.helper';

describe('csv-export.helper', () => {
  describe('escapeCsvField', () => {
    it('should wrap values in double quotes', () => {
      expect(escapeCsvField('hello')).toBe('"hello"');
    });

    it('should escape internal double quotes by doubling them', () => {
      expect(escapeCsvField('hello "world"')).toBe('"hello ""world"""');
    });

    it('should handle null and undefined safely', () => {
      expect(escapeCsvField(null)).toBe('""');
      expect(escapeCsvField(undefined)).toBe('""');
    });

    it('should serialize objects as JSON strings', () => {
      expect(escapeCsvField({ a: 1 })).toBe('"{""a"":1}"');
    });
  });

  describe('toCsvString', () => {
    it('should format headers and rows with CRLF and BOM', () => {
      const headers = ['A', 'B'];
      const rows = [
        ['1', '2'],
        ['3', '4'],
      ];
      const csv = toCsvString(headers, rows);

      expect(csv.startsWith('\uFEFF')).toBe(true);
      expect(csv).toContain('"A","B"\r\n"1","2"\r\n"3","4"');
    });
  });

  describe('formatProjectCsv', () => {
    it('should export project with multiple contracts and findings', () => {
      const project = {
        id: 'proj-1',
        name: 'My Soroban DeFi',
        network: 'testnet',
        status: 'active',
        createdAt: new Date('2026-10-01'),
        contracts: [
          {
            id: 'c-1',
            name: 'Vault Contract',
            address: 'CA76...99',
          },
        ],
        scans: [
          {
            id: 'scan-1',
            contractId: 'c-1',
            status: 'completed',
            startedAt: new Date('2026-10-02'),
            findings: [
              {
                id: 'F-1',
                severity: 'critical',
                title: 'Reentrancy vulnerability',
                description: 'State modified after cross-contract call',
                recommendation: 'Use reentrancy guard',
                location: { file: 'src/lib.rs', line: 42 },
              },
            ],
          },
        ],
      };

      const csv = formatProjectCsv(project);
      expect(csv).toContain('"Project ID"');
      expect(csv).toContain('"My Soroban DeFi"');
      expect(csv).toContain('"Vault Contract"');
      expect(csv).toContain('"Reentrancy vulnerability"');
      expect(csv).toContain('"src/lib.rs"');
      expect(csv).toContain('"42"');
    });

    it('should handle project with no scans gracefully', () => {
      const project = {
        id: 'proj-2',
        name: 'Empty Project',
        network: 'mainnet',
        status: 'active',
        createdAt: new Date('2026-10-01'),
        contracts: [],
      };

      const csv = formatProjectCsv(project);
      expect(csv).toContain('"Empty Project"');
    });
  });

  describe('formatReportCsv', () => {
    it('should export single report with findings', () => {
      const report = {
        id: 'rep-1',
        title: 'Audit Report - Pool',
        status: 'published',
        verifiedOnChain: true,
        transactionHash: '0xabc123',
        createdAt: new Date('2026-10-05'),
        projectId: 'proj-1',
        contractId: 'c-1',
        project: { name: 'Pool Project' },
        contract: { name: 'Pool Contract', address: 'CP78...11' },
        findings: [
          {
            id: 'F-2',
            severity: 'high',
            title: 'Unchecked return value',
            description: 'Token transfer return not asserted',
            file: 'src/pool.rs',
            line: 88,
          },
        ],
      };

      const csv = formatReportCsv(report);
      expect(csv).toContain('"Report ID"');
      expect(csv).toContain('"Audit Report - Pool"');
      expect(csv).toContain('"0xabc123"');
      expect(csv).toContain('"Unchecked return value"');
      expect(csv).toContain('"src/pool.rs"');
    });
  });
});
