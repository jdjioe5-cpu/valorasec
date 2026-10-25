import type { Finding, Severity } from '@valorasec/shared';
import { BaseRule } from './base';
import type { RuleContext } from '../rule-engine';

export class R007UnsafeRandomnessRule extends BaseRule {
  readonly id = 'R007';
  readonly name = 'unsafe-randomness';
  readonly category = 'randomness';
  readonly severity: Severity = 'high';
  readonly description =
    'Using on-chain data as a source of randomness is predictable and exploitable.';
  readonly recommendation =
    'Avoid using on-chain data for randomness. Use commit-reveal schemes or external oracle for randomness.';
  readonly references = [];

  evaluate(context: RuleContext): Finding[] {
    const findings: Finding[] = [];
    const { functions } = context.file;

    for (const fn of functions) {
      for (const lineObj of fn.rawLines) {
        const text = lineObj.text;
        if (
          (text.includes('ledger().timestamp()') || text.includes('ledger().sequence()')) &&
          (text.includes('%') ||
            text.includes('rand') ||
            text.includes('random') ||
            text.includes('seed'))
        ) {
          findings.push(
            this.createFinding(
              context,
              lineObj.line,
              1,
              `Predictable Randomness in \`${fn.name}\``,
              `On-chain ledger timestamp or sequence number is used as entropy source for pseudo-random calculations on line ${lineObj.line}.`,
            ),
          );
        }
      }
    }

    return findings;
  }
}
