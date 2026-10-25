import type { Finding, Severity } from '@valorasec/shared';
import { BaseRule } from './base';
import type { RuleContext } from '../rule-engine';

export class R006GasLoopRule extends BaseRule {
  readonly id = 'R006';
  readonly name = 'gas-inefficient-loop';
  readonly category = 'gas-optimization';
  readonly severity: Severity = 'medium';
  readonly description = 'Loops with unbounded iteration may consume excessive gas.';
  readonly recommendation =
    'Limit loop iterations or use pagination patterns to control gas consumption.';
  readonly references = ['https://soroban.stellar.org/docs/fees-and-metering'];

  evaluate(context: RuleContext): Finding[] {
    const findings: Finding[] = [];
    const { functions } = context.file;

    for (const fn of functions) {
      for (const loop of fn.loops) {
        if (loop.isInfinite) {
          findings.push(
            this.createFinding(
              context,
              loop.line,
              loop.col,
              `Potentially Unbounded Loop in \`${fn.name}\``,
              `The \`${loop.kind}\` on line ${loop.line} may run indefinitely and exhaust Soroban execution gas budgets.`,
            ),
          );
        }
      }
    }

    return findings;
  }
}
