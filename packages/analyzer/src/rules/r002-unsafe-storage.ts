import type { Finding, Severity } from '@valorasec/shared';
import { BaseRule } from './base';
import type { RuleContext } from '../rule-engine';

export class R002UnsafeStorageRule extends BaseRule {
  readonly id = 'R002';
  readonly name = 'unsafe-storage-access';
  readonly category = 'storage';
  readonly severity: Severity = 'high';
  readonly description =
    'Storage map accessed without checking for existence, potentially leading to unexpected behavior.';
  readonly recommendation =
    'Use `get()` with proper error handling or check for existence before accessing storage values.';
  readonly references = ['https://soroban.stellar.org/docs/storage'];

  evaluate(context: RuleContext): Finding[] {
    const findings: Finding[] = [];
    const { functions, lines } = context.file;

    for (const fn of functions) {
      for (const access of fn.storageAccesses) {
        if (access.type === 'get') {
          // Check if function checks .has() before .get()
          const hasCheck = fn.storageAccesses.some((a) => a.type === 'has' && a.key === access.key);
          const rawLine = lines[access.line - 1] || '';

          // If line has .unwrap() directly on storage get without unwrap_or or default
          if (!hasCheck && rawLine.includes('.unwrap()')) {
            findings.push(
              this.createFinding(
                context,
                access.line,
                access.col,
                `Unchecked Storage Get in \`${fn.name}\``,
                `Storage key \`${access.key || 'unknown'}\` is retrieved via .get() and immediately unwrapped without .has() verification or default fallback.`,
              ),
            );
          }
        }
      }
    }

    return findings;
  }
}
